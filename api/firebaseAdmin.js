
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Validação segura da variável de ambiente
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is required');
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required');
}

let app;
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('✅ Firebase Admin inicializado com sucesso');
  } catch (parseError) {
    console.error('❌ Erro ao fazer parse do FIREBASE_SERVICE_ACCOUNT:', parseError.message);
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON format');
  }
} else {
  app = getApps()[0];
  console.log('✅ Firebase Admin já estava inicializado');
}

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
