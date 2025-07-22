import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, nomeArtistico, estilo, dificuldade, daw, nivelTecnico, sobre } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'Token missing' });

  try {
    const auth = getAuth();
    const db = getFirestore();
    const decoded = await auth.verifyIdToken(idToken);
    const userRef = db.collection('usuarios').doc(decoded.uid);

    const perfil = { nomeArtistico, estilo, dificuldade, daw, nivelTecnico, sobre };
    Object.keys(perfil).forEach(key => {
      if (perfil[key] === undefined) delete perfil[key];
    });

    await userRef.set({ perfil, entrevistaConcluida: true }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}
