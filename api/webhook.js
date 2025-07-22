import admin from 'firebase-admin';

export const config = { api: { bodyParser: true } };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.sendStatus(405);
  const { type, data } = req.body;

  if (type === 'preapproval') {
    const { id: preapprovalId, payer_email: email, status } = data;
    if (preapprovalId && email && status === 'authorized') {
      const snap = await admin
        .firestore()
        .collection('usuarios')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.set(
          {
            preapproval_id: preapprovalId,
            plano: 'plus',
            isPlus: true,
            upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  }

  if (type === 'payment' && data.status === 'approved') {
    const uid = data.external_reference;
    await admin
      .firestore()
      .collection('usuarios')
      .doc(uid)
      .set(
        {
          isPlus:     true,
          plano:      'plus',
          upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  return res.sendStatus(200);
}
