const chatbox = document.getElementById('chatbox');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
let isFirstMessage = true;
let conversationHistory = [];
let chatStarted = false;

// ✅ CONFIGURAÇÃO DA API - CORRIGIDA PARA VERCEL
const API_CONFIG = {
  // Detectar automaticamente a URL da API
  baseURL: (() => {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:3000'; // Desenvolvimento local
    } else if (window.location.hostname.includes('vercel.app')) {
      // Substituir pela URL real da sua API no Vercel
      return 'https://sua-api-prodai.vercel.app'; // ← ALTERE AQUI
    } else {
      return window.location.origin; // Fallback
    }
  })(),
  
  // Endpoint completo
  get chatEndpoint() {
    return `${this.baseURL}/api/chat`;
  }
};

console.log('🔗 API configurada para:', API_CONFIG.chatEndpoint);

function waitForFirebase() {
  return new Promise((resolve) => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      resolve();
    } else {
      const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          clearInterval(checkFirebase);
          resolve();
        }
      }, 100);
    }
  });
}

async function sendFirstMessage() {
  const startInput = document.getElementById('start-input');
  const startSendBtn = document.getElementById('startSendBtn');

  if (!startInput) {
    console.error('Input inicial não encontrado');
    return;
  }

  const message = startInput.value.trim();
  if (!message) {
    startInput.focus();
    return;
  }

  console.log('Enviando primeira mensagem:', message);

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
    console.error('Erro ao enviar primeira mensagem:', error);
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

  if (!startScreen) {
    console.log('StartScreen não encontrado');
    return;
  }

  console.log('Iniciando animação para chat');

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

function animateStart() {
  const header = document.getElementById('prodaiHeader');
  const container = document.getElementById('chatContainer');
  if (header) header.classList.add('moved-to-top');
  if (container) container.classList.add('expanded');
}

function appendMessage(content, className) {
  const chatboxEl = document.getElementById('chatbox');
  if (!chatboxEl) {
    console.error('Chatbox não encontrado');
    return;
  }

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

// ✅ FUNÇÃO PROCESSAMENTO DE MENSAGEM - CORRIGIDA
async function processMessage(message) {
  const mainSendBtn = document.getElementById('sendBtn');
  if (mainSendBtn && chatStarted) {
    mainSendBtn.disabled = true;
    mainSendBtn.innerHTML = 'Enviando...';
  }

  showTypingIndicator();

  try {
    await waitForFirebase();
    const user = firebase.auth().currentUser;
    if (!user) {
      appendMessage(`<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`, 'bot');
      hideTypingIndicator();
      if (mainSendBtn && chatStarted) {
        mainSendBtn.disabled = false;
        mainSendBtn.innerHTML = 'Enviar';
      }
      return;
    }

    const idToken = await user.getIdToken();

    console.log('🔗 Enviando para:', API_CONFIG.chatEndpoint);

    // ✅ REQUISIÇÃO CORRIGIDA COM URL ABSOLUTA
    const response = await fetch(API_CONFIG.chatEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` // Adicionar header de auth
      },
      body: JSON.stringify({ 
        message, 
        conversationHistory, 
        idToken 
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers));

    let data;
    if (response.ok) {
      const rawText = await response.text();
      console.log('📄 Raw response:', rawText.substring(0, 200) + '...');
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error('❌ Erro ao parsear JSON:', parseError);
        data = { error: 'Erro ao processar resposta do servidor' };
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Erro HTTP:', response.status, errorText);
      
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
    console.error('💥 Erro na requisição:', err);
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

// ✅ FUNÇÃO DE DEBUG MELHORADA
function debugVercel() {
  console.log('=== DEBUG VERCEL ===');
  console.log('🌐 Location:', window.location.href);
  console.log('🔗 API Endpoint:', API_CONFIG.chatEndpoint);
  console.log('🔥 Firebase loaded:', typeof firebase !== 'undefined');
  console.log('🔒 Auth available:', typeof firebase !== 'undefined' && firebase.auth);
  console.log('👤 Current user:', firebase?.auth()?.currentUser?.uid || 'None');
  console.log('📝 Start input:', !!document.getElementById('start-input'));
  console.log('🚀 Start button:', !!document.getElementById('startSendBtn'));
  console.log('💬 User input:', !!document.getElementById('user-input'));
  console.log('📤 Send button:', !!document.getElementById('sendBtn'));
  console.log('📺 Chatbox:', !!document.getElementById('chatbox'));
  console.log('=================');
}

// ✅ TESTE DE CONECTIVIDADE DA API
async function testAPIConnection() {
  try {
    console.log('🧪 Testando conexão com API...');
    const response = await fetch(API_CONFIG.chatEndpoint, {
      method: 'OPTIONS'
    });
    console.log('✅ API acessível:', response.status);
  } catch (error) {
    console.error('❌ API inacessível:', error.message);
    console.log('💡 Verifique se a URL da API está correta em API_CONFIG.baseURL');
  }
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

// Expor funções globalmente
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

// Debug automático
setTimeout(() => {
  debugVercel();
  testAPIConnection();
}, 1000);