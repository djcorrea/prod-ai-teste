import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const auth = getAuth();
  const db = getFirestore();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await auth.deleteUser(decoded.uid);
    await db.collection('usuarios').doc(decoded.uid).delete();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting account:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
