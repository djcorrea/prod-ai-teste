console.log('auth.js iniciado');

(async () => {
  try {
    // Importações dinâmicas
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js');
    const { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signInWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, PhoneAuthProvider, signInWithCredential, linkWithCredential } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js');
    
    // Importação do FingerprintJS
    let FingerprintJS;
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js');
      FingerprintJS = mod.default || mod;
    } catch (e) {
      console.warn('FingerprintJS não carregado:', e);
    }

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

    // CONFIGURAÇÃO: Desabilitar App Check para desenvolvimento
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.log('🔧 Modo desenvolvimento detectado');
      
      auth.settings = {
        appVerificationDisabledForTesting: true
      };
    }

    // Variáveis globais
    let confirmationResult = null;
    let lastPhone = "";
    let isNewUserRegistering = false;
    let recaptchaVerifier = null;

    // Mensagens de erro em português
    const firebaseErrorsPt = {
      'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato: 11987654321',
      'auth/missing-phone-number': 'Digite seu número de telefone.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      'auth/quota-exceeded': 'Limite de SMS excedido. Tente novamente mais tarde.',
      'auth/user-disabled': 'Usuário desativado.',
      'auth/code-expired': 'O código expirou. Solicite um novo.',
      'auth/invalid-verification-code': 'Código de verificação inválido.',
      'auth/captcha-check-failed': 'Falha na verificação reCAPTCHA. Recarregue a página e tente novamente.',
      'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
      'auth/app-not-authorized': 'Aplicação não autorizada para este domínio.',
      'auth/session-expired': 'Sessão expirada. Tente novamente.',
      'auth/invalid-verification-id': 'Falha na verificação. Tente novamente.',
      'auth/email-already-in-use': 'Esse e-mail já está cadastrado. Faça login ou recupere sua senha.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    };

    // Função para mostrar mensagens
    function showMessage(messageOrError, type = "error") {
      const msg = typeof messageOrError === 'object' && messageOrError.code
        ? (firebaseErrorsPt[messageOrError.code] || messageOrError.message || 'Erro desconhecido.')
        : messageOrError;

      console.log(`${type.toUpperCase()}: ${msg}`);

      const el = document.getElementById("error-message");
      if (el) {
        el.innerText = msg;
        el.style.display = "block";
        el.classList.remove("error-message", "success-message");
        el.classList.add(type === "success" ? "success-message" : "error-message");
        
        // Auto-hide success messages
        if (type === "success") {
          setTimeout(() => {
            el.style.display = "none";
          }, 5000);
        }
      } else {
        alert(msg);
      }
    }

    // Função para obter fingerprint (REMOVIDO CLOUD FUNCTION)
    async function getFingerprint() {
      if (FingerprintJS && typeof FingerprintJS.load === 'function') {
        try {
          const fpPromise = FingerprintJS.load();
          const fp = await fpPromise;
          const result = await fp.get();
          return result.visitorId;
        } catch (e) {
          console.warn('Erro ao obter fingerprint:', e);
        }
      }
      return 'dev-' + Date.now();
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

    // Função para enviar SMS - COM CONTROLE DE RATE LIMIT
    async function sendSMS(rawPhone) {
      function formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        const withoutCountry = clean.replace(/^55/, '');
        return '+55' + withoutCountry;
      }

      const phone = formatPhone(rawPhone);
      console.log('📱 Telefone formatado:', phone);

      // Validação básica apenas do formato
      if (!phone.startsWith('+55') || phone.length < 13 || phone.length > 14) {
        showMessage("Formato inválido. Use: 11987654321 (DDD + número)", "error");
        return false;
      }

      try {
        // Verificar rate limit local (opcional - pode comentar se quiser)
        const lastSMSTime = localStorage.getItem('lastSMSTime');
        const now = Date.now();
        if (lastSMSTime && (now - parseInt(lastSMSTime)) < 60000) {
          const waitTime = Math.ceil((60000 - (now - parseInt(lastSMSTime))) / 1000);
          showMessage(`Aguarde ${waitTime} segundos antes de solicitar outro SMS.`, "error");
          return false;
        }

        console.log('🔓 Verificação de telefone duplicado: DESABILITADA');

        // Garantir container do reCAPTCHA
        ensureRecaptchaDiv();

        // Limpar reCAPTCHA anterior COM DELAY
        if (recaptchaVerifier) {
          try { 
            recaptchaVerifier.clear(); 
            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
          } catch (e) {
            console.warn('Limpeza do reCAPTCHA anterior:', e);
          }
        }

        console.log('🔄 Criando novo reCAPTCHA...');
        
        // Criar novo reCAPTCHA v2 com configurações mais robustas
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log("✅ reCAPTCHA resolvido", response?.substr(0, 10) + '...');
          },
          'expired-callback': () => {
            console.warn("⚠️ reCAPTCHA expirado");
            showMessage("Verificação expirou. Recarregue a página.", "error");
          },
          'error-callback': (error) => {
            console.error("❌ Erro no reCAPTCHA:", error);
            showMessage("Erro na verificação. Recarregue a página.", "error");
          }
        });

        console.log('🎯 Renderizando reCAPTCHA...');
        await recaptchaVerifier.render();
        
        // Aguardar um pouco antes de enviar SMS
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('📤 Enviando SMS para:', phone);
        showMessage("Enviando código SMS...", "success");
        
        confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        lastPhone = phone;
        
        // Salvar timestamp do último SMS
        localStorage.setItem('lastSMSTime', now.toString());
        
        console.log('✅ SMS enviado com sucesso');
        showMessage("Código SMS enviado! Verifique seu celular.", "success");
        showSMSSection();
        return true;

      } catch (error) {
        console.error("❌ Erro detalhado ao enviar SMS:", error);
        
        if (error.code === 'auth/too-many-requests') {
          // Calcular tempo de espera baseado no erro
          const waitMinutes = 10; // Firebase geralmente bloqueia por 10-15 minutos
          showMessage(`Muitas tentativas de SMS. Aguarde ${waitMinutes} minutos ou use um número diferente.`, "error");
          
          // Salvar timestamp do bloqueio
          localStorage.setItem('smsBlocked', (Date.now() + (waitMinutes * 60000)).toString());
          
        } else if (error.code === 'auth/captcha-check-failed') {
          showMessage("Falha na verificação. Recarregue a página e tente novamente.", "error");
        } else if (error.code === 'auth/invalid-phone-number') {
          showMessage("Número inválido. Use formato: 11987654321", "error");
        } else if (error.code === 'auth/quota-exceeded') {
          showMessage("Limite diário de SMS atingido. Tente novamente amanhã.", "error");
        } else {
          showMessage(error, "error");
        }
        return false;
      }
    }

    // Função de cadastro com verificação de bloqueio
    async function signUp() {
      console.log('🚀 signUp iniciado - MODO LIBERADO');
      
      // Verificar se está bloqueado por too-many-requests
      const smsBlocked = localStorage.getItem('smsBlocked');
      if (smsBlocked && Date.now() < parseInt(smsBlocked)) {
        const waitTime = Math.ceil((parseInt(smsBlocked) - Date.now()) / 60000);
        showMessage(`Sistema bloqueado por tentativas excessivas. Aguarde ${waitTime} minutos.`, "error");
        return;
      }
      
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const rawPhone = document.getElementById("phone")?.value?.trim();

      if (!email || !password || !rawPhone) {
        showMessage("Preencha todos os campos obrigatórios.", "error");
        return;
      }

      // Validar e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage("Digite um e-mail válido.", "error");
        return;
      }

      // Validar senha
      if (password.length < 6) {
        showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
        return;
      }

      // Validar telefone
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

      // Enviar SMS (sem verificações de duplicata)
      isNewUserRegistering = true;
      const sent = await sendSMS(rawPhone);
      if (!sent) {
        isNewUserRegistering = false;
        return;
      }
    }

    // Função para confirmar código SMS - SEM VERIFICAÇÕES DE DUPLICATA
    async function confirmSMSCode() {
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const phone = document.getElementById("phone")?.value?.trim();
      const code = document.getElementById("smsCode")?.value?.trim();

      if (!code) {
        showMessage("Digite o código recebido por SMS.", "error");
        return;
      }

      if (code.length !== 6) {
        showMessage("O código deve ter 6 dígitos.", "error");
        return;
      }

      if (!confirmationResult) {
        showMessage("Solicite um novo código SMS.", "error");
        return;
      }

      try {
        console.log('🔍 Verificando código SMS...');
        showMessage("Verificando código...", "success");

        // Confirmar código SMS
        const phoneCredential = PhoneAuthProvider.credential(
          confirmationResult.verificationId, 
          code
        );
        const phoneResult = await signInWithCredential(auth, phoneCredential);

        console.log('✅ Telefone verificado, criando conta...');

        // Vincular e-mail à conta
        const emailCredential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(phoneResult.user, emailCredential);

        // Obter fingerprint
        const fingerprint = await getFingerprint();

        // Gerar ID único para evitar conflitos no Firestore
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const uniqueId = `${timestamp}_${randomId}`;

        // Salvar dados do usuário
        await setDoc(doc(db, 'usuarios', phoneResult.user.uid), {
          email: email,
          phone: phone,
          fingerprint: fingerprint,
          uniqueId: uniqueId, // ID único para tracking
          entrevistaConcluida: false,
          createdAt: new Date(),
          lastLogin: new Date()
        });

        // ✅ REMOVIDO: Salvar telefone na coleção "phones" para evitar duplicatas
        // Agora permite múltiplas contas com o mesmo telefone
        console.log('🔓 Salvamento de telefone para verificação de duplicata: DESABILITADO');

        // ✅ REMOVIDO: Cloud function registerAccount (fingerprint tracking)
        // Permite múltiplas contas por dispositivo
        console.log('🔓 Cloud function de registro: DESABILITADA');

        // Salvar no localStorage
        const idToken = await phoneResult.user.getIdToken();
        localStorage.setItem("idToken", idToken);
        localStorage.setItem("user", JSON.stringify({
          uid: phoneResult.user.uid,
          email: phoneResult.user.email
        }));

        console.log("🎯 Cadastro concluído (MODO LIBERADO), redirecionando...");
        showMessage("Cadastro realizado com sucesso!", "success");
        
        setTimeout(() => {
          window.location.replace("entrevista.html");
        }, 1500);

      } catch (error) {
        console.error("❌ Erro na confirmação do código:", error);
        
        if (error.code === 'auth/invalid-verification-code') {
          showMessage("Código inválido. Verifique e tente novamente.", "error");
        } else if (error.code === 'auth/code-expired') {
          showMessage("Código expirado. Solicite um novo.", "error");
        } else if (error.code === 'auth/email-already-in-use') {
          // ✅ ALTERADO: Não bloqueia mais por e-mail duplicado
          showMessage("Este e-mail já está em uso, mas permitindo múltiplas contas.", "success");
          // Continua o fluxo normalmente
          setTimeout(() => {
            window.location.replace("entrevista.html");
          }, 1500);
        } else {
          showMessage(error, "error");
        }
      }
    }

    // Função de logout
    async function logout() {
      try { 
        await auth.signOut(); 
      } catch (e) {
        console.warn('Erro no logout:', e);
      }
      localStorage.removeItem("user");
      localStorage.removeItem("idToken");
      window.location.href = "login.html";
    }

    // Função para verificar estado de autenticação
    function checkAuthState() {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          const isLoginPage = window.location.pathname.includes("login.html");
          if (!isLoginPage) window.location.href = "login.html";
          resolve(null);
        }, 5000);

        auth.onAuthStateChanged(async (user) => {
          clearTimeout(timeout);
          const isLoginPage = window.location.pathname.includes("login.html");
          const isEntrevistaPage = window.location.pathname.includes("entrevista.html");

          if (isNewUserRegistering && isEntrevistaPage) {
            isNewUserRegistering = false;
            resolve(user);
            return;
          }

          if (!user && !isLoginPage) {
            window.location.href = "login.html";
          } else if (user && isLoginPage) {
            try {
              const snap = await getDoc(doc(db, 'usuarios', user.uid));
              if (snap.exists() && snap.data().entrevistaConcluida === false) {
                window.location.href = "entrevista.html";
              } else if (snap.exists() && snap.data().entrevistaConcluida === true) {
                window.location.href = "index.html";
              } else {
                window.location.href = "entrevista.html";
              }
            } catch (e) {
              console.warn('Erro ao verificar usuário:', e);
              window.location.href = "entrevista.html";
            }
          } else if (user && !isLoginPage) {
            try {
              const idToken = await user.getIdToken();
              localStorage.setItem("idToken", idToken);
              localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                email: user.email
              }));
              
              try {
                const snap = await getDoc(doc(db, 'usuarios', user.uid));
                if (snap.exists() && snap.data().entrevistaConcluida === false && !isEntrevistaPage) {
                  window.location.href = "entrevista.html";
                  return;
                }
              } catch (e) {
                console.warn('Erro ao verificar entrevista:', e);
              }
            } catch (error) {
              console.error('Erro ao obter token:', error);
            }
          }
          resolve(user);
        });
      });
    }

    // Expor funções globalmente
    window.login = login;
    window.signUp = signUp;
    window.confirmSMSCode = confirmSMSCode;
    window.forgotPassword = forgotPassword;
    window.logout = logout;
    window.showSMSSection = showSMSSection;
    window.register = signUp; // Alias

    // Configurar listeners dos botões
    function setupEventListeners() {
      const loginBtn = document.getElementById("loginBtn");
      const signUpBtn = document.getElementById("signUpBtn");
      const confirmBtn = document.getElementById("confirmCodeBtn");
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
      
      if (confirmBtn) {
        confirmBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.confirmSMSCode();
        });
      }
      
      if (forgotLink) {
        forgotLink.addEventListener("click", (e) => {
          e.preventDefault();
          window.forgotPassword();
        });
      }

      console.log('✅ Event listeners configurados');
    }

    // Inicializar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }

    // Verificar estado de autenticação
    checkAuthState();

    console.log('✅ auth.js carregado - MODO LIBERADO (múltiplas contas permitidas)');

  } catch (error) {
    console.error('❌ Erro crítico ao carregar auth.js:', error);
  }
})();