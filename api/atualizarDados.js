import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  const auth = getAuth();
  const db = getFirestore();

  if (req.method !== 'PUT') {
    return res.status(405).end();
  }

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

  const { email, phone } = req.body || {};
  const userRef = db.collection('usuarios').doc(decoded.uid);
  await userRef.set({ email: email || decoded.email, phone }, { merge: true });
  if (email && email !== decoded.email) {
    await auth.updateUser(decoded.uid, { email });
  }

  return res.status(200).json({ success: true });
}
