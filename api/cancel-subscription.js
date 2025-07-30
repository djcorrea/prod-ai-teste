import { auth, db } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Adicionar headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('🚀 API cancel-subscription chamada');
  console.log('📋 Método:', req.method);
  console.log('📋 Headers:', req.headers);
  
  // Permitir apenas POST
  if (req.method !== 'POST') {
    console.log('❌ Método não permitido:', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar token de autenticação
    const authHeader = req.headers.authorization || '';
    console.log('🔐 Auth header presente:', !!authHeader);
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Token Bearer não encontrado');
      return res.status(401).json({ error: 'Token de autorização não fornecido' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error('❌ Token inválido:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

    const userId = decodedToken.uid;
    console.log('🔧 Iniciando cancelamento de assinatura para usuário:', userId);

    // Buscar dados do usuário no Firestore
    const userDoc = await db.collection('usuarios').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ Usuário não encontrado no Firestore');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    console.log('👤 Dados do usuário encontrados:', {
      plano: userData.plano,
      isPlus: userData.isPlus,
      subscriptionStatus: userData.subscriptionStatus,
      planExpiresAt: userData.planExpiresAt
    });
    
    // Verificar se o usuário tem plano Plus
    if (userData.plano !== 'plus' && !userData.isPlus) {
      console.log('❌ Usuário não possui plano Plus');
      return res.status(400).json({ error: 'Usuário não possui assinatura ativa para cancelar' });
    }

    // Verificar se já foi cancelado
    if (userData.subscriptionStatus === 'cancelled') {
      console.log('⚠️ Assinatura já estava cancelada');
      return res.status(200).json({ 
        success: true, 
        message: 'Sua assinatura já estava cancelada. Você continuará com acesso ao Plus até o fim do período atual.' 
      });
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
      cancelledAt: FieldValue.serverTimestamp(),
      shouldRenew: false,
      // Manter o plano ativo até uma data de expiração
      // Se não há data de expiração, define para 30 dias a partir de agora
      ...((!userData.planExpiresAt) && {
        planExpiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 dias
      })
    };

    console.log('📝 Dados a serem atualizados:', updateData);
    await db.collection('usuarios').doc(userId).update(updateData);

    console.log('✅ Assinatura cancelada com sucesso para usuário:', userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Sua assinatura foi cancelada com sucesso. Você continuará com acesso ao Plus até o fim do período atual.' 
    });

  } catch (error) {
    console.error('❌ Erro completo ao cancelar assinatura:', error);
    console.error('❌ Stack trace:', error.stack);
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor ao cancelar assinatura',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
