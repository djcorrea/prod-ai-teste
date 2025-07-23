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
    if (phone) updates.phone = phone;
    if (email) updates.email = email;

    let avatarUrl = '';

    if (avatar) {
      const match = avatar.match(/^data:(image\/(png|jpeg|jpg|gif));base64,(.*)$/);
      if (!match) {
        return res.status(400).json({ error: 'INVALID_IMAGE' });
      }
      const buffer = Buffer.from(match[3], 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'IMAGE_TOO_LARGE' });
      }
      const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
      const bucket = getStorage().bucket();

      // Remove avatar antigo com extensão diferente, se existir
      const existing = await userRef.get();
      if (existing.exists && existing.data().avatar) {
        const oldMatch = existing.data().avatar.match(/\.([a-zA-Z0-9]+)$/);
        const oldExt = oldMatch ? oldMatch[1] : null;
        if (oldExt && oldExt !== ext) {
          await bucket.file(`avatars/${decoded.uid}.${oldExt}`).delete().catch(() => {});
        }
      }

      const fileName = `avatars/${decoded.uid}.${ext}`;
      await bucket.file(fileName).save(buffer, {
        metadata: { contentType: match[1], cacheControl: 'public,max-age=3600' },
        public: true,
      });
      avatarUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
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
          return res.status(400).json({ error: 'EMAIL_EXISTS' });
        }
        throw err;
      }
    }

    return res.status(200).json({ success: true, avatar: avatarUrl });
  }

  return res.status(405).end();
}
