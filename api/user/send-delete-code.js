import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
const auth = getAuth();
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await db.collection('usuarios').doc(decoded.uid).set({ deleteCode: code, deleteCodeAt: FieldValue.serverTimestamp() }, { merge: true });
    // Aqui você enviaria o e-mail com o código
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-delete-code error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
