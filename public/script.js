const chatbox = document.getElementById('chatbox');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
let isFirstMessage = true;
let conversationHistory = [];
let chatStarted = false;

// ✅ CONFIGURAÇÃO DA API - Altere a URL aqui
const API_CONFIG = {
  baseURL: (() => {
    if (window.location.hostname === 'localhost') {
      return 'https://prod-ai-teste.vercel.app/api';
    } else if (window.location.hostname.includes('vercel.app')) {
      return 'https://prod-ai-teste.vercel.app/api'; 
    } else {
      return window.location.origin;
    }
  })(),

  get chatEndpoint() {
    return `${this.baseURL}/chat`;
  }
};

console.log('🔗 API configurada para:', API_CONFIG.chatEndpoint);

function waitForFirebase() {
  return new Promise((resolve) => {
    const checkFirebase = () => {
      if (window.auth && window.firebaseReady) {
        resolve();
      } else {
        setTimeout(checkFirebase, 100);
      }
    };
    checkFirebase();
  });
}

async function sendFirstMessage() {
  const startInput = document.getElementById('start-input');
  const startSendBtn = document.getElementById('startSendBtn');

  if (!startInput) return;

  const message = startInput.value.trim();
  if (!message) {
    startInput.focus();
    return;
  }

  if (startSendBtn) {
    startSendBtn.disabled = true;
    startInput.disabled = true;
    startSendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  }

  try {
    await waitForFirebase();

    if (!chatStarted) {
      await animateToChat();
      chatStarted = true;
    }

    input.value = message;
    await sendMessage();

  } catch (error) {
    appendMessage(`<strong>Assistente:</strong> ❌ Erro ao enviar mensagem. Tente novamente.`, 'bot');
  } finally {
    if (startSendBtn) {
      startSendBtn.disabled = false;
      startInput.disabled = false;
      startSendBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m22 2-7 20-4-9-9-4Z"/>
          <path d="M22 2 11 13"/>
        </svg>`;
    }
  }
}

async function animateToChat() {
  const startScreen = document.getElementById('startScreen');
  const startHeader = document.getElementById('startHeader');
  const motivationalText = document.getElementById('motivationalText');
  const startInputContainer = document.getElementById('startInputContainer');
  const mainHeader = document.getElementById('mainHeader');
  const chatContainer = document.getElementById('chatContainer');
  const mainFooter = document.getElementById('mainFooter');

  if (!startScreen) return;

  if (motivationalText) motivationalText.classList.add('fade-out');
  if (startInputContainer) startInputContainer.classList.add('fade-out');

  setTimeout(() => {
    if (startHeader) startHeader.classList.add('animate-to-top');
  }, 200);

  setTimeout(() => {
    if (startScreen) startScreen.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'block';
    if (chatContainer) chatContainer.style.display = 'block';
    if (mainFooter) mainFooter.style.display = 'block';

    setTimeout(() => {
      if (chatContainer) chatContainer.classList.add('expanded');
      if (mainHeader) mainHeader.classList.add('header-visible');
      if (mainFooter) mainFooter.classList.add('footer-visible');

      const mainInput = document.getElementById('user-input');
      if (mainInput) mainInput.focus();
    }, 50);
  }, 500);
}

function appendMessage(content, className) {
  const chatboxEl = document.getElementById('chatbox');
  if (!chatboxEl) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${className}`;
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = content.replace(/\n/g, '<br>');
  messageDiv.appendChild(messageContent);
  chatboxEl.appendChild(messageDiv);
  chatboxEl.scrollTop = chatboxEl.scrollHeight;
}

function showTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.style.display = 'flex';
    if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
  }
}

function hideTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.style.display = 'none';
  }
}

async function processMessage(message) {
  const mainSendBtn = document.getElementById('sendBtn');
  if (mainSendBtn && chatStarted) {
    mainSendBtn.disabled = true;
    mainSendBtn.innerHTML = 'Enviando...';
  }

  showTypingIndicator();

  try {
    await waitForFirebase();
    const currentUser = window.auth.currentUser;
    if (!currentUser) {
      appendMessage(`<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`, 'bot');
      hideTypingIndicator();
      if (mainSendBtn && chatStarted) {
        mainSendBtn.disabled = false;
        mainSendBtn.innerHTML = 'Enviar';
      }
      return;
    }

    const idToken = await currentUser.getIdToken();

    const response = await fetch(API_CONFIG.chatEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ 
        message, 
        conversationHistory, 
        idToken 
      })
    });

    let data;
    if (response.ok) {
      const rawText = await response.text();
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        data = { error: 'Erro ao processar resposta do servidor' };
      }
    } else {
      const errorText = await response.text();
      if (response.status === 403) {
        data = { error: 'limite diário' };
      } else if (response.status === 401) {
        data = { error: 'Token de autenticação inválido' };
      } else if (response.status === 404) {
        data = { error: 'API não encontrada. Verifique a configuração.' };
      } else {
        data = { error: 'Erro do servidor' };
      }
    }

    hideTypingIndicator();

    if (data.error && data.error.toLowerCase().includes('limite diário')) {
      appendMessage(
        `<strong>Assistente:</strong> 🚫 Você atingiu o limite de <strong>10 mensagens diárias</strong>.<br><br>` +
        `🔓 <a href="planos.html" class="btn-plus" target="_blank">Assinar versão Plus</a>`,
        'bot'
      );
    } else if (data.error && data.error.includes('API não encontrada')) {
      appendMessage(
        `<strong>Assistente:</strong> ⚙️ Sistema em configuração. Tente novamente em alguns minutos.`,
        'bot'
      );
    } else if (data.error && data.error.includes('Token')) {
      appendMessage(
        `<strong>Assistente:</strong> 🔒 Sessão expirada. <a href="login.html">Faça login novamente</a>.`,
        'bot'
      );
    } else if (data.reply) {
      appendMessage(`<strong>Assistente:</strong> ${data.reply}`, 'bot');
      conversationHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendMessage(
        `<strong>Assistente:</strong> ❌ Erro: ${data.error || 'Erro inesperado'}.`,
        'bot'
      );
    }
  } catch (err) {
    hideTypingIndicator();
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      appendMessage(
        `<strong>Assistente:</strong> 🌐 Erro de conexão. Verifique sua internet e tente novamente.`,
        'bot'
      );
    } else {
      appendMessage(
        `<strong>Assistente:</strong> ❌ Erro ao se conectar com o servidor.`,
        'bot'
      );
    }
  } finally {
    if (mainSendBtn && chatStarted) {
      mainSendBtn.disabled = false;
      mainSendBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
        </svg>
        Enviar`;
    }
  }
}

async function sendMessage() {
  const message = input?.value?.trim();
  if (!message || (sendBtn && sendBtn.disabled)) return;

  if (!chatStarted) {
    await animateToChat();
    chatStarted = true;
    isFirstMessage = false;
  }

  appendMessage(`<strong>Você:</strong> ${message}`, 'user');
  if (input) input.value = '';
  if (input) input.focus();
  conversationHistory.push({ role: 'user', content: message });

  await processMessage(message);
}

function setupEventListeners() {
  const startInput = document.getElementById('start-input');
  const startSendBtn = document.getElementById('startSendBtn');

  if (startInput) {
    startInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendFirstMessage();
      }
    });
    startInput.focus();
  }

  if (startSendBtn) {
    startSendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendFirstMessage();
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage();
    });
  }
}

async function testAPIConnection() {
  try {
    const response = await fetch(API_CONFIG.chatEndpoint, {
      method: 'OPTIONS'
    });
  } catch (error) {}
}

function debugVercel() {
  console.log('=== DEBUG VERCEL ===');
  console.log('🌐 Location:', window.location.href);
  console.log('🔗 API Endpoint:', API_CONFIG.chatEndpoint);
  console.log('🔥 Auth loaded:', !!window.auth);
  console.log('🔥 Firebase ready:', window.firebaseReady);
  console.log('👤 Current user:', window.auth?.currentUser?.uid || 'None');
  console.log('📝 Start input:', !!document.getElementById('start-input'));
  console.log('🚀 Start button:', !!document.getElementById('startSendBtn'));
  console.log('💬 User input:', !!document.getElementById('user-input'));
  console.log('📤 Send button:', !!document.getElementById('sendBtn'));
  console.log('📺 Chatbox:', !!document.getElementById('chatbox'));
  console.log('=================');
}

function initializeApp() {
  setTimeout(() => {
    setupEventListeners();

    const isLoginPage = window.location.pathname.includes("login.html");
    if (isLoginPage) return;

    const startInputEl = document.getElementById('start-input');
    if (startInputEl) startInputEl.focus();
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

window.sendFirstMessage = sendFirstMessage;
window.sendMessage = sendMessage;
window.testAPIConnection = testAPIConnection;

document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('focus', () => {
      if (!phoneInput.value.trim().startsWith('+55')) {
        phoneInput.value = '+55';
        setTimeout(() => {
          phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
        }, 1);
      }
    });
    phoneInput.addEventListener('blur', () => {
      if (phoneInput.value.trim() === '+55') {
        phoneInput.value = '';
      }
    });
  }

  if (typeof initializeApp === 'function') {
    setTimeout(initializeApp, 200);
  }
});

setTimeout(() => {
  debugVercel();
  testAPIConnection();
}, 1000);