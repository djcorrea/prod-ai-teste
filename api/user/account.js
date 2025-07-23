import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fetch from 'node-fetch';

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

  // Verifica a senha do usuário
  try {
    const verify = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: decoded.email,
          password,
          returnSecureToken: false,
        }),
      }
    );
    if (!verify.ok) {
      return res.status(400).json({ error: 'SENHA_INVALIDA' });
    }
  } catch {
    return res.status(400).json({ error: 'SENHA_INVALIDA' });
  }

  // Remove dados adicionais (fingerprints, phones, avatar)
  const deletes = [];

  deletes.push(
    db
      .collection('fingerprints')
      .where('uid', '==', decoded.uid)
      .get()
      .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
  );

  deletes.push(
    db
      .collection('phones')
      .where('uid', '==', decoded.uid)
      .get()
      .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
  );

  if (data.avatar) {
    const match = data.avatar.match(/avatars\/([^?]+)/);
    if (match) {
      const bucket = getStorage().bucket();
      deletes.push(bucket.file(`avatars/${match[1]}`).delete().catch(() => {}));
    }
  }

  await Promise.all(deletes);
  await auth.deleteUser(decoded.uid);
  await userRef.delete();
  return res.status(200).json({ success: true });
}
