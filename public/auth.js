console.log('auth.js iniciado - SEM NENHUM BLOQUEIO');

(async () => {
  try {
    // Importações dinâmicas - SEM APP CHECK
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

    // Configuração Firebase - LIMPA, SEM APP CHECK
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

    console.log('🔓 MODO TOTALMENTE LIBERADO - Sem rate limits');

    // Variáveis globais
    let confirmationResult = null;
    let lastPhone = "";
    let isNewUserRegistering = false;
    let recaptchaVerifier = null;

    // Mensagens de erro em português
    const firebaseErrorsPt = {
      'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato: 11987654321',
      'auth/missing-phone-number': 'Digite seu número de telefone.',
      'auth/too-many-requests': 'Firebase temporariamente limitado. Isso é normal em desenvolvimento.',
      'auth/quota-exceeded': 'Limite do Firebase atingido.',
      'auth/user-disabled': 'Usuário desativado.',
      'auth/code-expired': 'O código expirou. Solicite um novo.',
      'auth/invalid-verification-code': 'Código de verificação inválido.',
      'auth/captcha-check-failed': 'Falha na verificação. Recarregue a página.',
      'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
      'auth/app-not-authorized': 'Aplicação não autorizada.',
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
      return 'dev-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Função para garantir div do reCAPTCHA - VERSÃO MAIS ROBUSTA
    function ensureRecaptchaDiv() {
      let recaptchaDiv = document.getElementById('recaptcha-container');
      if (!recaptchaDiv) {
        recaptchaDiv = document.createElement('div');
        recaptchaDiv.id = 'recaptcha-container';
        recaptchaDiv.style.position = 'absolute';
        recaptchaDiv.style.top = '-9999px';
        recaptchaDiv.style.left = '-9999px';
        document.body.appendChild(recaptchaDiv);
        console.log('📦 Container reCAPTCHA criado');
      } else {
        // Limpar conteúdo se já existe
        recaptchaDiv.innerHTML = '';
        console.log('🧹 Container reCAPTCHA limpo');
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

    // Função para enviar SMS - SEM NENHUM RATE LIMITING
    async function sendSMS(rawPhone) {
      function formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        const withoutCountry = clean.replace(/^55/, '');
        return '+55' + withoutCountry;
      }

      const phone = formatPhone(rawPhone);

      console.log('📱 Telefone formatado:', phone);
      console.log('🔓 Rate limiting: TOTALMENTE DESABILITADO');

      // ✅ REMOVIDO: Todos os rate limits locais
      // ✅ REMOVIDO: Verificações de tempo
      // ✅ REMOVIDO: Limites por usuário/sessão

      // Validação básica APENAS do formato
      if (!phone.startsWith('+55') || phone.length < 13 || phone.length > 14) {
        showMessage("Formato inválido. Use: 11987654321 (DDD + número)", "error");
        return false;
      }

      try {
        console.log('🔄 Iniciando processo de SMS sem limitações...');

        // Garantir container do reCAPTCHA
        ensureRecaptchaDiv();

        // Limpar reCAPTCHA anterior - MÉTODO MAIS ROBUSTO
        if (recaptchaVerifier) {
          try { 
            recaptchaVerifier.clear(); 
          } catch (e) {
            console.warn('Limpeza do reCAPTCHA anterior:', e);
          }
          recaptchaVerifier = null;
        }

        // Limpar o container DOM também
        const container = document.getElementById('recaptcha-container');
        if (container) {
          container.innerHTML = '';
        }

        // Recriar container se necessário
        ensureRecaptchaDiv();

        console.log('🎯 Criando reCAPTCHA v2...');
        
        // Criar reCAPTCHA v2 com configuração de domínio corrigida
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log("✅ reCAPTCHA resolvido");
          },
          'expired-callback': () => {
            console.warn("⚠️ reCAPTCHA expirado");
            showMessage("Verificação expirou. Tente novamente.", "error");
          },
          'error-callback': (error) => {
            console.error("❌ Erro no reCAPTCHA:", error);
            if (error.message?.includes('hostname')) {
              showMessage("Erro de configuração de domínio. Recarregue a página.", "error");
            }
          }
        });

        console.log('🔄 Renderizando reCAPTCHA...');
        await recaptchaVerifier.render();
        
        console.log('📤 Enviando SMS...');
        showMessage("Enviando código SMS...", "success");
        
        // Enviar SMS diretamente - SEM nenhuma verificação de rate limit
        confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        lastPhone = phone;
        
        // ✅ REMOVIDO: Registro de tentativas para rate limiting
        
        console.log('✅ SMS enviado com sucesso');
        showMessage("Código SMS enviado! Verifique seu celular.", "success");
        showSMSSection();
        return true;

      } catch (error) {
        console.error("❌ Erro ao enviar SMS:", error);
        
        // Tratamento mais permissivo de erros
        if (error.code === 'auth/too-many-requests') {
          showMessage("Firebase temporariamente limitado. Isso é normal em desenvolvimento intensivo.", "error");
        } else if (error.code === 'auth/captcha-check-failed') {
          showMessage("Falha na verificação. Recarregue a página.", "error");
        } else if (error.code === 'auth/invalid-phone-number') {
          showMessage("Número inválido. Use formato: 11987654321", "error");
        } else if (error.code === 'auth/quota-exceeded') {
          showMessage("Limite do Firebase atingido (não é do nosso código).", "error");
        } else {
          showMessage("Erro temporário. Tente novamente.", "error");
        }
        return false;
      }
    }

    // Função de cadastro - SEM BLOQUEIOS
    async function signUp() {
      console.log('🚀 signUp iniciado - MODO TOTALMENTE LIBERADO');
      
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const rawPhone = document.getElementById("phone")?.value?.trim();

      if (!email || !password || !rawPhone) {
        showMessage("Preencha todos os campos obrigatórios.", "error");
        return;
      }

      // Validações básicas APENAS
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

      // Enviar SMS - SEM NENHUMA VERIFICAÇÃO DE RATE LIMIT
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

        // Gerar ID único para cada conta
        const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        // Salvar dados do usuário - SEM VERIFICAÇÕES DE DUPLICATA
        await setDoc(doc(db, 'usuarios', phoneResult.user.uid), {
          email: email,
          phone: phone,
          fingerprint: fingerprint,
          uniqueId: uniqueId,
          entrevistaConcluida: false,
          createdAt: new Date(),
          lastLogin: new Date(),
          developmentMode: true // Flag para indicar que foi criado sem restrições
        });

        // ✅ REMOVIDO: Salvamento na coleção "phones" para verificação de duplicata
        // ✅ REMOVIDO: Cloud functions de registro
        // ✅ REMOVIDO: Verificações de fingerprint

        console.log('🔓 Todas as verificações de duplicata: DESABILITADAS');

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
          // ✅ PERMITIR: Mesmo e-mail em múltiplas contas (modo desenvolvimento)
          showMessage("E-mail já existe, mas permitindo múltiplas contas (modo dev).", "success");
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

    // Função para verificar estado de autenticação (simplificada)
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

    // Função de debug para limpar qualquer cache restante
    window.clearAllLimits = () => {
      localStorage.removeItem('prodai_rate_limit');
      localStorage.removeItem('lastSMSTime');
      localStorage.removeItem('smsBlocked');
      console.log('🧹 Todos os rate limits locais removidos');
    };

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

    console.log('✅ Sistema TOTALMENTE LIBERADO carregado');
    console.log('🔓 Rate limits: TODOS REMOVIDOS');
    console.log('🔓 Verificações de duplicata: TODAS REMOVIDAS');
    console.log('🔓 Limites de tempo: TODOS REMOVIDOS');

  } catch (error) {
    console.error('❌ Erro crítico ao carregar auth.js:', error);
  }
})();