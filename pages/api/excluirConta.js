import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'Token não fornecido' });
  }

  const auth = getAuth();
  const db = getFirestore();

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    await auth.deleteUser(uid);
    await db.collection('usuarios').doc(uid).delete();

    return res.status(200).json({ message: 'Conta excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return res.status(500).json({ error: 'Falha ao excluir conta' });
  }
}
