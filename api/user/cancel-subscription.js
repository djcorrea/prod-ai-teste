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
  const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preapprovalClient = new PreApproval(mpClient);

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

  try {
    // busca assinatura ativa pelo UID
    const search = await preapprovalClient.search({ options: { external_reference: decoded.uid } });
    const activeSub = (search.results || []).find(sub => sub.status !== 'cancelled');

    if (!activeSub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await preapprovalClient.update({ id: activeSub.id, body: { status: 'cancelled' } });

    const expires = activeSub.next_payment_date
      ? Timestamp.fromDate(new Date(activeSub.next_payment_date))
      : null;

    await userRef.set(
      { status: 'cancelled', expiresAt: expires },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao cancelar assinatura:', err);
    return res.status(500).json({ error: 'cancel-failed' });
  }
}
