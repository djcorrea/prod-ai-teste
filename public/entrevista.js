const firebaseConfig = {
  apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain: "prodai-58436.firebaseapp.com",
  projectId: "prodai-58436",
  storageBucket: "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId: "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId: "G-MBDHDYN6Z0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Verifica autenticação e se a entrevista já foi concluída
async function checkAccess() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      const snap = await db.collection('usuarios').doc(user.uid).get();
      if (snap.exists && snap.data().entrevistaConcluida) {
        window.location.href = 'index.html';
        return;
      }
      resolve(user);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAccess();
  const form = document.getElementById('interviewForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const perfil = {
      nomeArtistico: document.getElementById('nomeArtistico').value.trim(),
      nivelTecnico: document.getElementById('nivelTecnico').value,
      daw: document.getElementById('daw').value,
      dificuldade: document.getElementById('dificuldade').value.trim(),
      estilo: document.getElementById('estilo').value.trim(),
      sobre: document.getElementById('sobre').value.trim(),
    };
    try {
      await db.collection('usuarios').doc(user.uid).set({
        perfil,
        entrevistaConcluida: true,
      }, { merge: true });
      window.location.href = 'entrevista-final.html';
    } catch (err) {
      console.error(err);
    }
  });
});
