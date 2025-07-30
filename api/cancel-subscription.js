import admin from 'firebase-admin';

export const config = { api: { bodyParser: true } };

// Inicializar Firebase Admin se não já inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar token de autenticação
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autorização não fornecido' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('❌ Token inválido:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

    const userId = decodedToken.uid;
    console.log('🔧 Iniciando cancelamento de assinatura para usuário:', userId);

    // Buscar dados do usuário no Firestore
    const userDoc = await admin.firestore().collection('usuarios').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ Usuário não encontrado no Firestore');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    
    // Verificar se o usuário tem plano Plus
    if (userData.plano !== 'plus' && !userData.isPlus) {
      console.log('❌ Usuário não possui plano Plus');
      return res.status(400).json({ error: 'Usuário não possui assinatura ativa para cancelar' });
    }

    // Verificar se há subscription_id do Mercado Pago
    if (!userData.subscription_id) {
      console.log('⚠️ Usuário Plus sem subscription_id - cancelando apenas no sistema');
      
      // Marcar como cancelado apenas no sistema interno
      await admin.firestore().collection('usuarios').doc(userId).update({
        subscriptionStatus: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        shouldRenew: false
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Assinatura cancelada com sucesso no sistema interno' 
      });
    }

    // Cancelar no Mercado Pago se há subscription_id
    const subscriptionId = userData.subscription_id;
    console.log('🔄 Cancelando assinatura no Mercado Pago:', subscriptionId);

    try {
      const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'cancelled'
        })
      });

      if (!mpResponse.ok) {
        const errorText = await mpResponse.text();
        console.error('❌ Erro do Mercado Pago:', mpResponse.status, errorText);
        
        // Se falhou no MP mas queremos cancelar no sistema mesmo assim
        if (mpResponse.status === 404) {
          console.log('⚠️ Assinatura não encontrada no MP - cancelando apenas no sistema');
        } else {
          throw new Error(`Erro do Mercado Pago: ${mpResponse.status} - ${errorText}`);
        }
      } else {
        console.log('✅ Assinatura cancelada no Mercado Pago com sucesso');
      }

    } catch (mpError) {
      console.error('❌ Erro ao cancelar no Mercado Pago:', mpError);
      
      // Continuar com o cancelamento no sistema mesmo se falhou no MP
      // para garantir que o usuário não seja cobrado novamente
      console.log('⚠️ Continuando com cancelamento no sistema...');
    }

    // Atualizar status no Firestore
    // IMPORTANTE: Não remover o plano Plus imediatamente
    // Apenas marcar como cancelado e parar renovações futuras
    const updateData = {
      subscriptionStatus: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      shouldRenew: false
    };

    await admin.firestore().collection('usuarios').doc(userId).update(updateData);

    console.log('✅ Assinatura cancelada com sucesso para usuário:', userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Sua assinatura foi cancelada com sucesso. Você continuará com acesso ao Plus até o fim do período atual.' 
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar assinatura:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor ao cancelar assinatura',
      details: error.message 
    });
  }
}
