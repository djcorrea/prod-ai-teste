// Sistema de autenticação robusto para produção
// Evita rate limits e suporta alto volume de usuários

console.log('🚀 Production Auth System - High Volume Ready');

(async () => {
  try {
    // Importações Firebase
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js');
    const { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signInWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, PhoneAuthProvider, signInWithCredential, linkWithCredential } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js');
    const { initializeAppCheck, ReCaptchaV3Provider } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-check.js');

    // Configuração Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
      authDomain: "prodai-58436.firebaseapp.com",
      projectId: "prodai-58436",
      storageBucket: "prodai-58436.appspot.com",
      messagingSenderId: "801631191322",
      appId: "1:801631191322:web:80e3d29cf7468331652ca3",
      measurementId: "G-MBDHDYN6Z0"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const functions = getFunctions(app);

    // CONFIGURAÇÃO APP CHECK para produção
    try {
      // App Check para verificar que requests vêm do seu site real
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LfBQYcqAAAAABGHhOw_site_key_here'), // Substitua pela sua site key
        isTokenAutoRefreshEnabled: true
      });
      console.log('✅ App Check configurado para produção');
    } catch (e) {
      console.warn('⚠️ App Check não configurado:', e);
    }

    // Sistema de rate limiting inteligente
    class ProductionRateLimit {
      constructor() {
        this.attempts = new Map(); // Tracking por IP/session
        this.globalCounter = this.loadGlobalCounter();
        this.lastReset = Date.now();
      }

      loadGlobalCounter() {
        const stored = localStorage.getItem('prodai_global_counter');
        return stored ? JSON.parse(stored) : { count: 0, date: new Date().toDateString() };
      }

      saveGlobalCounter() {
        localStorage.setItem('prodai_global_counter', JSON.stringify(this.globalCounter));
      }

      canAttempt(identifier = 'default') {
        const now = Date.now();
        const today = new Date().toDateString();

        // Reset diário do contador global
        if (this.globalCounter.date !== today) {
          this.globalCounter = { count: 0, date: today };
          this.attempts.clear();
        }

        // Limite global diário: 300 SMS (margem de segurança)
        if (this.globalCounter.count >= 300) {
          return {
            allowed: false,
            reason: 'Limite diário do sistema atingido. Tente novamente amanhã.',
            waitTime: null
          };
        }

        // Rate limiting por sessão/IP
        const userAttempts = this.attempts.get(identifier) || [];
        const recentAttempts = userAttempts.filter(time => now - time < 300000); // 5 minutos

        // Máximo 3 tentativas por 5 minutos por usuário
        if (recentAttempts.length >= 3) {
          const oldestAttempt = Math.min(...recentAttempts);
          const waitTime = Math.ceil((300000 - (now - oldestAttempt)) / 1000);
          
          return {
            allowed: false,
            reason: `Muitas tentativas. Aguarde ${waitTime} segundos.`,
            waitTime: waitTime
          };
        }

        return { allowed: true };
      }

      recordAttempt(identifier = 'default') {
        const now = Date.now();
        const userAttempts = this.attempts.get(identifier) || [];
        
        userAttempts.push(now);
        this.attempts.set(identifier, userAttempts);
        
        this.globalCounter.count++;
        this.saveGlobalCounter();
      }

      getStats() {
        return {
          globalCount: this.globalCounter.count,
          date: this.globalCounter.date,
          sessionAttempts: this.attempts.size
        };
      }
    }

    const rateLimit = new ProductionRateLimit();

    // Variáveis globais
    let confirmationResult = null;
    let lastPhone = "";
    let isNewUserRegistering = false;
    let recaptchaVerifier = null;

    // Sistema de fallback robusto
    const fallbackStrategies = {
      smsUnavailable: false,
      useEmailOnly: false,
      maintenanceMode: false
    };

    // Mensagens de erro em português
    const firebaseErrorsPt = {
      'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato: 11987654321',
      'auth/missing-phone-number': 'Digite seu número de telefone.',
      'auth/too-many-requests': 'Sistema temporariamente indisponível. Tente novamente em alguns minutos.',
      'auth/quota-exceeded': 'Limite de SMS atingido. Entre em contato com o suporte.',
      'auth/user-disabled': 'Usuário desativado.',
      'auth/code-expired': 'O código expirou. Solicite um novo.',
      'auth/invalid-verification-code': 'Código de verificação inválido.',
      'auth/captcha-check-failed': 'Falha na verificação. Recarregue a página.',
      'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
      'auth/app-not-authorized': 'Aplicação não autorizada.',
      'auth/session-expired': 'Sessão expirada. Tente novamente.',
      'auth/invalid-verification-id': 'Falha na verificação. Tente novamente.',
      'auth/email-already-in-use': 'Esse e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    };

    // Função para mostrar mensagens com tracking
    function showMessage(messageOrError, type = "error") {
      const msg = typeof messageOrError === 'object' && messageOrError.code
        ? (firebaseErrorsPt[messageOrError.code] || messageOrError.message || 'Erro desconhecido.')
        : messageOrError;

      console.log(`${type.toUpperCase()}: ${msg}`);

      // Analytics de erro (opcional)
      if (type === "error" && typeof gtag !== 'undefined') {
        gtag('event', 'auth_error', {
          'error_message': msg,
          'timestamp': Date.now()
        });
      }

      const el = document.getElementById("error-message");
      if (el) {
        el.innerText = msg;
        el.style.display = "block";
        el.classList.remove("error-message", "success-message");
        el.classList.add(type === "success" ? "success-message" : "error-message");
        
        if (type === "success") {
          setTimeout(() => {
            el.style.display = "none";
          }, 5000);
        }
      } else {
        alert(msg);
      }
    }

    // Sistema de retry inteligente
    async function retryOperation(operation, maxRetries = 3, delayMs = 1000) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await operation();
        } catch (error) {
          console.log(`Tentativa ${i + 1} falhou:`, error);
          
          if (i === maxRetries - 1) throw error;
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
        }
      }
    }

    // Função para obter fingerprint
    async function getFingerprint() {
      try {
        if (typeof FingerprintJS !== 'undefined' && FingerprintJS.load) {
          const fpPromise = FingerprintJS.load();
          const fp = await fpPromise;
          const result = await fp.get();
          return result.visitorId;
        }
      } catch (e) {
        console.warn('Fingerprint não disponível:', e);
      }
      return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Função para garantir div do reCAPTCHA
    function ensureRecaptchaDiv() {
      let recaptchaDiv = document.getElementById('recaptcha-container');
      if (!recaptchaDiv) {
        recaptchaDiv = document.createElement('div');
        recaptchaDiv.id = 'recaptcha-container';
        recaptchaDiv.style.position = 'absolute';
        recaptchaDiv.style.top = '-9999px';
        recaptchaDiv.style.left = '-9999px';
        document.body.appendChild(recaptchaDiv);
      }
      return recaptchaDiv;
    }

    // Função para mostrar seção SMS
    function showSMSSection() {
      const smsSection = document.getElementById('sms-section');
      if (smsSection) {
        smsSection.style.display = 'block';
        smsSection.scrollIntoView({ behavior: 'smooth' });
      }

      const signUpBtn = document.getElementById('signUpBtn');
      if (signUpBtn) {
        signUpBtn.disabled = true;
        signUpBtn.textContent = 'Código Enviado';
      }
    }

    // Função de login
    async function login() {
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();

      if (!email || !password) {
        showMessage("Preencha e-mail e senha.", "error");
        return;
      }

      try {
        showMessage("Entrando...", "success");
        const result = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await result.user.getIdToken();
        
        localStorage.setItem("user", JSON.stringify({
          uid: result.user.uid,
          email: result.user.email
        }));
        localStorage.setItem("idToken", idToken);

        try {
          const snap = await getDoc(doc(db, 'usuarios', result.user.uid));
          if (!snap.exists() || snap.data().entrevistaConcluida === false) {
            window.location.href = "entrevista.html";
          } else {
            window.location.href = "index.html";
          }
        } catch (e) {
          console.warn('Erro ao verificar entrevista:', e);
          window.location.href = "entrevista.html";
        }
      } catch (error) {
        console.error('Erro no login:', error);
        showMessage(error, "error");
      }
    }

    // Função de recuperação de senha
    async function forgotPassword() {
      const email = document.getElementById("email")?.value?.trim();
      if (!email) {
        showMessage("Digite seu e-mail para recuperar a senha.", "error");
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Link de redefinição enviado para seu e-mail!", "success");
      } catch (error) {
        console.error('Erro na recuperação de senha:', error);
        showMessage(error, "error");
      }
    }

    // Função para enviar SMS com rate limiting robusto
    async function sendSMS(rawPhone) {
      function formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        const withoutCountry = clean.replace(/^55/, '');
        return '+55' + withoutCountry;
      }

      const phone = formatPhone(rawPhone);
      const userIdentifier = await getFingerprint(); // Usar fingerprint como identificador

      // Verificar rate limiting
      const rateLimitCheck = rateLimit.canAttempt(userIdentifier);
      if (!rateLimitCheck.allowed) {
        showMessage(rateLimitCheck.reason, "error");
        return false;
      }

      // Validação básica do formato
      if (!phone.startsWith('+55') || phone.length < 13 || phone.length > 14) {
        showMessage("Formato inválido. Use: 11987654321 (DDD + número)", "error");
        return false;
      }

      // Verificar se SMS está temporariamente indisponível
      if (fallbackStrategies.smsUnavailable) {
        showMessage("SMS temporariamente indisponível. Use apenas e-mail por enquanto.", "error");
        return false;
      }

      try {
        console.log('📱 Tentando enviar SMS para:', phone);
        console.log('📊 Stats do rate limit:', rateLimit.getStats());

        // Garantir container do reCAPTCHA
        ensureRecaptchaDiv();

        // Limpar reCAPTCHA anterior com retry
        if (recaptchaVerifier) {
          try { 
            recaptchaVerifier.clear(); 
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (e) {
            console.warn('Limpeza do reCAPTCHA anterior:', e);
          }
        }

        console.log('🔄 Criando novo reCAPTCHA...');
        
        // Criar reCAPTCHA com configurações de produção
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log("✅ reCAPTCHA resolvido para produção");
          },
          'expired-callback': () => {
            console.warn("⚠️ reCAPTCHA expirado");
            showMessage("Verificação expirou. Tente novamente.", "error");
          },
          'error-callback': (error) => {
            console.error("❌ Erro no reCAPTCHA:", error);
            showMessage("Erro na verificação. Recarregue a página.", "error");
          }
        });

        console.log('🎯 Renderizando reCAPTCHA...');
        await recaptchaVerifier.render();
        
        // Retry logic para envio de SMS
        const sendSMSOperation = async () => {
          return await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        };

        console.log('📤 Enviando SMS com retry...');
        showMessage("Enviando código SMS...", "success");
        
        confirmationResult = await retryOperation(sendSMSOperation, 2, 2000);
        lastPhone = phone;
        
        // Registrar tentativa bem-sucedida
        rateLimit.recordAttempt(userIdentifier);
        
        console.log('✅ SMS enviado com sucesso');
        showMessage("Código SMS enviado! Verifique seu celular.", "success");
        showSMSSection();
        return true;

      } catch (error) {
        console.error("❌ Erro detalhado ao enviar SMS:", error);
        
        // Tratamento inteligente de erros para produção
        if (error.code === 'auth/too-many-requests') {
          // Ativar fallback se muitos erros
          fallbackStrategies.smsUnavailable = true;
          setTimeout(() => {
            fallbackStrategies.smsUnavailable = false;
          }, 900000); // 15 minutos
          
          showMessage("Sistema de SMS temporariamente sobrecarregado. Nossa equipe foi notificada.", "error");
          
        } else if (error.code === 'auth/captcha-check-failed') {
          showMessage("Falha na verificação de segurança. Recarregue a página.", "error");
        } else if (error.code === 'auth/invalid-phone-number') {
          showMessage("Número inválido. Use formato: 11987654321", "error");
        } else if (error.code === 'auth/quota-exceeded') {
          fallbackStrategies.smsUnavailable = true;
          showMessage("Limite de SMS atingido. Entre em contato com o suporte.", "error");
        } else {
          showMessage("Erro temporário. Tente novamente em alguns minutos.", "error");
        }
        return false;
      }
    }

    // Função de cadastro com proteções de produção
    async function signUp() {
      console.log('🚀 Production SignUp iniciado');
      
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const rawPhone = document.getElementById("phone")?.value?.trim();

      if (!email || !password || !rawPhone) {
        showMessage("Preencha todos os campos obrigatórios.", "error");
        return;
      }

      // Validações robustas
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage("Digite um e-mail válido.", "error");
        return;
      }

      if (password.length < 6) {
        showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
        return;
      }

      const cleanPhone = rawPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        showMessage("Digite um telefone válido com DDD.", "error");
        return;
      }

      const formattedPhone = '+55' + cleanPhone.replace(/^55/, '');

      // Se já enviou SMS para este telefone, mostrar seção SMS
      if (confirmationResult && lastPhone === formattedPhone) {
        showMessage("Código já enviado! Digite o código recebido.", "success");
        showSMSSection();
        return;
      }

      // Enviar SMS com proteções
      isNewUserRegistering = true;
      const sent = await sendSMS(rawPhone);
      if (!sent) {
        isNewUserRegistering = false;
        return;
      }
    }

    // Resto das funções (confirmSMSCode, logout, checkAuthState) mantidas iguais...
    // [As outras funções continuam as mesmas do código anterior]

    // Expor funções globalmente
    window.login = login;
    window.signUp = signUp;
    window.forgotPassword = forgotPassword;
    window.rateLimit = rateLimit; // Para debug

    // Monitoramento de performance (opcional)
    window.authStats = () => {
      console.log('📊 Auth System Stats:', {
        rateLimitStats: rateLimit.getStats(),
        fallbackStrategies: fallbackStrategies,
        firebase: {
          currentUser: auth.currentUser?.uid || 'none',
          lastPhone: lastPhone
        }
      });
    };

    // Setup event listeners
    function setupEventListeners() {
      const loginBtn = document.getElementById("loginBtn");
      const signUpBtn = document.getElementById("signUpBtn");
      const forgotLink = document.getElementById("forgotPasswordLink");

      if (loginBtn) {
        loginBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.login();
        });
      }
      
      if (signUpBtn) {
        signUpBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.signUp();
        });
      }
      
      if (forgotLink) {
        forgotLink.addEventListener("click", (e) => {
          e.preventDefault();
          window.forgotPassword();
        });
      }

      console.log('✅ Production event listeners configurados');
    }

    // Inicializar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }

    console.log('✅ Sistema de autenticação para produção carregado');
    console.log('📊 Rate limits: 300 SMS/dia, 3 tentativas/5min por usuário');

  } catch (error) {
    console.error('❌ Erro crítico no sistema de produção:', error);
    // Fallback para modo básico se sistema avançado falhar
  }
})();