import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, phoneNumber } = user;
  const docRef = db.collection('usuarios').doc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    await docRef.set({
      uid,
      email: email || null,
      phone: phoneNumber || null,
      plano: 'gratis',
      mensagensRestantes: 10,
      dataUltimoReset: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      entrevistaConcluida: false,
    });
  }
});

export const registerAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
  }

  const { fingerprint, phone } = data;
  if (!fingerprint || !phone) {
    throw new functions.https.HttpsError('invalid-argument', 'Dados inválidos');
  }

  const ip = (context.rawRequest.ip || '').replace('::ffff:', '');
  const oneWeekAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const registrations = db.collection('registrations');

  // Checa tentativas recentes por IP, telefone e fingerprint
  const [ipRecent, phoneRecent, fpRecent, fpSnap, phoneSnap] = await Promise.all([
    registrations.where('ip', '==', ip).where('createdAt', '>=', oneWeekAgo).get(),
    registrations.where('phone', '==', phone).where('createdAt', '>=', oneWeekAgo).get(),
    registrations.where('fingerprint', '==', fingerprint).where('createdAt', '>=', oneWeekAgo).get(),
    db.collection('fingerprints').doc(fingerprint).get(),
    db.collection('phones').doc(phone).get()
  ]);

  if (fpSnap.exists || phoneSnap.exists) {
    throw new functions.https.HttpsError('already-exists', 'Fingerprint ou telefone já utilizados');
  }

  const limitReached = ipRecent.size >= 2 || phoneRecent.size >= 2 || fpRecent.size >= 2;
  if (limitReached) {
    throw new functions.https.HttpsError('resource-exhausted', 'Limite de cadastro excedido');
  }

  const now = admin.firestore.Timestamp.now();
  await Promise.all([
    db.collection('fingerprints').doc(fingerprint).set({ uid: context.auth.uid, phone, createdAt: now }),
    db.collection('phones').doc(phone).set({ uid: context.auth.uid, fingerprint, createdAt: now }),
    registrations.add({ uid: context.auth.uid, ip, phone, fingerprint, createdAt: now })
  ]);

  return { success: true };
});
