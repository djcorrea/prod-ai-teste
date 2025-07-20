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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const snap = await db.collection('usuarios').doc(decoded.uid).get();
    const data = snap.exists ? snap.data() : {};
    const status = data.plano === 'plus' ? 'active' : 'cancelled';
    return res.status(200).json({
      planType: data.plano === 'plus' ? 'PLUS' : 'FREE',
      status,
      expiresAt: data.expires_at || null
    });
  } catch (err) {
    console.error('subscription error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
