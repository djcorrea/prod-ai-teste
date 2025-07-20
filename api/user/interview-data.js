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

  const userRef = db.collection('usuarios').doc(decoded.uid);

  if (req.method === 'GET') {
    const snap = await userRef.get();
    const data = snap.exists && snap.data().perfil ? snap.data().perfil : {};
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    await userRef.set({ perfil: req.body || {} }, { merge: true });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
