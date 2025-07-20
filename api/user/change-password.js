import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
const auth = getAuth();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { newPassword } = req.body || {};
  if (!newPassword) return res.status(400).json({ error: 'Missing password' });

  try {
    const decoded = await auth.verifyIdToken(token);
    await auth.updateUser(decoded.uid, { password: newPassword });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('change-password error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
