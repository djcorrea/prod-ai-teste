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
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const userRef = db.collection('usuarios').doc(decoded.uid);

    if (req.method === 'GET') {
      const snap = await userRef.get();
      const data = snap.exists ? snap.data() : {};
      return res.status(200).json({
        email: data.email || decoded.email || '',
        phone: data.phone || '',
        avatar: data.avatar_url || '',
        planType: data.plano === 'plus' ? 'PLUS' : 'FREE'
      });
    }

    if (req.method === 'PUT') {
      const { email, phone } = req.body || {};
      await userRef.set({ email, phone }, { merge: true });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('profile error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
