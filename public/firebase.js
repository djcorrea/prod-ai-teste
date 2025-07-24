// public/firebase.js
// Firebase modular v11+ (compatível com CDN e import dinâmico)
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.24.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.24.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.24.0/firebase-firestore.js';

// Configuração do seu projeto Firebase (substitua pelos seus dados reais)
const firebaseConfig = {
  apiKey:            "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain:        "prodai-58436.firebaseapp.com",
  projectId:         "prodai-58436",
  storageBucket:     "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId:             "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId:     "G-MBDHDYN6Z0"
};

// Inicializa Firebase apenas uma vez
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
