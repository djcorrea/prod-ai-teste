import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, timestamp } = req.body || {};
  if (!idToken || !timestamp) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const auth = getAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log(`Senha alterada para ${decoded.uid} em ${new Date(timestamp).toISOString()}`);
  return res.status(200).json({ success: true });
}
