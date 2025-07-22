import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, preapproval_id } = req.body || {};
  if (!idToken || !preapproval_id) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  const auth = getAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getFirestore();
  await db
    .collection('usuarios')
    .doc(decoded.uid)
    .set({ preapproval_id, plano: 'plus', isPlus: true }, { merge: true });

  return res.status(200).json({ success: true });
}
