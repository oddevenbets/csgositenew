const express = require('express');
const openid = require('openid');
const axios = require('axios');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

// Firebase setup
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://csgoace-gg.firebaseio.com'
});

const db = admin.firestore();
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'casecrack_secret_key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Steam API Key
const STEAM_API_KEY = '5E9F4B8D31B6390E20AB110368D75267';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// Steam OpenID setup
const relyingParty = new openid.RelyingParty(
  `${baseUrl}/auth/steam/return`,
  baseUrl,
  true,
  false,
  []
);

// Supported cryptocurrencies
const supportedCurrencies = ['btc', 'eth', 'sol', 'ltc', 'bch', 'trx', 'doge'];

// NowPayments API client
const nowpaymentsClient = axios.create({
  baseURL: 'https://api.nowpayments.io/v1',
  headers: {
    'x-api-key': process.env.NOWPAYMENTS_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Steam Authentication Routes
app.get('/auth/steam', (req, res) => {
  if (req.query.returnTo) {
    req.session.returnTo = req.query.returnTo;
  }

  relyingParty.authenticate('https://steamcommunity.com/openid', false, (err, authUrl) => {
    if (err || !authUrl) return res.send('Steam login failed.');
    res.redirect(authUrl);
  });
});

app.get('/auth/steam/return', async (req, res) => {
  relyingParty.verifyAssertion(req, async (err, result) => {
    if (err || !result.authenticated) return res.send('Steam login failed.');

    const steamId = result.claimedIdentifier.split('/').pop();
    const apiUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;

    try {
      const response = await axios.get(apiUrl);
      const profile = response.data.response.players[0];

      req.session.user = {
        steamId,
        personaname: profile.personaname,
        avatarfull: profile.avatarfull
      };

      const userRef = db.collection('users').doc(steamId);
      const doc = await userRef.get();

      if (!doc.exists) {
        await userRef.set({
          steamId,
          personaname: profile.personaname,
          avatarfull: profile.avatarfull,
          balance: 0.0
        });
      } else {
        await userRef.update({
          personaname: profile.personaname,
          avatarfull: profile.avatarfull
        });
      }

      const redirectTo = req.session.returnTo || '/home.html';
      delete req.session.returnTo;
      res.redirect(redirectTo);
    } catch (err) {
      console.error(err);
      res.send('Failed to fetch Steam profile.');
    }
  });
});

// User Routes
app.get('/user', async (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });

  const steamId = req.session.user.steamId;
  const doc = await db.collection('users').doc(steamId).get();
  const balance = doc.exists ? doc.data().balance : 0;

  res.json({
    loggedIn: true,
    user: req.session.user,
    balance
  });
});

app.get('/logout', (req, res) => {
  const redirectTo = req.headers.referer || '/home.html';
  req.session.destroy(() => {
    res.redirect(redirectTo);
  });
});

// Case Opening Routes
app.post('/open-case/start', express.json(), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const { amount } = req.body;
  const caseCost = parseFloat(amount);
  if (isNaN(caseCost)) return res.status(400).json({ error: 'Invalid case cost' });

  const steamId = req.session.user.steamId;
  const userRef = db.collection('users').doc(steamId);
  const doc = await userRef.get();
  if (!doc.exists) return res.status(404).json({ error: 'User not found' });

  const balance = doc.data().balance;
  if (balance < caseCost) return res.status(400).json({ error: 'Insufficient balance' });

  await userRef.update({ balance: balance - caseCost });
  res.json({ success: true, newBalance: balance - caseCost });
});

app.post('/open-case/complete', express.json(), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const { gems } = req.body;
  const gemReward = parseFloat(gems);
  if (isNaN(gemReward)) return res.status(400).json({ error: 'Invalid gem reward' });

  const steamId = req.session.user.steamId;
  const userRef = db.collection('users').doc(steamId);
  const doc = await userRef.get();
  if (!doc.exists) return res.status(404).json({ error: 'User not found' });

  const balance = doc.data().balance;
  const newBalance = balance + gemReward;

  await userRef.update({ balance: newBalance });
  res.json({ success: true, newBalance });
});

// Payment Routes
app.post('/create-deposit', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { orderId, currency } = req.body;
    const steamId = req.session.user.steamId;

    if (!orderId || !currency) return res.status(400).json({ error: 'Missing data' });
    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({ error: 'Unsupported currency', supportedCurrencies });
    }

    // Step 1: Get minimum payment amount in USD
    const minAmountResponse = await nowpaymentsClient.get(`/min-amount?currency_from=${currency}&currency_to=usd`);
    const minAmount = parseFloat(minAmountResponse.data.min_amount);
    
    if (!minAmount) {
      throw new Error('Could not get minimum amount for selected currency');
    }

    const estimateResponse = await nowpaymentsClient.get(`/estimate?amount=${minAmount}&currency_from=${currency}&currency_to=usd`);
    const usdValue = estimateResponse.data.estimated_amount;

    // Step 2: Create payment with the exact minimum USD amount
    const paymentResponse = await nowpaymentsClient.post('/payment', {
      price_amount: usdValue,
      price_currency: 'usd',
      pay_currency: currency,
      order_id: orderId,
      ipn_callback_url: `${baseUrl}/ipn-webhook`,
      pay_amount: minAmount,
      case: 'common'
    });

    console.log('NOWPayments payment creation response:', paymentResponse.data);

    if (!paymentResponse.data.payment_id) {
      throw new Error('NowPayments did not return a payment ID');
    }

    // Step 3: Return simplified payment details
    res.json({
      success: true,
      payment_url: `https://nowpayments.io/payment/?id=${paymentResponse.data.payment_id}`,
      payment_id: paymentResponse.data.payment_id,
      pay_address: paymentResponse.data.pay_address,
      pay_currency: paymentResponse.data.pay_currency,
      pay_amount: minAmount,
      min_amount: minAmount,
      expires_at: paymentResponse.data.expiration_estimate_date,
      note: `Send ATLEAST ${minAmount} ${currency.toUpperCase()} or your deposit won't be credited.`
    });

  } catch (err) {
    console.error('Deposit error:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Payment processing failed',
      details: err.response?.data || err.message
    });
  }
});

app.post('/ipn-webhook', express.json(), async (req, res) => {
  const sig = req.headers['x-nowpayments-sig'];
  const expectedSig = crypto
    .createHmac('sha512', process.env.IPN_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (sig !== expectedSig) return res.status(403).send('Invalid signature');

  const { payment_status, actually_paid, pay_currency, order_id, payment_id } = req.body;

  if (payment_status === 'finished') {
    const steamId = order_id.split('_')[2];

    try {
      // Convert crypto to USD
      const estimateResponse = await nowpaymentsClient.get(
        `/estimate?amount=${actually_paid}&currency_from=${pay_currency}&currency_to=usd`
      );
      const usdAmount = parseFloat(estimateResponse.data.estimated_amount);

      // Update user balance
      const userRef = db.collection('users').doc(steamId);
      await userRef.update({
        balance: admin.firestore.FieldValue.increment(usdAmount),
        transactions: admin.firestore.FieldValue.arrayUnion({
          payment_id,
          crypto_amount: parseFloat(actually_paid),
          crypto_currency: pay_currency,
          usd_amount: usdAmount,
          date: new Date().toISOString(),
          status: 'completed'
        })
      });
    } catch (error) {
      console.error('IPN processing error:', error);
      return res.status(500).send('IPN processing failed');
    }
  }

  res.status(200).send('OK');
});

app.get('/supported-currencies', (req, res) => {
  res.json({
    currencies: supportedCurrencies.map(code => ({
      code,
      name: {
        btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana',
        ltc: 'Litecoin', bch: 'Bitcoin Cash',
        trx: 'Tron', doge: 'Dogecoin'
      }[code]
    }))
  });
});

// Serve home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// In-memory chat messages (VERY basic)
const chatMessages = [];
const lastChatTimestamps = {};

// Fetch latest chat messages
app.get('/chat/messages', (req, res) => {
  res.json(chatMessages.slice(-50)); // return last 50 messages
});

// Post new chat message
app.post('/chat/send', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const { message } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Empty message' });
  }

  const steamId = req.session.user.steamId;
  const now = Date.now();

  // Check if user is spamming (cooldown 3 seconds)
  if (lastChatTimestamps[steamId] && (now - lastChatTimestamps[steamId]) < 3000) {
    const waitTime = Math.ceil((3000 - (now - lastChatTimestamps[steamId])) / 1000);
    return res.status(429).json({ error: `Please wait ${waitTime} more seconds before sending another message.` });
  }

  lastChatTimestamps[steamId] = now; // Update last sent time

  const newMessage = {
    user: req.session.user.personaname,
    avatar: req.session.user.avatarfull,
    message: message.trim(),
    timestamp: now
  };

  chatMessages.push(newMessage);

  if (chatMessages.length > 100) {
    chatMessages.shift();
  }

  res.json({ success: true });
});



// Start server
app.listen(port, () => {
  console.log(`🟢 Server running at http://localhost:${port}`);
  console.log(`NowPayments API Key: ${process.env.NOWPAYMENTS_API_KEY ? '✔ Configured' : '✖ Missing'}`);
  console.log(`Webhook URL: ${process.env.WEBHOOK_URL || 'Not configured'}`);
  console.log(`IPN Secret: ${process.env.IPN_SECRET_KEY ? '✔ Configured' : '✖ Missing'}`);
}); 
