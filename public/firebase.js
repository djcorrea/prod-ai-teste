// firebase.js - Configuração Firebase Corrigida
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

// Configuração do Firebase (configuração correta do projeto)
const firebaseConfig = {
  apiKey: "AIzaSyBwJETlTmROo8wSi_KaasJE7ex_OW2O5yo",
  authDomain: "prod-ai-teste.firebaseapp.com",
  projectId: "prod-ai-teste",
  storageBucket: "prod-ai-teste.firebasestorage.app",
  messagingSenderId: "590918971714",
  appId: "1:590918971714:web:ab8afe99a3b9a6e2b82d3f"
};

// Inicializar Firebase apenas uma vez
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase inicializado com sucesso');
} else {
  app = getApps()[0];
  console.log('✅ Firebase já estava inicializado');
}

// Exportar instâncias
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('🔥 Firebase config carregado');