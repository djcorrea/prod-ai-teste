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

    // Configuração Firebase CORRIGIDA
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

    // CONFIGURAÇÃO IMPORTANTE: Desabilitar App Check para desenvolvimento
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.log('🔧 Modo desenvolvimento detectado');
      
      // Configurar auth para desenvolvimento
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

    // Função para obter fingerprint
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

    // Função para enviar SMS com reCAPTCHA v2
    async function sendSMS(rawPhone) {
      function formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        // Se começar com 55, remover
        const withoutCountry = clean.replace(/^55/, '');
        // Adicionar +55
        return '+55' + withoutCountry;
      }

      const phone = formatPhone(rawPhone);
      console.log('📱 Telefone formatado:', phone);

      // Validação básica
      if (!phone.startsWith('+55') || phone.length < 13 || phone.length > 14) {
        showMessage("Formato inválido. Use: 11987654321 (DDD + número)", "error");
        return false;
      }

      try {
        // Verificar se o número já foi usado
        const phoneSnap = await getDoc(doc(db, "phones", phone.replace('+55', '')));
        if (phoneSnap.exists()) {
          showMessage("Esse telefone já está cadastrado!", "error");
          return false;
        }

        // Garantir container do reCAPTCHA
        ensureRecaptchaDiv();

        // Limpar reCAPTCHA anterior
        if (recaptchaVerifier) {
          try { 
            recaptchaVerifier.clear(); 
          } catch (e) {
            console.warn('Limpeza do reCAPTCHA anterior:', e);
          }
        }

        console.log('🔄 Criando novo reCAPTCHA...');
        
        // Criar novo reCAPTCHA v2 (NÃO Enterprise)
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log("✅ reCAPTCHA resolvido", response?.substr(0, 10) + '...');
          },
          'expired-callback': () => {
            console.warn("⚠️ reCAPTCHA expirado");
            showMessage("Verificação expirou. Tente novamente.", "error");
          }
        });

        console.log('🎯 Renderizando reCAPTCHA...');
        await recaptchaVerifier.render();
        
        console.log('📤 Enviando SMS para:', phone);
        showMessage("Enviando código SMS...", "success");
        
        confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        lastPhone = phone;
        
        console.log('✅ SMS enviado com sucesso');
        showMessage("Código SMS enviado! Verifique seu celular.", "success");
        showSMSSection();
        return true;

      } catch (error) {
        console.error("❌ Erro detalhado ao enviar SMS:", error);
        
        // Mensagens específicas para diferentes erros
        if (error.code === 'auth/too-many-requests') {
          showMessage("Muitas tentativas. Aguarde 5 minutos e tente novamente.", "error");
        } else if (error.code === 'auth/captcha-check-failed') {
          showMessage("Falha na verificação. Recarregue a página e tente novamente.", "error");
        } else if (error.code === 'auth/invalid-phone-number') {
          showMessage("Número inválido. Use formato: 11987654321", "error");
        } else {
          showMessage(error, "error");
        }
        return false;
      }
    }

    // Função de cadastro
    async function signUp() {
      console.log('🚀 signUp iniciado');
      
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

      // Enviar SMS
      isNewUserRegistering = true;
      const sent = await sendSMS(rawPhone);
      if (!sent) {
        isNewUserRegistering = false;
        return;
      }
    }

    // Função para confirmar código SMS
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

        // Salvar dados do usuário
        await setDoc(doc(db, 'usuarios', phoneResult.user.uid), {
          email: email,
          phone: phone,
          fingerprint: fingerprint,
          entrevistaConcluida: false,
          createdAt: new Date(),
          lastLogin: new Date()
        });

        // Salvar telefone para evitar duplicatas
        await setDoc(doc(db, 'phones', phone.replace(/\D/g, '')), {
          userId: phoneResult.user.uid,
          createdAt: new Date()
        });

        // Tentar registrar na cloud function (opcional)
        if (fingerprint) {
          try {
            const registerAccount = httpsCallable(functions, 'registerAccount');
            await registerAccount({ fingerprint, phone });
          } catch (e) {
            console.warn('Cloud function falhou (não crítico):', e);
          }
        }

        // Salvar no localStorage
        const idToken = await phoneResult.user.getIdToken();
        localStorage.setItem("idToken", idToken);
        localStorage.setItem("user", JSON.stringify({
          uid: phoneResult.user.uid,
          email: phoneResult.user.email
        }));

        console.log("🎯 Cadastro concluído, redirecionando...");
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
          showMessage("Este e-mail já está em uso. Faça login.", "error");
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

    console.log('✅ auth.js carregado com reCAPTCHA v2');

  } catch (error) {
    console.error('❌ Erro crítico ao carregar auth.js:', error);
  }
})();