import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

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
    const data = snap.exists ? snap.data() : {};
    return res.status(200).json({
      email: data.email || decoded.email || '',
      phone: data.phone || '',
      avatar: data.avatar || ''
    });
  }

  if (req.method === 'PUT') {
    const { email, phone, avatar } = req.body || {};

    const updates = {};

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'EMAIL_INVALIDO' });
      }
      updates.email = email;
    }

    if (phone) {
      const phoneRegex = /^(\+?\d{1,3}[\s-]?)?(\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'TELEFONE_INVALIDO' });
      }
      updates.phone = phone;
    }

    let avatarUrl = '';
    if (avatar) {
      const match = avatar.match(/^data:(image\/(png|jpeg|jpg|gif));base64,(.*)$/);
      if (!match) {
        return res.status(400).json({ error: 'IMAGEM_INVALIDA' });
      }
      const buffer = Buffer.from(match[3], 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'IMAGEM_GRANDE' });
      }
      const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
      const bucket = getStorage().bucket();
      const filePath = `avatars/${decoded.uid}.${ext}`;
      await bucket.file(filePath).save(buffer, {
        resumable: false,
        public: true,
        contentType: match[1],
      });
      avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      updates.avatar = avatarUrl;
    }

    if (Object.keys(updates).length) {
      await userRef.set(updates, { merge: true });
    }

    if (email && email !== decoded.email) {
      try {
        await auth.updateUser(decoded.uid, { email });
      } catch (err) {
        if (err.code === 'auth/email-already-exists') {
          return res.status(400).json({ error: 'EMAIL_DUPLICADO' });
        }
        throw err;
      }
    }

    return res.status(200).json({ success: true, avatar: avatarUrl });
  }

  return res.status(405).end();
}
