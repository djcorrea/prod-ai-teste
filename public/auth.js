console.log('auth.js iniciado');

(async () => {
  try {
    // Importações dinâmicas
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js');
    const { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signInWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, PhoneAuthProvider, signInWithCredential, linkWithCredential } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    const { getFirestore, doc, getDoc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js');
    
    // Importação do FingerprintJS
    let FingerprintJS;
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js');
      FingerprintJS = mod.default || mod;
    } catch (e) {
      console.warn('FingerprintJS não carregado:', e);
      FingerprintJS = window.FingerprintJS;
    }

    // Configuração Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
      authDomain: "prodai-58436.firebaseapp.com",
      projectId: "prodai-58436",
      storageBucket: "prodai-58436.appspot.com",
      messagingSenderId: "801631191322",
      appId: "1:801631322:web:80e3d29cf7468331652ca3",
      measurementId: "G-MBDHDYN6Z0"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const functions = getFunctions(app);

    // Variáveis globais
    let confirmationResult = null;
    let lastPhone = "";
    let isNewUserRegistering = false;
    let recaptchaVerifier = null;

    // Mensagens de erro em português
    const firebaseErrorsPt = {
      'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato +55 DDD + número.',
      'auth/missing-phone-number': 'Digite seu número de telefone.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/quota-exceeded': 'Limite de SMS excedido. Tente novamente mais tarde.',
      'auth/user-disabled': 'Usuário desativado.',
      'auth/code-expired': 'O código expirou. Solicite um novo.',
      'auth/invalid-verification-code': 'Código de verificação inválido.',
      'auth/captcha-check-failed': 'Não foi possível validar este número. Certifique-se de que digitou corretamente, com DDD e sem espaços.',
      'auth/network-request-failed': 'Falha de conexão com a internet.',
      'auth/app-not-authorized': 'App não autorizado. Verifique as configurações do Firebase.',
      'auth/session-expired': 'Sessão expirada. Tente novamente.',
      'auth/invalid-verification-id': 'Falha na verificação. Tente novamente.',
      'auth/email-already-in-use': 'Esse e-mail já está cadastrado. Faça login ou recupere sua senha.',
      'auth/invalid-email': 'E-mail inválido. Digite um e-mail válido.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    };

    // Função para mostrar mensagens
    function showMessage(messageOrError, type = "error") {
      const msg = typeof messageOrError === 'object' && messageOrError.code
        ? (firebaseErrorsPt[messageOrError.code] || messageOrError.message || 'Erro desconhecido.')
        : messageOrError;

      const el = document.getElementById("error-message");
      if (el) {
        el.innerText = msg;
        el.style.display = "block";
        el.classList.remove("error-message", "success-message");
        el.classList.add(type === "success" ? "success-message" : "error-message");
      } else {
        console.log(`${type}: ${msg}`);
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
      return null;
    }

    // Função para garantir div do reCAPTCHA
    function ensureRecaptchaDiv() {
      let recaptchaDiv = document.getElementById('recaptcha-container');
      if (!recaptchaDiv) {
        recaptchaDiv = document.createElement('div');
        recaptchaDiv.id = 'recaptcha-container';
        recaptchaDiv.style.display = 'none';
        document.body.appendChild(recaptchaDiv);
      }
      return recaptchaDiv;
    }

    // Função para mostrar seção SMS
    function showSMSSection() {
      const smsSection = document.getElementById('sms-section');
      if (smsSection) smsSection.style.display = 'block';

      const signUpBtn = document.getElementById('signUpBtn');
      if (signUpBtn) signUpBtn.disabled = true;
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
        const result = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await result.user.getIdToken();
        localStorage.setItem("user", JSON.stringify(result.user));
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
        showMessage("Enviamos um link de redefinição de senha para seu e-mail.", "success");
      } catch (error) {
        console.error('Erro na recuperação de senha:', error);
        showMessage(error, "error");
      }
    }

    // Função para enviar SMS
    async function sendSMS(rawPhone) {
      function formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        return '+55' + clean.replace(/^55/, '');
      }

      const phone = formatPhone(rawPhone);

      if (!phone.startsWith('+55') || phone.length < 13) {
        showMessage("Formato inválido. Use DDD + número, ex: 34987654321", "error");
        return false;
      }

      try {
        // Verifica se o número já foi usado
        const phoneSnap = await getDoc(doc(db, "phones", phone));
        if (phoneSnap.exists()) {
          showMessage("Esse telefone já está cadastrado em outra conta!", "error");
          return false;
        }

        // Garante que o container do reCAPTCHA existe
        ensureRecaptchaDiv();

        // Limpa reCAPTCHA anterior
        if (recaptchaVerifier) {
          try { 
            recaptchaVerifier.clear(); 
          } catch (e) {
            console.warn('Erro ao limpar reCAPTCHA anterior:', e);
          }
          recaptchaVerifier = null;
        }

        // Cria novo reCAPTCHA
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log("✅ reCAPTCHA resolvido:", response);
          },
          'expired-callback': () => {
            console.warn("⚠️ reCAPTCHA expirado.");
            showMessage("reCAPTCHA expirou. Tente novamente.", "error");
          }
        });

        await recaptchaVerifier.render();
        
        confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        lastPhone = phone;
        showMessage("Código SMS enviado! Digite o código recebido.", "success");
        showSMSSection();
        return true;

      } catch (error) {
        console.error("❌ Erro ao enviar SMS:", error);
        showMessage(error, "error");
        return false;
      }
    }

    // Função de cadastro
    async function signUp() {
      console.log('signUp chamada');
      
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const rawPhone = document.getElementById("phone")?.value?.trim();

      if (!email || !password || !rawPhone) {
        showMessage("Preencha todos os campos.", "error");
        return;
      }

      const formattedPhone = '+55' + rawPhone.replace(/\D/g, '').replace(/^55/, '');

      if (!confirmationResult || lastPhone !== formattedPhone) {
        isNewUserRegistering = true;
        const sent = await sendSMS(rawPhone);
        if (!sent) return;
        return;
      }

      showMessage("Código SMS enviado! Digite o código recebido no campo abaixo.", "success");
    }

    // Função para confirmar código SMS
    async function confirmSMSCode() {
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const phone = document.getElementById("phone")?.value?.trim();
      const code = document.getElementById("smsCode")?.value?.trim();

      if (!code || code.length < 6) {
        showMessage("Digite o código recebido por SMS.", "error");
        return;
      }

      try {
        const phoneCred = PhoneAuthProvider.credential(confirmationResult.verificationId, code);
        const phoneUser = await signInWithCredential(auth, phoneCred);

        const emailCred = EmailAuthProvider.credential(email, password);
        await linkWithCredential(phoneUser.user, emailCred);

        const fingerprint = await getFingerprint();
        if (fingerprint) {
          try {
            const registerAccountFunction = httpsCallable(functions, 'registerAccount');
            await registerAccountFunction({ fingerprint, phone });
          } catch (e) {
            console.warn('Erro ao registrar dados:', e);
            showMessage(e.message || 'Erro ao registrar dados', 'error');
            return;
          }
        }

        const idToken = await phoneUser.user.getIdToken();
        localStorage.setItem("idToken", idToken);
        localStorage.setItem("user", JSON.stringify({ uid: phoneUser.user.uid, email: phoneUser.user.email }));

        console.log("🎯 Redirecionando novo usuário para entrevista.html");
        window.location.replace("entrevista.html");

      } catch (error) {
        console.error("Erro no cadastro:", error);
        showMessage(error, "error");
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

    // Configurar listeners dos botões quando DOM estiver pronto
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

      console.log('Event listeners configurados');
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }

    // Verificar estado de autenticação
    checkAuthState();

    console.log('auth.js carregado com sucesso');

  } catch (error) {
    console.error('Erro ao carregar auth.js:', error);
  }
})();