    function toggleDropdown() {
      const dropdown = document.getElementById('profile-dropdown');
      dropdown.classList.toggle('hidden');
    }

    document.addEventListener('click', function (e) {
      const container = document.querySelector('.profile-dropdown-container');
      const dropdown = document.getElementById('profile-dropdown');
      if (!container.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    
    function showError(message) {
      const errorBox = document.getElementById('errorBox');
      const errorMessage = document.getElementById('errorMessage');
      const errorTimer = document.getElementById('errorTimer');
    
      errorMessage.textContent = message;
      errorBox.classList.remove('hidden');
      errorBox.style.opacity = '1';
    
      // Reset the timer bar instantly
      errorTimer.style.transition = 'none';
      errorTimer.style.transform = 'scaleX(1)';
      void errorTimer.offsetWidth; // force reflow
    
      // Animate shrink over 5 seconds
      errorTimer.style.transition = 'transform 3s linear';
      errorTimer.style.transform = 'scaleX(0)';
    
      setTimeout(() => {
        errorBox.style.opacity = '0';
        setTimeout(() => {
          errorBox.classList.add('hidden');
        }, 300);
      }, 3000); // <-- stays visible for 5 seconds
    }

    // Deposit functionality
    document.addEventListener('DOMContentLoaded', () => {
        // Load user data
        fetch('/user')
        .then(res => res.json())
        .then(data => {
          if (!data.loggedIn) {
            // Set Steam login link dynamically
            const loginLink = document.getElementById('steam-login-link');
            if (loginLink) {
              loginLink.setAttribute('href', '/auth/steam?returnTo=' + encodeURIComponent(window.location.pathname));
            }
            return;
          }          
  
          // ✅ Update balance
          document.getElementById('balance-amount').textContent = data.balance.toFixed(2);
          document.querySelector('.balance').classList.remove('hidden');
  
          // ✅ Update profile info (username and avatar)
          const profileBtnText = document.getElementById('profile-btn-text');
          profileBtnText.textContent = data.user.personaname;
  
          const avatar = document.getElementById('profile-avatar');
          avatar.src = data.user.avatarfull;
          avatar.style.display = 'inline-block';
          avatar.dataset.steamid = data.user.steamId;

          const dropdown = document.getElementById('profile-dropdown');
          dropdown.innerHTML = `
            <img src="${data.user.avatarfull}" style="width: 40px; border-radius: 50%; margin-bottom: 8px;" />
            <div style="color: #fff;">${data.user.personaname}</div>
            <a href="/logout" class="dropdown-link" style="margin-top: 10px;">Logout</a>
          `;
        })
        .catch(err => {
          console.error('Error fetching user data:', err);
        });
  
  
          
        // Deposit button click
        document.getElementById('deposit-btn').addEventListener('click', () => {
          document.getElementById('currency-modal').style.display = 'flex';
          
          // Load supported currencies if not already loaded
          if (!document.querySelector('.currency-btn')) {
            fetch('/supported-currencies')
              .then(res => res.json())
              .then(data => {
                const grid = document.getElementById('currency-grid');
                data.currencies.forEach(currency => {
                  const btn = document.createElement('button');
                  btn.className = 'currency-btn';
                  btn.textContent = `${currency.name} (${currency.code.toUpperCase()})`;
                  btn.addEventListener('click', () => selectCurrency(currency.code));
                  grid.appendChild(btn);
                });
              });
          }
        });
        
        // Close modals
        document.getElementById('close-currency-modal').addEventListener('click', () => {
          document.getElementById('currency-modal').style.display = 'none';
        });
        
        document.getElementById('close-payment-modal').addEventListener('click', () => {
          document.getElementById('payment-modal').style.display = 'none';
        });
        
        // Copy button
        document.getElementById('copy-btn').addEventListener('click', () => {
          const address = document.getElementById('payment-address').textContent;
          navigator.clipboard.writeText(address)
            .then(() => {
              const btn = document.getElementById('copy-btn');
              btn.textContent = 'Copied!';
              setTimeout(() => {
                btn.textContent = 'Copy Address';
              }, 2000);
            });
        });
      });
      
  function selectCurrency(currency) {
    document.getElementById('currency-modal').style.display = 'none';
    document.getElementById('loading').style.display = 'flex';
  
    const steamId = document.querySelector('#profile-avatar').dataset.steamid;
    const orderId = `deposit_${Date.now()}_${steamId}`;
  
    fetch('/create-deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderId, currency })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          const details = typeof data.details === 'object' 
            ? JSON.stringify(data.details, null, 2)
            : data.details;
          showError(`${data.error}\n${details || ''}`);
          return;
        }
  
        document.getElementById('payment-title').textContent = `Deposit ${data.pay_currency.toUpperCase()}`;
        // Include the exact amount in the QR code URI
        document.getElementById('qr-code').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data.pay_currency}:${data.pay_address}?amount=${data.pay_amount}`;
        document.getElementById('payment-address').textContent = data.pay_address;
        document.getElementById('payment-note').textContent = `Send exactly ${data.pay_amount} ${data.pay_currency.toUpperCase()} (≈ $${data.price_amount} USD)`;
        document.getElementById('payment-modal').style.display = 'flex';
      })
      .catch(err => {
        showError('Failed to create deposit');
        console.error(err);
      })
      .finally(() => {
        document.getElementById('loading').style.display = 'none';
      });
  }
      // Chat: Fetch messages
async function fetchMessages() {
  try {
    const res = await fetch('/chat/messages');
    const messages = await res.json();

    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';

    messages.forEach(msg => {
      const messageElement = document.createElement('div');
      messageElement.innerHTML = `
        <div style="margin-bottom:8px;">
          <img src="${msg.avatar}" style="width:20px; height:20px; border-radius:50%; vertical-align:middle; margin-right:5px;">
          <strong style="color:#ffcc00;">${msg.user}</strong>: 
          <span style="color:#ccc;">${msg.message}</span>
        </div>
      `;
      chatBox.appendChild(messageElement);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    console.error('Error fetching chat messages:', err);
  }
}

let canSendMessage = true;

async function sendMessage() {
  if (!canSendMessage) return;

  const input = document.getElementById('chat-input');
  const sendBtn = document.querySelector('.chat-input-area button');
  const message = input.value.trim();
  if (!message) return;

  const profileName = document.getElementById('profile-btn-text');
  if (profileName && profileName.textContent === "Login") {
    showError("You must be logged in to use the chat.");
    return;
  }

  try {
    canSendMessage = false;
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.5";
    sendBtn.style.cursor = "not-allowed";

    const res = await fetch('/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (res.ok) {
      input.value = '';
      fetchMessages();
    } else {
      console.error('Failed to send message');
    }
  } catch (err) {
    console.error('Error sending chat message:', err);
  } finally {
    setTimeout(() => {
      canSendMessage = true;
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
      sendBtn.style.cursor = "pointer";
    }, 2500);
  }
}

document.getElementById('chat-input').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
});

const chatContainer = document.getElementById('chat-container');
const topbarChatBtn = document.getElementById('topbar-chat-btn');
const closeBtn = document.getElementById('chat-close-btn');

closeBtn.addEventListener('click', () => {
  chatContainer.classList.add('hidden');
  document.body.classList.add('chat-hidden');
});

topbarChatBtn?.addEventListener('click', () => {
  chatContainer.classList.remove('hidden');
  document.body.classList.remove('chat-hidden');
});

setInterval(fetchMessages, 3000);
fetchMessages();

