/* ============ VARIÁVEIS GLOBAIS (Sistema Antigo) ============ */
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
let isFirstMessage = true;
let conversationHistory = [];
let chatStarted = false;

/* ============ VARIÁVEIS GLOBAIS (Visual Novo) ============ */
let vantaEffect = null;
let isDesktop = window.innerWidth > 768;

/* ============ CONFIGURAÇÃO DA API (Sistema Antigo) ============ */
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

/* ============ INICIALIZAÇÃO DO VANTA BACKGROUND (Visual Novo) ============ */
function initVantaBackground() {
    try {
        if (typeof VANTA !== 'undefined' && typeof THREE !== 'undefined') {
            vantaEffect = VANTA.NET({
                el: "#vanta-bg",
                mouseControls: true,
                touchControls: true,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0x8a2be2,
                backgroundColor: 0x0a0a1a,
                points: isDesktop ? 8.00 : 4.00,
                maxDistance: isDesktop ? 25.00 : 15.00,
                spacing: isDesktop ? 18.00 : 25.00,
                showDots: true
            });
            console.log('✅ Vanta.js carregado com sucesso');
        } else {
            console.warn('⚠️ Vanta.js ou THREE.js não encontrados, usando fallback');
        }
    } catch (error) {
        console.warn('⚠️ Erro ao carregar Vanta.js:', error);
    }
}

/* ============ EFEITOS DE HOVER (Visual Novo) ============ */
function initHoverEffects() {
    const elements = [
        { selector: '.robo', scale: 1.03, glow: 40 },
        { selector: '.notebook', scale: 1.06, glow: 30 },
        { selector: '.teclado', scale: 1.05, glow: 25 },
        { selector: '.caixas', scale: 1.04, glow: 35 },
        { selector: '.mesa', scale: 1.01, glow: 25 }
    ];
    
    elements.forEach(({ selector, scale }) => {
        const element = document.querySelector(selector);
        if (!element) return;
        
        element.addEventListener('mouseenter', () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(element, {
                    scale: scale,
                    y: selector !== '.mesa' ? -8 : 0,
                    duration: 0.2,
                    ease: "back.out(1.7)"
                });
            }
        });
        
        element.addEventListener('mouseleave', () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(element, {
                    scale: 1,
                    y: 0,
                    duration: 0.2,
                    ease: "back.out(1.7)"
                });
            }
        });
    });
}

/* ============ OTIMIZAÇÕES MOBILE (Visual Novo) ============ */
function optimizeForMobile() {
    if (!isDesktop) {
        const style = document.createElement('style');
        style.textContent = `
            .robo, .notebook, .teclado, .caixas, .mesa {
                animation: none !important;
                filter: none !important;
            }
            .particles-overlay {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        console.log('📱 Otimizações mobile aplicadas');
    }
}

/* ============ REDIMENSIONAMENTO (Visual Novo) ============ */
function handleResize() {
    const newIsDesktop = window.innerWidth > 768;
    
    if (newIsDesktop !== isDesktop) {
        isDesktop = newIsDesktop;
        
        if (vantaEffect) {
            vantaEffect.destroy();
            setTimeout(initVantaBackground, 50);
        }
        
        optimizeForMobile();
    }
}

/* ============ FUNÇÕES DO SISTEMA ANTIGO ============ */
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
    startSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
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
      startSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
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
  const container = document.getElementById('chatbotContainer');

  if (!startScreen) return;

  // Animar elementos de saída
  if (motivationalText) motivationalText.classList.add('fade-out');
  if (startInputContainer) startInputContainer.classList.add('fade-out');

  setTimeout(() => {
    if (startHeader) startHeader.classList.add('animate-to-top');
  }, 200);

  // Expandir container usando GSAP se disponível
  if (typeof gsap !== 'undefined' && container) {
    gsap.to(container, {
      width: 850,
      height: 750,
      duration: 0.6,
      ease: "back.out(1.7)",
      delay: 0.3
    });
  }

  setTimeout(() => {
    if (startScreen) startScreen.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'block';
    if (chatContainer) chatContainer.style.display = 'flex';
    if (mainFooter) mainFooter.style.display = 'flex';

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
  
  // Criar avatar
  const avatar = document.createElement('div');
  avatar.className = 'chatbot-message-avatar';
  avatar.innerHTML = className === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = content.replace(/\n/g, '<br>');
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(messageContent);
  chatboxEl.appendChild(messageDiv);
  chatboxEl.scrollTop = chatboxEl.scrollHeight;

  // Animar entrada da mensagem com GSAP
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(messageDiv, 
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" }
    );
  }
}

function showTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.style.display = 'flex';
    typingIndicator.classList.add('active');
    if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
  }
}

function hideTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.style.display = 'none';
    typingIndicator.classList.remove('active');
  }
}

async function processMessage(message) {
  const mainSendBtn = document.getElementById('sendBtn');
  if (mainSendBtn && chatStarted) {
    mainSendBtn.disabled = true;
    mainSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
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
        mainSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
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
      mainSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
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

/* ============ INICIALIZAÇÃO DO VISUAL NOVO ============ */
function initVisualEffects() {
    console.log('🚀 Inicializando cenário futurista...');
    
    optimizeForMobile();
    initVantaBackground();
    initEntranceAnimations();
    initParallaxEffect();
    initHoverEffects();
    
    window.addEventListener('resize', handleResize);
    
    // Animar aparição inicial do chatbot
    setTimeout(() => {
        const container = document.getElementById('chatbotContainer');
        if (container && typeof gsap !== 'undefined') {
            gsap.fromTo(container, 
                { 
                    scale: 0.7, 
                    opacity: 0,
                    rotationY: 20,
                    y: 50
                },
                { 
                    scale: 1, 
                    opacity: 1,
                    rotationY: 0,
                    y: 0,
                    duration: 0.8,
                    ease: "back.out(1.7)"
                }
            );
        } else if (container) {
            container.style.opacity = '1';
        }
    }, 800);
    
    console.log('✅ Cenário futurista carregado!');
}

/* ============ INICIALIZAÇÃO PRINCIPAL ============ */
function initializeApp() {
  // Inicializar visual novo
  initVisualEffects();
  
  // Inicializar sistema antigo com delay para garantir que tudo carregou
  setTimeout(() => {
    setupEventListeners();

    const isLoginPage = window.location.pathname.includes("login.html");
    if (isLoginPage) return;

    const startInputEl = document.getElementById('start-input');
    if (startInputEl) startInputEl.focus();
  }, 100);
}

/* ============ LIMPEZA ============ */
window.addEventListener('beforeunload', () => {
    if (vantaEffect) {
        vantaEffect.destroy();
    }
});

/* ============ INICIALIZAÇÃO NO DOM READY ============ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Expor funções globais
window.sendFirstMessage = sendFirstMessage;
window.sendMessage = sendMessage;
window.testAPIConnection = testAPIConnection;

// Event listener para o campo de telefone (se existir na página de login)
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

// Debug após carregamento
setTimeout(() => {
  debugVercel();
  testAPIConnection();
}, 1000);

/* ============ ANIMAÇÕES DE ENTRADA (Visual Novo) ============ */
function initEntranceAnimations() {
    try {
        if (typeof gsap !== 'undefined') {
            const tl = gsap.timeline();
            
            // Animar fundo
            tl.to('.fundo', {
                opacity: 0.3,
                duration: 0.6,
                ease: "power2.out"
            })
            
            // Animar todos os elementos com stagger mínimo
            .fromTo(['.mesa', '.caixas', '.notebook', '.teclado', '.robo'], {
                y: 100,
                opacity: 0,
                scale: 0.8
            }, {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.6,
                ease: "back.out(1.7)",
                stagger: 0.05
            }, "-=0.4");
            
            console.log('✅ GSAP animações carregadas');
        } else {
            document.body.classList.add('fallback-animation');
            console.warn('⚠️ GSAP não encontrado, usando animações CSS de fallback');
        }
    } catch (error) {
        console.warn('⚠️ Erro no GSAP:', error);
        document.body.classList.add('fallback-animation');
    }
}

/* ============ EFEITO PARALLAX (Visual Novo) ============ */
function initParallaxEffect() {
    if (!isDesktop) return;
    
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        
        // Movimento do robô
        const robo = document.querySelector('.robo');
        if (robo && typeof gsap !== 'undefined') {
            gsap.to(robo, {
                duration: 0.3,
                rotationY: x * 3,
                rotationX: -y * 2,
                x: x * 15,
                y: y * 10,
                ease: "power2.out"
            });
        }
        
        // Controle do Vanta
        if (vantaEffect) {
            vantaEffect.setOptions({
                mouseControls: true,
                gyroControls: false
            });
        }
        
        // Movimento dos outros elementos
        if (typeof gsap !== 'undefined') {
            gsap.to('.notebook', {
                duration: 0.4,
                x: x * 8,
                y: -y * 5,
                rotationY: x * 2,
                ease: "power2.out"
            });
            
            gsap.to('.caixas', {
                duration: 0.45,
                x: x * 5,
                y: -y * 3,
                ease: "power2.out"
            });
            
            gsap.to('.teclado', {
                duration: 0.35,
                x: x * 6,
                y: -y * 4,
                ease: "power2.out"
            });
        }
    });
}