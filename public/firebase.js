// public/firebase.js
// Firebase modular v11+ (compatível com CDN e import dinâmico)
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.24.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.24.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.24.0/firebase-firestore.js';

// Configuração do seu projeto Firebase (substitua pelos seus dados reais)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SUA_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase apenas uma vez
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
