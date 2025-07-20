import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fetch from 'node-fetch';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { currentPassword, newPassword } = req.body || {};
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  const auth = getAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    const verify = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: decoded.email,
          password: currentPassword,
          returnSecureToken: true,
        }),
      }
    );
    if (!verify.ok) {
      return res.status(400).json({ error: 'SENHA_INVALIDA' });
    }
  } catch {
    return res.status(400).json({ error: 'SENHA_INVALIDA' });
  }

  await auth.updateUser(decoded.uid, { password: newPassword });
  return res.status(200).json({ success: true });
}
