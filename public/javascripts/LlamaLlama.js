let isDemoSpin = false;

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

  // Trigger a reflow to apply the reset immediately
  void errorTimer.offsetWidth;

  // Now animate the bar shrinking
  errorTimer.style.transition = 'transform 3s linear';
  errorTimer.style.transform = 'scaleX(0)';

  setTimeout(() => {
    errorBox.style.opacity = '0';
    setTimeout(() => {
      errorBox.classList.add('hidden');
    }, 300);
  }, 3000);
}



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


function updateBalance() {
fetch('/user')
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        document.getElementById('balance-amount').textContent = data.balance.toFixed(2);
        document.querySelector('.balance').classList.remove('hidden');

        document.getElementById('profile-btn-text').textContent = data.user.personaname;
        const avatar = document.getElementById('profile-avatar');
        avatar.src = data.user.avatarfull;
        avatar.style.display = 'inline-block';

        const dropdown = document.getElementById('profile-dropdown');
        dropdown.innerHTML = `
          <img src="${data.user.avatarfull}" style="width: 40px; border-radius: 50%; margin-bottom: 8px;" />
          <div style="color: #fff;">${data.user.personaname}</div>
          <a href="/logout" class="dropdown-link" style="margin-top: 10px;">Logout</a>
        `;
      } else {
        const loginLink = document.getElementById('steam-login-link');
        if (loginLink) {
          loginLink.setAttribute('href', '/auth/steam?returnTo=' + encodeURIComponent(window.location.pathname));
        }
      }

      document.getElementById('topbar-content').style.visibility = 'visible';
    })
    .catch(err => console.error('Error fetching user data:', err));
}


fetch('/user')
  .then(res => res.json())
  .then(data => {
    if (data.loggedIn) {
      document.getElementById('balance-amount').textContent = data.balance.toFixed(2);
      document.querySelector('.balance').classList.remove('hidden');

      document.getElementById('profile-btn-text').textContent = data.user.personaname;
      const avatar = document.getElementById('profile-avatar');
      avatar.src = data.user.avatarfull;
      avatar.style.display = 'inline-block';

      const dropdown = document.getElementById('profile-dropdown');
      dropdown.innerHTML = `
        <img src="${data.user.avatarfull}" style="width: 40px; border-radius: 50%; margin-bottom: 8px;" />
        <div style="color: #fff;">${data.user.personaname}</div>
        <a href="/logout" class="dropdown-link" style="margin-top: 10px;">Logout</a>
      `;
    } else {
      const loginLink = document.getElementById('steam-login-link');
      if (loginLink) {
        loginLink.setAttribute('href', '/auth/steam?returnTo=' + encodeURIComponent(window.location.pathname));
      }
    }

    document.getElementById('topbar-content').style.visibility = 'visible';
  })
  .catch(err => console.error('Error fetching user data:', err));

  const caseValue = 0.69;

  const reel = document.getElementById("reel");
  const spinButton = document.getElementById("spinButton");
  const resultBox = document.getElementById("resultBox");
  const resultHeader = document.getElementById("resultHeader");
  const resultName = document.getElementById("resultName");
  const resultValue = document.getElementById("resultValue");

  let pendingReward = null;

  // Audio setup
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let tickBuffer = null;
  let tickTimeout = null;
  let winSoundBuffer = null;

  // Load win sound
  fetch('../assets/WinSound.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {
      winSoundBuffer = decodedAudio;
    })
    .catch(error => {
      console.error('Error loading win sound:', error);
    });

  function playWinSound() {
    if (!winSoundBuffer) return;

    const winSource = audioContext.createBufferSource();
    winSource.buffer = winSoundBuffer;
    winSource.connect(audioContext.destination);
    winSource.start();
  }

  // Load tick sound
  fetch('../assets/tick.wav')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {
      tickBuffer = decodedAudio;
    })
    .catch(error => {
      console.error('Error loading audio:', error);
    });

  function playTick() {
    if (!tickBuffer) return;
    
    const tickSource = audioContext.createBufferSource();
    tickSource.buffer = tickBuffer;
    tickSource.connect(audioContext.destination);
    tickSource.start();
  }

  const guns = [ 
    { name: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopL-zJAt21uH3di59_oSJmIyKmvb3MrXfmWVu5Mx2gv2P9NmjilHg-BJra2D6Io_DIAA3aF7Y_AS3kL_rgpO4tZ_PnSBmvSV3t2GdwUI-SpsoZA/360fx360f', label: 'Llama Cannon', wear: 'FN', price: 36.08, gems: 36.08, type: 'StatTrak™ R8 Revolver', weight: 1 },
    { name: '../assets/LlamaSticker.png', label: 'Llama Cannon Sticker', wear: 'Item', price: 0.27, gems: 0.27, type: 'Sticker', weight: 99 },
  ];

  const rewards = [
    { value: "0.27", weight: 99 },
    { value: "36.08", weight: 1 }
  ];

  const imageWidth = 100;
  let isSpinning = false;

  function getGlowClass(gun) {
    if (gun.label === 'Llama Cannon Sticker') return 'glow-grey';
    if (gun.label === 'Llama Cannon') return 'glow-yellow';
    return '';
  }

  function getWeightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const rand = Math.random() * totalWeight;
    let current = 0;
    for (const item of items) {
      current += item.weight;
      if (rand <= current) return item;
    }
  }

  function getRandomReward() {
    return getWeightedRandom(rewards).value;
  }

  function getRandomGunForDisplay() {
    return getWeightedRandom(guns);
  }


  function startTickSound(duration) {
    // Clear any existing timeout
    if (tickTimeout) {
      clearTimeout(tickTimeout);
    }

    const startTime = Date.now();
    const slowdownStartTime = 600;
    const maxInterval = 1900;
    
    // Initial fast tick interval (80ms)
    let currentInterval = 80;
    let lastTickTime = startTime;

    function scheduleNextTick() {
      const now = Date.now();
      const elapsed = now - startTime;
      
      if (elapsed >= duration) {
        // Play one final tick at the end
        playTick();
        return;
      }

      // Calculate dynamic interval
      if (elapsed > slowdownStartTime) {
        // Gradual slowdown - increases interval based on progress through slowdown period
        const slowdownProgress = (elapsed - slowdownStartTime) / (duration - slowdownStartTime);
        // Use exponential easing for more natural slowdown
        currentInterval = 80 + (maxInterval - 80) * Math.pow(slowdownProgress, 1.5);
      }

      // Calculate when next tick should occur
      const nextTickTime = lastTickTime + currentInterval;
      const delay = Math.max(0, nextTickTime - now);

      tickTimeout = setTimeout(() => {
        playTick();
        lastTickTime = Date.now();
        scheduleNextTick();
      }, delay);
    }

    // Start with immediate tick
    playTick();
    scheduleNextTick();
  }

  let lastTickX = 0;
  let ticking = false;

  let lastItemIndex = 0;

  function monitorTicks() {
    if (!isSpinning) return;

    const style = window.getComputedStyle(reel);
    const matrix = style.transform;

    if (matrix && matrix !== 'none') {
      const translateX = parseFloat(matrix.split(',')[4]);

      // Center of visible window is 500px / 2 = 250px
      const visibleCenter = 250;
      const centerOffset = Math.abs(translateX) + visibleCenter;
      const itemIndex = Math.floor(centerOffset / imageWidth);

      if (itemIndex !== lastItemIndex) {
        playTick();
        lastItemIndex = itemIndex;
      }
    }

    requestAnimationFrame(monitorTicks);
  }



  function startSpin() {
    isDemoSpin = false;
    if (isSpinning) return;

    isSpinning = true; // ✅ lock immediately
    spinButton.disabled = true;
    demoSpinButton.disabled = true;
// ✅ disable button immediately

    fetch('/open-case/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: caseValue })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          updateBalance();
          doActualSpin();
        } else {
          showError(data.error);
          isSpinning = false; // ✅ unlock if error
          spinButton.disabled = false; // ✅ re-enable button if error
        }
      })
      .catch(err => {
        console.error('Error starting case:', err);
        showError('Could not start case.');
        isSpinning = false; // ✅ unlock if fetch error
        spinButton.disabled = false; // ✅ re-enable button if fetch error
      });
  }


  function doActualSpin(isDemo = false){
    isSpinning = true;
    spinButton.disabled = true;
    resultBox.style.display = "none";
    reel.innerHTML = "";

    const resultGun = getWeightedRandom(guns);
    const rewardValue = getRandomReward();
    pendingReward = resultGun.gems;
    const spinLength = 50;
    const spinDuration = 6000 + Math.random() * 2000;

    // Start the tick sound effect with new timing
    lastTickX = 0;
    ticking = true;
    requestAnimationFrame(monitorTicks);


    for (let i = 0; i < spinLength; i++) {
      const g = getRandomGunForDisplay();
      const img = document.createElement("img");
      img.src = g.name;
      img.alt = g.label;
      img.classList.add(getGlowClass(g));
      reel.appendChild(img);
    }

    const resultImg = document.createElement("img");
    resultImg.src = resultGun.name;
    resultImg.alt = resultGun.label;
    resultImg.classList.add(getGlowClass(resultGun));
    reel.appendChild(resultImg);

    for (let i = 0; i < 5; i++) {
      const g = getRandomGunForDisplay();
      const img = document.createElement("img");
      img.src = g.name;
      img.alt = g.label;
      img.classList.add(getGlowClass(g));
      reel.appendChild(img);
    }

    reel.style.transition = "none";
    reel.style.transform = "translateX(0)";
    void reel.offsetWidth;

    const randomOffset = Math.floor(Math.random() * 99) + 1;
    const totalOffset = (spinLength * imageWidth) - (2 * imageWidth + 50) + randomOffset;

    setTimeout(() => {
      reel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
      reel.style.transform = `translateX(-${totalOffset}px)`;
    }, 50);

    setTimeout(() => {
      const diff = randomOffset - 50;
      const bounceAdjustment = diff;

      setTimeout(() => {
        reel.style.transition = "transform 300ms ease-out";
        reel.style.transform = `translateX(-${totalOffset - bounceAdjustment}px)`;
      }, 100);

      setTimeout(() => {
        resultHeader.textContent = `${resultGun.type} | ${resultGun.wear}`;
        resultName.textContent = resultGun.label;
        resultValue.innerHTML = `${resultGun.gems.toFixed(2)} <i class="fas fa-gem"></i>`;

        if (resultGun.weight <= 10) {
          resultName.classList.add("rare");
        } else {
          resultName.classList.remove("rare");
        }

        resultBox.classList.remove("flash-animation", "rainbow-border");
        resultHeader.classList.remove("flash-animation", "rainbow-border");

        resultBox.style.borderColor = "#FFD700";
        resultHeader.style.borderColor = "#FFD700";

        resultBox.classList.remove("flash-animation", "rainbow-border");
        resultHeader.classList.remove("flash-animation", "rainbow-border");

        if (['Llama Cannon'].includes(resultGun.label)) {
          // GOLD pull (rare M4A1-S Black Lotus or Leaded Glass)
          resultBox.classList.add("rainbow-border");
          resultHeader.classList.add("rainbow-border");
        } else {
          // Grey pull (Wash me plz or cheap skins)
          resultBox.style.borderColor = "grey";
          resultHeader.style.borderColor = "grey";
          resultBox.classList.add("flash-animation");
          resultHeader.classList.add("flash-animation");
        }


        resultBox.style.display = "block";
        resultHeader.style.display = "block";

        // ➕ Add gem reward after result shows
        if (!isDemo) {
        fetch('/open-case/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ gems: resultGun.gems })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              updateBalance(); // show updated balance after reward
              pendingReward = null;
            } else {
              console.error('Failed to credit gems:', data.error);
            }
          })
          .catch(err => {
            console.error('Error crediting gems:', err);
          });
        }

        setTimeout(() => {
          resultBox.classList.remove("flash-animation");
          resultHeader.classList.remove("flash-animation");
        }, 1000);

        playWinSound(); // Play win sound no matter what

        setTimeout(() => {
          isSpinning = false;
          spinButton.disabled = false;
          demoSpinButton.disabled = false;
        }, 1500);

      }, 500);
    }, spinDuration);
  }

  spinButton.addEventListener("click", startSpin);
  const demoSpinButton = document.getElementById("demoSpinButton");
  demoSpinButton.addEventListener("click", startDemoSpin);

  function startDemoSpin() {
    isDemoSpin = true;
    if (isSpinning) return;

    isSpinning = true;
    spinButton.disabled = true;
    demoSpinButton.disabled = true;

    doActualSpin(true); // Pass true to tell it "this is a demo spin"
  }


  for (let i = 0; i < 10; i++) {
    const g = getRandomGunForDisplay();
    const img = document.createElement("img");
    img.src = g.name;
    img.alt = g.label;
    img.classList.add(getGlowClass(g));
    reel.appendChild(img);
  }

  updateBalance();
  setInterval(updateBalance, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isSpinning) {
      updateBalance();
    }
  });


  window.addEventListener('beforeunload', function () {
    if (pendingReward !== null && !isDemoSpin) {
      const json = JSON.stringify({ gems: pendingReward });
      const blob = new Blob([json], { type: 'application/json' });
      navigator.sendBeacon('/open-case/complete', blob);
    }
  });

  let canSendMessage = true;

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
  
  async function sendMessage() {
    if (!canSendMessage) return;
  
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
  
    canSendMessage = false;
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.5";
    sendBtn.style.cursor = "not-allowed";
  
    try {
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
      }, 2500); // cooldown before allowing next message
    }
  }
  
  document.getElementById('chat-input').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  });
  
  // Start auto-fetching messages
  setInterval(fetchMessages, 3000);
  fetchMessages();
  
  // Chat open/close logic
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
  
  // For inline onclick="sendMessage()"
  window.sendMessage = sendMessage;
  