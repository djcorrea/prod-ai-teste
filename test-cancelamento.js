/**
 * SCRIPT DE TESTE PARA CANCELAMENTO DE ASSINATURA
 * ================================================
 * 
 * Este script simula uma conta real para testar o cancelamento.
 * Execute no console do navegador após fazer login.
 */

async function testarCancelamentoAssinatura() {
    console.log('🧪 INICIANDO TESTE DE CANCELAMENTO DE ASSINATURA');
    
    try {
        // 1. Verificar se usuário está autenticado
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ Usuário não autenticado');
            return;
        }
        
        const user = window.auth.currentUser;
        console.log('👤 Usuário:', user.email);
        
        // 2. Verificar dados no Firestore antes do cancelamento
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ Dados do usuário não encontrados no Firestore');
            return;
        }
        
        const dadosAntes = userDoc.data();
        console.log('📊 DADOS ANTES DO CANCELAMENTO:', {
            plano: dadosAntes.plano,
            isPlus: dadosAntes.isPlus,
            subscriptionStatus: dadosAntes.subscriptionStatus,
            planExpiresAt: dadosAntes.planExpiresAt,
            upgradedAt: dadosAntes.upgradedAt
        });
        
        // 3. Verificar se tem plano Plus
        if (dadosAntes.plano !== 'plus' && !dadosAntes.isPlus) {
            console.error('❌ Usuário não tem plano Plus para cancelar');
            return;
        }
        
        // 4. Testar chamada à API
        console.log('🔄 Testando chamada à API...');
        const idToken = await user.getIdToken();
        
        const response = await fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Status da resposta:', response.status);
        console.log('📡 Response OK:', response.ok);
        
        const result = await response.json();
        console.log('📡 Resultado:', result);
        
        // 5. Verificar dados após o cancelamento
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar atualização
        
        const userDocDepois = await getDoc(doc(window.db, 'usuarios', user.uid));
        const dadosDepois = userDocDepois.data();
        
        console.log('📊 DADOS APÓS O CANCELAMENTO:', {
            plano: dadosDepois.plano,
            isPlus: dadosDepois.isPlus,
            subscriptionStatus: dadosDepois.subscriptionStatus,
            planExpiresAt: dadosDepois.planExpiresAt,
            upgradedAt: dadosDepois.upgradedAt,
            cancelledAt: dadosDepois.cancelledAt,
            shouldRenew: dadosDepois.shouldRenew
        });
        
        // 6. Validações críticas
        console.log('\n🔍 VALIDAÇÕES CRÍTICAS:');
        
        // Plano deve continuar Plus
        if (dadosDepois.plano === 'plus' || dadosDepois.isPlus === true) {
            console.log('✅ Plano Plus preservado');
        } else {
            console.error('❌ FALHA: Plano Plus foi removido incorretamente!');
        }
        
        // Data de expiração deve ser preservada
        if (dadosAntes.planExpiresAt && dadosDepois.planExpiresAt) {
            console.log('✅ Data de expiração preservada');
        } else if (!dadosAntes.planExpiresAt && dadosDepois.planExpiresAt) {
            console.log('✅ Data de expiração adicionada para conta de teste');
        } else {
            console.error('❌ PROBLEMA: Data de expiração removida!');
        }
        
        // Status deve ser cancelado
        if (dadosDepois.subscriptionStatus === 'cancelled') {
            console.log('✅ Status de cancelamento registrado');
        } else {
            console.error('❌ FALHA: Status de cancelamento não registrado!');
        }
        
        // Renovação deve estar desabilitada
        if (dadosDepois.shouldRenew === false) {
            console.log('✅ Renovação desabilitada');
        } else {
            console.error('❌ PROBLEMA: Renovação não foi desabilitada!');
        }
        
        console.log('\n🎉 TESTE CONCLUÍDO!');
        
        if (response.ok && result.success) {
            console.log('✅ CANCELAMENTO BEM-SUCEDIDO!');
        } else {
            console.log('❌ CANCELAMENTO FALHOU:', result);
        }
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error);
    }
}

// Para executar o teste, cole no console e execute:
// testarCancelamentoAssinatura();

console.log('📋 Script de teste carregado. Execute: testarCancelamentoAssinatura()');
