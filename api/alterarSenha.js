import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
    }

    const { idToken, timestamp } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ message: 'Token ausente.' });
    }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);

    console.log(`🔐 Senha alterada para uid ${decoded.uid} em ${timestamp || new Date().toISOString()}`);

    return res.status(200).json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar troca de senha:', error);
    return res.status(500).json({ message: 'Erro ao registrar troca de senha' });
  }
}
