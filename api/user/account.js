import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
const auth = getAuth();
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const { code } = req.body || {};
    const snap = await db.collection('usuarios').doc(decoded.uid).get();
    if (!snap.exists || snap.data().deleteCode !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }
    await Promise.all([
      db.collection('usuarios').doc(decoded.uid).delete(),
      auth.deleteUser(decoded.uid)
    ]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('account delete error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
