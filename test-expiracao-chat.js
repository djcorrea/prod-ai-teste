/* ============ TESTE DE EXPIRAÇÃO AUTOMÁTICA NO CHAT ============ */
/**
 * Script para testar se a verificação de expiração está funcionando no chat.js
 * Este teste simula um usuário com plano Plus expirado tentando usar o chat
 */

// TESTE DEVE SER EXECUTADO NO CONSOLE DO NAVEGADOR após autenticação

async function testarExpiracaoAutomatica() {
    console.log('🧪 INICIANDO TESTE DE EXPIRAÇÃO AUTOMÁTICA NO CHAT');
    console.log('==================================================');
    
    try {
        // 1. Verificar se usuário está autenticado
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ Usuário não está autenticado');
            return false;
        }
        
        const user = window.auth.currentUser;
        console.log('👤 Usuário autenticado:', user.email);
        
        // 2. Buscar dados atuais do usuário
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ Usuário não encontrado no Firestore');
            return false;
        }
        
        const dadosAntes = userDoc.data();
        console.log('📊 DADOS ANTES DO TESTE:', {
            plano: dadosAntes.plano,
            isPlus: dadosAntes.isPlus,
            planExpiresAt: dadosAntes.planExpiresAt,
            mensagensRestantes: dadosAntes.mensagensRestantes
        });
        
        // 3. Verificar se tem planExpiresAt
        if (!dadosAntes.planExpiresAt) {
            console.warn('⚠️ Usuário não tem planExpiresAt - não há o que testar');
            return false;
        }
        
        // 4. Verificar se o plano já expirou
        const agora = new Date();
        const expiracao = dadosAntes.planExpiresAt.toDate ? 
            dadosAntes.planExpiresAt.toDate() : new Date(dadosAntes.planExpiresAt);
        
        console.log('📅 Data atual:', agora);
        console.log('📅 Data de expiração:', expiracao);
        
        if (expiracao > agora) {
            console.log('✅ Plano ainda ativo - teste será válido apenas após expiração');
            console.log('ℹ️ Para testar, você pode temporariamente alterar planExpiresAt para uma data passada');
            return false;
        }
        
        console.log('⏰ Plano expirado detectado - testando conversão automática...');
        
        // 5. Testar chamada ao chat que deve acionar a verificação de expiração
        console.log('🔄 Enviando mensagem de teste para acionar verificação...');
        
        const idToken = await user.getIdToken();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'teste de expiração automática',
                conversationHistory: [],
                idToken: idToken
            })
        });
        
        console.log('📡 Status da resposta:', response.status);
        
        if (!response.ok) {
            const erro = await response.json();
            console.error('❌ Erro na API:', erro);
            return false;
        }
        
        const resultado = await response.json();
        console.log('💬 Resposta do chat:', resultado);
        
        // 6. Verificar se os dados foram atualizados
        console.log('🔍 Verificando se houve conversão automática...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
        
        const userDocDepois = await getDoc(doc(window.db, 'usuarios', user.uid));
        const dadosDepois = userDocDepois.data();
        
        console.log('📊 DADOS APÓS O TESTE:', {
            plano: dadosDepois.plano,
            isPlus: dadosDepois.isPlus,
            planExpiredAt: dadosDepois.planExpiredAt,
            previousPlan: dadosDepois.previousPlan,
            mensagensRestantes: dadosDepois.mensagensRestantes
        });
        
        // 7. Validações
        console.log('\n🔍 VALIDAÇÕES:');
        console.log('===============');
        
        let todasValidacoesPassed = true;
        
        // Deve ter sido convertido para gratuito
        if (dadosDepois.plano === 'gratis') {
            console.log('✅ Plano convertido para gratuito');
        } else {
            console.error('❌ FALHA: Plano não foi convertido para gratuito');
            todasValidacoesPassed = false;
        }
        
        // isPlus deve ser false
        if (dadosDepois.isPlus === false) {
            console.log('✅ isPlus definido como false');
        } else {
            console.error('❌ FALHA: isPlus não foi definido como false');
            todasValidacoesPassed = false;
        }
        
        // Deve ter planExpiredAt
        if (dadosDepois.planExpiredAt) {
            console.log('✅ planExpiredAt registrado');
        } else {
            console.error('❌ FALHA: planExpiredAt não foi registrado');
            todasValidacoesPassed = false;
        }
        
        // Deve ter previousPlan
        if (dadosDepois.previousPlan === 'plus') {
            console.log('✅ previousPlan registrado como plus');
        } else {
            console.error('❌ FALHA: previousPlan não foi registrado corretamente');
            todasValidacoesPassed = false;
        }
        
        // Deve ter mensagens resetadas
        if (dadosDepois.mensagensRestantes === 10) {
            console.log('✅ Mensagens restantes resetadas para 10');
        } else {
            console.error('❌ FALHA: Mensagens restantes não foram resetadas');
            todasValidacoesPassed = false;
        }
        
        console.log('\n🎯 RESULTADO FINAL:');
        console.log('==================');
        
        if (todasValidacoesPassed) {
            console.log('🎉 ✅ TESTE PASSOU! Verificação de expiração funcionando corretamente');
            console.log('✅ Usuários com planos expirados serão automaticamente convertidos para gratuito');
            return true;
        } else {
            console.log('❌ 🚨 TESTE FALHOU! Verificação de expiração não está funcionando');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
        return false;
    }
}

// Função para ser chamada no console
window.testarExpiracaoAutomatica = testarExpiracaoAutomatica;

console.log('🧪 Teste de expiração automática carregado!');
console.log('📋 Para executar: testarExpiracaoAutomatica()');
console.log('⚠️ IMPORTANTE: Usuário deve estar autenticado e ter planExpiresAt expirado');
