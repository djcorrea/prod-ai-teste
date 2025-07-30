/**
 * SCRIPT DE TESTE DEFINITIVO - CANCELAMENTO PARA CONTAS REAIS
 * ============================================================
 * 
 * Este script valida ESPECIFICAMENTE contas reais que pagaram via Mercado Pago.
 * Execute no console do navegador após fazer login com conta real.
 */

async function testarCancelamentoContaReal() {
    console.log('🚨 TESTE DEFINITIVO - CANCELAMENTO CONTA REAL 🚨');
    console.log('================================================');
    
    try {
        // 1. Verificar se usuário está autenticado
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ FALHA: Usuário não autenticado');
            return false;
        }
        
        const user = window.auth.currentUser;
        console.log('👤 Usuário autenticado:', user.email);
        console.log('🆔 UID:', user.uid);
        
        // 2. Verificar dados no Firestore ANTES do cancelamento
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ FALHA: Dados do usuário não encontrados no Firestore');
            return false;
        }
        
        const dadosAntes = userDoc.data();
        console.log('\n📊 DADOS ANTES DO CANCELAMENTO:');
        console.log('================================');
        console.log('- Plano:', dadosAntes.plano);
        console.log('- IsPlus:', dadosAntes.isPlus);
        console.log('- Status:', dadosAntes.subscriptionStatus || 'active');
        console.log('- Expira em:', dadosAntes.planExpiresAt);
        console.log('- Upgrade em:', dadosAntes.upgradedAt);
        console.log('- Deve renovar:', dadosAntes.shouldRenew);
        
        // 3. VALIDAÇÕES PRÉ-CANCELAMENTO PARA CONTA REAL
        console.log('\n🔍 VALIDAÇÕES PRÉ-CANCELAMENTO:');
        console.log('================================');
        
        // Deve ter plano Plus
        const temPlusValido = (dadosAntes.plano === 'plus' || dadosAntes.isPlus === true);
        if (!temPlusValido) {
            console.error('❌ FALHA: Usuário não tem plano Plus');
            return false;
        }
        console.log('✅ Plano Plus confirmado');
        
        // Para conta real, deve ter planExpiresAt
        if (!dadosAntes.planExpiresAt) {
            console.warn('⚠️ ATENÇÃO: Conta sem planExpiresAt (pode ser conta de teste)');
        } else {
            console.log('✅ Data de expiração presente');
            
            // Verificar se não expirou
            const agora = new Date();
            const expiracao = dadosAntes.planExpiresAt.toDate ? dadosAntes.planExpiresAt.toDate() : new Date(dadosAntes.planExpiresAt);
            
            if (expiracao <= agora) {
                console.error('❌ FALHA: Plano já expirou em', expiracao);
                return false;
            }
            console.log('✅ Plano ativo até:', expiracao);
        }
        
        // Não deve estar cancelado
        if (dadosAntes.subscriptionStatus === 'cancelled') {
            console.error('❌ FALHA: Assinatura já estava cancelada');
            console.log('📝 Testando cancelamento duplo...');
            
            // Testar cancelamento duplo
            const idToken = await user.getIdToken();
            const response = await fetch('/api/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 400) {
                const result = await response.json();
                console.log('✅ Cancelamento duplo tratado corretamente:', result.error);
                return true; // Teste passou
            } else {
                console.error('❌ FALHA: Cancelamento duplo não tratado corretamente');
                return false;
            }
        }
        console.log('✅ Assinatura ativa (não cancelada)');
        
        // 4. EXECUTAR CANCELAMENTO
        console.log('\n🔄 EXECUTANDO CANCELAMENTO:');
        console.log('============================');
        
        const idToken = await user.getIdToken();
        console.log('🔐 Token obtido, enviando requisição...');
        
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
        
        if (!response.ok || !result.success) {
            console.error('❌ FALHA: Cancelamento não foi bem-sucedido');
            console.error('Detalhes:', result);
            return false;
        }
        
        console.log('✅ API retornou sucesso');
        
        // 5. VERIFICAR DADOS APÓS CANCELAMENTO
        console.log('\n📊 VERIFICANDO DADOS APÓS CANCELAMENTO:');
        console.log('========================================');
        
        // Aguardar um pouco para garantir que o Firestore foi atualizado
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const userDocDepois = await getDoc(doc(window.db, 'usuarios', user.uid));
        const dadosDepois = userDocDepois.data();
        
        console.log('- Plano:', dadosDepois.plano);
        console.log('- IsPlus:', dadosDepois.isPlus);
        console.log('- Status:', dadosDepois.subscriptionStatus);
        console.log('- Expira em:', dadosDepois.planExpiresAt);
        console.log('- Upgrade em:', dadosDepois.upgradedAt);
        console.log('- Deve renovar:', dadosDepois.shouldRenew);
        console.log('- Cancelado em:', dadosDepois.cancelledAt);
        
        // 6. VALIDAÇÕES PÓS-CANCELAMENTO
        console.log('\n🔍 VALIDAÇÕES PÓS-CANCELAMENTO:');
        console.log('================================');
        
        let todasValidacoesPassed = true;
        
        // Plano deve continuar Plus
        if (dadosDepois.plano === 'plus' || dadosDepois.isPlus === true) {
            console.log('✅ Plano Plus preservado');
        } else {
            console.error('❌ FALHA CRÍTICA: Plano Plus foi removido!');
            todasValidacoesPassed = false;
        }
        
        // Data de expiração deve ser preservada (para contas reais)
        if (dadosAntes.planExpiresAt) {
            if (dadosDepois.planExpiresAt) {
                console.log('✅ Data de expiração preservada');
            } else {
                console.error('❌ FALHA CRÍTICA: Data de expiração foi removida!');
                todasValidacoesPassed = false;
            }
        }
        
        // Status deve ser cancelado
        if (dadosDepois.subscriptionStatus === 'cancelled') {
            console.log('✅ Status de cancelamento registrado');
        } else {
            console.error('❌ FALHA: Status de cancelamento não registrado');
            todasValidacoesPassed = false;
        }
        
        // Renovação deve estar desabilitada
        if (dadosDepois.shouldRenew === false) {
            console.log('✅ Renovação desabilitada');
        } else {
            console.error('❌ FALHA: Renovação não foi desabilitada');
            todasValidacoesPassed = false;
        }
        
        // Data de cancelamento deve existir
        if (dadosDepois.cancelledAt) {
            console.log('✅ Data de cancelamento registrada');
        } else {
            console.error('❌ FALHA: Data de cancelamento não registrada');
            todasValidacoesPassed = false;
        }
        
        // 7. TESTE DE ACESSO CONTINUADO
        console.log('\n🔍 TESTANDO ACESSO CONTINUADO AO PLUS:');
        console.log('======================================');
        
        // Simular verificação de plano (como o sistema faz)
        const aindaTemPlus = (dadosDepois.plano === 'plus');
        if (aindaTemPlus) {
            console.log('✅ Sistema ainda reconhece como usuário Plus');
        } else {
            console.error('❌ FALHA CRÍTICA: Sistema não reconhece mais como Plus!');
            todasValidacoesPassed = false;
        }
        
        // 8. RESULTADO FINAL
        console.log('\n🎯 RESULTADO FINAL:');
        console.log('===================');
        
        if (todasValidacoesPassed) {
            console.log('🎉 SUCESSO TOTAL! Cancelamento funcionou perfeitamente para conta real!');
            console.log('✅ Todas as validações passaram');
            console.log('✅ Funcionalidade pronta para produção');
            return true;
        } else {
            console.log('❌ FALHAS DETECTADAS! Revisar implementação');
            return false;
        }
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO TESTE:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Para executar o teste, cole no console e execute:
// testarCancelamentoContaReal();

console.log('🧪 Script de teste para contas reais carregado.');
console.log('📋 Execute: testarCancelamentoContaReal()');
console.log('⚠️  IMPORTANTE: Use apenas com contas reais que pagaram via Mercado Pago!');
