
// === Firebase Auth com login por telefone e reCAPTCHA invisível ===

const firebaseConfig = {
  apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain: "prodai-58436.firebaseapp.com",
  projectId: "prodai-58436",
  storageBucket: "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId: "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId: "G-MBDHDYN6Z0"
};

if (!window.firebase) {
  alert("Firebase SDK não carregado!");
}
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// Aguarde o Firebase carregar antes de usar
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

// Garante que a div do reCAPTCHA existe no HTML
function ensureRecaptchaDiv() {
  let recaptchaDiv = document.getElementById('recaptcha-container');
  if (!recaptchaDiv) {
    recaptchaDiv = document.createElement('div');
    recaptchaDiv.id = 'recaptcha-container';
    recaptchaDiv.style.display = 'none'; // invisível
    document.body.appendChild(recaptchaDiv);
  }
}

// Inicializa o RecaptchaVerifier (apenas 1 vez por fluxo)
let recaptchaVerifier = null;
function getRecaptchaVerifier() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (e) {}
    recaptchaVerifier = null;
  }
  ensureRecaptchaDiv();
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'invisible',
    callback: (response) => {
      // reCAPTCHA resolvido automaticamente
    },
    'expired-callback': () => {
      showMessage("O reCAPTCHA expirou. Tente novamente.", "error");
    }
  });
  return recaptchaVerifier;
}

// Função para mostrar mensagens de erro/sucesso
function showMessage(msg, type = "error") {
  let el = document.getElementById("error-message");
  if (!el) {
    el = document.createElement("div");
    el.id = "error-message";
    el.style.position = "fixed";
    el.style.top = "10px";
    el.style.left = "50%";
    el.style.transform = "translateX(-50%)";
    el.style.zIndex = "9999";
    el.style.background = type === "success" ? "#4caf50" : "#f44336";
    el.style.color = "#fff";
    el.style.padding = "10px 20px";
    el.style.borderRadius = "4px";
    document.body.appendChild(el);
  }
  el.innerText = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

// Função para enviar SMS
async function sendSMS(rawPhone) {
  await waitForFirebase();
  ensureRecaptchaDiv();

  // Formata o número para +55DDDXXXXXXXXX
  const clean = rawPhone.replace(/\D/g, '');
  const phone = '+55' + clean.replace(/^55/, '');

  if (!phone.match(/^\+55\d{10,11}$/)) {
    showMessage("Formato inválido. Use DDD + número, ex: 34987654321");
    return false;
  }

  const verifier = getRecaptchaVerifier();
  try {
    await verifier.render();
    await verifier.verify();

    const result = await auth.signInWithPhoneNumber(phone, verifier);
    window.confirmationResult = result;
    showMessage("Código SMS enviado! Digite o código recebido.", "success");
    window.showSMSSection && window.showSMSSection();
    lastPhone = phone;
    return true;
  } catch (error) {
    let msg = error.message || "Erro ao enviar SMS.";
    if (error.code === "auth/too-many-requests") {
      msg = "Muitas tentativas. Tente novamente mais tarde.";
    } else if (error.code === "auth/quota-exceeded") {
      msg = "Limite de SMS excedido. Tente novamente mais tarde.";
    } else if (error.code === "auth/invalid-phone-number") {
      msg = "Número de telefone inválido.";
    } else if (error.code === "auth/app-not-authorized") {
      msg = "App não autorizado. Verifique as configurações do Firebase.";
    } else if (error.code === "auth/internal-error") {
      msg = "Erro interno do Firebase. Verifique se o domínio está autorizado no console do Firebase.";
    }
    showMessage(msg);
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (e) {}
      recaptchaVerifier = null;
    }
    return false;
  }
}

// Função para confirmar o código SMS
async function confirmSMSCode(code) {
  if (!window.confirmationResult) {
    showMessage("Envie o SMS primeiro.");
    return;
  }
  try {
    const result = await window.confirmationResult.confirm(code);
    showMessage("Telefone autenticado com sucesso!", "success");
    // Aqui você pode redirecionar ou salvar o usuário
  } catch (error) {
    let msg = error.message || "Erro ao confirmar código.";
    if (error.code === "auth/invalid-verification-code") {
      msg = "Código de verificação inválido.";
    }
    showMessage(msg);
  }
}

// Exemplo de uso (adicione seus próprios campos/input):
// sendSMS(document.getElementById('phone').value);
// confirmSMSCode(document.getElementById('smsCode').value);

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
    alert(msg);
  }
}

async function getFingerprint() {
  if (window.FingerprintJS) {
    const fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  }
  return null;
}

let confirmationResult = null;
let lastPhone = "";
let isNewUserRegistering = false; // Flag para controlar novos usuários

window.showSMSSection = function () {
  const smsSection = document.getElementById('sms-section');
  if (smsSection) smsSection.style.display = 'block';

  const signUpBtn = document.getElementById('signUpBtn');
  if (signUpBtn) signUpBtn.disabled = true;
};

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    const idToken = await result.user.getIdToken();
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("idToken", idToken);

    try {
      const snap = await db.collection('usuarios').doc(result.user.uid).get();
      if (!snap.exists || snap.data().entrevistaConcluida === false) {
        window.location.href = "entrevista.html";
      } else {
        window.location.href = "index.html";
      }
    } catch (e) {
      window.location.href = "entrevista.html";
    }
  } catch (error) {
    showMessage(error, "error");
    console.error(error);
  }
};

window.forgotPassword = async function () {
  const email = document.getElementById("email").value.trim();
  if (!email) {
    showMessage("Digite seu e-mail para recuperar a senha.", "error");
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    showMessage("Enviamos um link de redefinição de senha para seu e-mail.", "success");
  } catch (error) {
    showMessage(error, "error");
  }
};

async function sendSMS(rawPhone) {
  await waitForFirebase();
  ensureRecaptchaDiv();

  // Formata o número para +55DDDXXXXXXXXX
  const clean = rawPhone.replace(/\D/g, '');
  const phone = '+55' + clean.replace(/^55/, '');

  if (!phone.match(/^\+55\d{10,11}$/)) {
    showMessage("Formato inválido. Use DDD + número, ex: 34987654321");
    return;
  }

  const verifier = getRecaptchaVerifier();
  try {
    await verifier.render();
    await verifier.verify();

    const confirmationResult = await auth.signInWithPhoneNumber(phone, verifier);
    window.confirmationResult = confirmationResult;
    showMessage("Código SMS enviado! Digite o código recebido.", "success");
    // Aqui você pode exibir o campo para o usuário digitar o código
  } catch (error) {
    let msg = error.message || "Erro ao enviar SMS.";
    if (error.code === "auth/too-many-requests") {
      msg = "Muitas tentativas. Tente novamente mais tarde.";
    } else if (error.code === "auth/quota-exceeded") {
      msg = "Limite de SMS excedido. Tente novamente mais tarde.";
    } else if (error.code === "auth/invalid-phone-number") {
      msg = "Número de telefone inválido.";
    } else if (error.code === "auth/app-not-authorized") {
      msg = "App não autorizado. Verifique as configurações do Firebase.";
    }
    showMessage(msg);
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (e) {}
      recaptchaVerifier = null;
    }
  }
}

window.signUp = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const rawPhone = document.getElementById("phone").value.trim();

  if (!email || !password || !rawPhone) {
    showMessage("Preencha todos os campos.", "error");
    return;
  }

  const formattedPhone = '+55' + rawPhone.replace(/\D/g, '').replace(/^55/, '');

  // Se não há confirmationResult ou o telefone mudou, envia SMS
  if (!window.confirmationResult || lastPhone !== formattedPhone) {
    isNewUserRegistering = true;
    const sent = await sendSMS(rawPhone);
    if (!sent) {
      showMessage("Não foi possível enviar o SMS. Corrija os dados e tente novamente.", "error");
      return;
    }
    return;
  }

  showMessage("Código SMS enviado! Digite o código recebido no campo abaixo.", "success");
  window.showSMSSection && window.showSMSSection();
};

window.confirmSMSCode = async function() {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();
  const code     = document.getElementById("smsCode").value.trim();

  if (!code || code.length < 6) {
    showMessage("Digite o código recebido por SMS.", "error");
    return;
  }

  try {
    const phoneCred = firebase.auth.PhoneAuthProvider.credential(confirmationResult.verificationId, code);
    const phoneUser = await auth.signInWithCredential(phoneCred);

    const emailCred = firebase.auth.EmailAuthProvider.credential(email, password);
    await phoneUser.user.linkWithCredential(emailCred);

    const fingerprint = await getFingerprint();
    if (fingerprint) {
      const functions = firebase.app().functions();
      try {
        await functions.httpsCallable('registerAccount')({ fingerprint, phone });
      } catch (e) {
        showMessage(e.message || 'Erro ao registrar dados', 'error');
        return;
      }
    }

    const idToken = await phoneUser.user.getIdToken();
    localStorage.setItem("idToken", idToken);
    localStorage.setItem("user", JSON.stringify({ uid: phoneUser.user.uid, email: phoneUser.user.email }));

    // CORRIGIDO: Pausa temporariamente o listener do checkAuthState e redireciona
    const currentListener = auth.onAuthStateChanged;
    auth.onAuthStateChanged = () => {}; // Para o listener temporariamente
    
    console.log("🎯 Redirecionando novo usuário para entrevista.html");
    window.location.replace("entrevista.html");
    
    // Restaura o listener após 5 segundos (caso algo dê errado)
    setTimeout(() => {
      auth.onAuthStateChanged = currentListener;
    }, 5000);

  } catch (error) {
    console.error("Erro no cadastro:", error);
    showMessage(error, "error");
  }
};

window.register = window.signUp;

window.logout = async function () {
  try { await auth.signOut(); } catch (e) {}
  localStorage.removeItem("user");
  localStorage.removeItem("idToken");
  window.location.href = "login.html";
};

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

      // Se for novo usuário registrando, não interfere
      if (isNewUserRegistering && isEntrevistaPage) {
        isNewUserRegistering = false; // Reset da flag
        resolve(user);
        return;
      }

      if (!user && !isLoginPage) {
        window.location.href = "login.html";
      } else if (user && isLoginPage) {
        try {
          const snap = await db.collection('usuarios').doc(user.uid).get();
          if (snap.exists && snap.data().entrevistaConcluida === false) {
            window.location.href = "entrevista.html";
          } else if (snap.exists && snap.data().entrevistaConcluida === true) {
            window.location.href = "index.html";
          } else {
            // Usuário não tem documento ainda - é novo
            window.location.href = "entrevista.html";
          }
        } catch (e) {
          window.location.href = "entrevista.html"; // Em caso de erro, vai para entrevista
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
            const snap = await db.collection('usuarios').doc(user.uid).get();
            if (snap.exists && snap.data().entrevistaConcluida === false && !isEntrevistaPage) {
              window.location.href = "entrevista.html";
              return;
            }
          } catch (e) {}
        } catch (error) {
          console.error('Erro ao obter token:', error);
        }
      }
      resolve(user);
    });
  });
}

waitForFirebase().then(() => {
  checkAuthState();
});

document.addEventListener("DOMContentLoaded", function () {
  const forgot = document.getElementById("forgotPasswordLink");
  if (forgot) {
    forgot.addEventListener("click", function (e) {
      e.preventDefault();
      window.forgotPassword();
    });
  }
});
