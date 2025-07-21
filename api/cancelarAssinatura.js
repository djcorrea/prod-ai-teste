import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import axios from 'axios';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'Token ausente' });
  }

  const auth = getAuth();
  const db = getFirestore();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userRef = db.collection('usuarios').doc(decoded.uid);
  const snap = await userRef.get();
  const data = snap.exists ? snap.data() : {};

  if ((data.plano || 'gratis') === 'gratis') {
    return res.status(403).json({ error: 'Usuário sem assinatura ativa' });
  }

  const preapprovalId = data.preapproval_id || data.preapprovalId;
  if (!preapprovalId) {
    return res.status(500).json({ error: 'preapproval_id ausente' });
  }

  try {
    await axios.put(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      { status: 'cancelled' },
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('Mercado Pago error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro ao cancelar no Mercado Pago' });
  }

  await userRef.set(
    {
      plano: 'cancelado',
      dataCancelamento: Timestamp.now(),
      dataVencimento: data.dataVencimento || null,
    },
    { merge: true }
  );

  return res.status(200).json({ message: 'Assinatura cancelada com sucesso' });
}
