import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

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

  const userRef = db.collection('usuarios').doc(decoded.uid);
  const snap = await userRef.get();
  const data = snap.data() || {};

  const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preapproval = new PreApproval(mpClient);

  try {
    if (data.subscriptionId) {
      const info = await preapproval.get({ id: data.subscriptionId });
      let expiresAt = null;
      if (info.next_payment_date) {
        expiresAt = Timestamp.fromDate(new Date(info.next_payment_date));
      }
      await preapproval.update({ id: data.subscriptionId, body: { status: 'cancelled' } });
      await userRef.set({ status: 'cancelled', expiresAt }, { merge: true });
    } else {
      await userRef.set({ status: 'cancelled' }, { merge: true });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao cancelar assinatura:', err);
    return res.status(500).json({ error: 'cancel-failed' });
  }
}
