import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { idToken, email, telefone } = req.body || {};
    if (!idToken) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const auth = getAuth();
    const db = getFirestore();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const updateData = {};
    if (email) updateData.email = email;
    if (telefone) updateData.telefone = telefone;

    const userRef = db.collection('usuarios').doc(uid);
    if (Object.keys(updateData).length) {
      await userRef.set(updateData, { merge: true });
      if (email && email !== decoded.email) {
        await auth.updateUser(uid, { email });
      }
    }

    return res.status(200).json({ message: 'Dados atualizados com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar dados:', err);
    if (err.code === 'auth/argument-error') {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }
    return res.status(500).json({ message: 'Erro ao atualizar dados' });
  }
}
