let lastChatTimestamps = {};
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
  
    fetch('/user')
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) {
          // Update balance
          document.getElementById('balance-amount').textContent = data.balance.toFixed(2);
          document.querySelector('.balance').classList.remove('hidden');
  
          // Update profile info
          document.getElementById('profile-btn-text').textContent = data.user.personaname;
          const avatar = document.getElementById('profile-avatar');
          avatar.src = data.user.avatarfull;
          avatar.style.display = 'inline-block';
  
          // Set dropdown content
          const dropdown = document.getElementById('profile-dropdown');
          dropdown.innerHTML = `
            <img src="${data.user.avatarfull}" style="width: 40px; border-radius: 50%; margin-bottom: 8px;" />
            <div style="color: #fff;">${data.user.personaname}</div>
            <a href="/logout" class="dropdown-link" style="margin-top: 10px;">Logout</a>
          `;
        } else {
          // Set login link dynamically with redirect
          const loginLink = document.getElementById('steam-login-link');
          if (loginLink) {
            loginLink.setAttribute('href', '/auth/steam?returnTo=' + encodeURIComponent(window.location.pathname));
          }
        }
      })
      .catch(err => console.error('Error fetching user data:', err));
      // Chat Functions
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

let canSendMessage = true; // New: track cooldown

async function sendMessage() {
  if (!canSendMessage) return; // Don't allow spamming

  const input = document.getElementById('chat-input');
  const sendBtn = document.querySelector('.chat-input-area button');
  const message = input.value.trim();
  if (!message) return;

    // Check if user is logged in
    const profileName = document.getElementById('profile-btn-text');
    if (profileName && profileName.textContent === "Login") {
      showError("You must be logged in to use the chat.");
      return;
    }


  try {
    // Immediately disable sending
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
    // Re-enable sending after 3 seconds
    setTimeout(() => {
      canSendMessage = true;
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
      sendBtn.style.cursor = "pointer";
    }, 2500);
  }
}


    // Allow Enter key to send message
    document.getElementById('chat-input').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault(); // Prevent line break
        sendMessage();
      }
    });


    // Start auto-fetching messages
    setInterval(fetchMessages, 3000);
    fetchMessages();

    // Chat close and reopen logic
    const chatContainer = document.getElementById('chat-container');
const topbarChatBtn = document.getElementById('topbar-chat-btn');
const closeBtn = document.getElementById('chat-close-btn');

// Hide chat
closeBtn.addEventListener('click', () => {
  chatContainer.classList.add('hidden');
  document.body.classList.add('chat-hidden');
});

// Show chat from top bar button
topbarChatBtn.addEventListener('click', () => {
  chatContainer.classList.remove('hidden');
  document.body.classList.remove('chat-hidden');
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