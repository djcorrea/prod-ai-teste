import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Imagem inválida' });
  }

  const match = image.match(/^data:(image\/(png|jpeg|jpg|gif));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Formato inválido' });
  }

  const mime = match[1];
  const ext = mime.split('/')[1];
  const data = match[3];
  const buffer = Buffer.from(data, 'base64');

  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Tamanho excedido' });
  }

  const dir = path.join(process.cwd(), 'public', 'avatars');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${decoded.uid}.${ext}`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, buffer);

  const url = `/avatars/${filename}`;
  await db.collection('usuarios').doc(decoded.uid).set({ avatar: url }, { merge: true });

  return res.status(200).json({ success: true, url });
}
