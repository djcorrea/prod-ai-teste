import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const auth = getAuth();
  const db = getFirestore();

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { password, code } = req.body || {};
  const userRef = db.collection('usuarios').doc(decoded.uid);
  const snap = await userRef.get();
  const data = snap.data() || {};

  if (!password || !code || code !== data.deleteCode) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  await auth.deleteUser(decoded.uid);
  await userRef.delete();
  return res.status(200).json({ success: true });
}
