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

    // NOTA: Este projeto usa pagamentos únicos (preferences), não assinaturas recorrentes
    // Portanto, não há subscription_id real do Mercado Pago para cancelar
    // O cancelamento é feito apenas no sistema interno
    
    console.log('ℹ️ Cancelando assinatura (pagamento único) - apenas no sistema interno');
    
    // Atualizar status no Firestore
    // IMPORTANTE: Não remover o plano Plus imediatamente
    // Apenas marcar como cancelado e parar renovações futuras
    const updateData = {
      subscriptionStatus: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      shouldRenew: false,
      // Manter o plano ativo até uma data de expiração
      // Se não há data de expiração, define para 30 dias a partir de agora
      ...((!userData.planExpiresAt) && {
        planExpiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 dias
      })
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
