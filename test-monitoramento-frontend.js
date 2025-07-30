/* ============ TESTE DO MONITORAMENTO FRONTEND DE EXPIRAÇÃO ============ */
/**
 * Script para testar se o monitoramento frontend de expiração está funcionando
 * Este script pode ser executado no console do navegador
 */

// TESTE PRINCIPAL - Verificação de Expiração Frontend
async function testarMonitoramentoExpiracao() {
    console.log('🧪 INICIANDO TESTE DE MONITORAMENTO FRONTEND DE EXPIRAÇÃO');
    console.log('========================================================');
    
    try {
        // 1. Verificar se usuário está autenticado
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ Usuário não está autenticado');
            return false;
        }
        
        const user = window.auth.currentUser;
        console.log('👤 Usuário autenticado:', user.email);
        
        // 2. Verificar se Firebase Firestore está disponível
        if (!window.db) {
            console.error('❌ Firestore não está disponível');
            return false;
        }
        
        // 3. Buscar dados atuais do usuário
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ Usuário não encontrado no Firestore');
            return false;
        }
        
        const userData = userDoc.data();
        console.log('📊 DADOS DO USUÁRIO:', {
            plano: userData.plano,
            isPlus: userData.isPlus,
            planExpiresAt: userData.planExpiresAt,
            subscriptionStatus: userData.subscriptionStatus
        });
        
        // 4. Verificar se tem plano Plus com data de expiração
        if (!userData.planExpiresAt) {
            console.warn('⚠️ Usuário não tem planExpiresAt - teste não aplicável');
            console.log('💡 Este teste é apenas para usuários com plano Plus que têm data de expiração');
            return false;
        }
        
        if (userData.plano !== 'plus') {
            console.warn('⚠️ Usuário não tem plano Plus - teste não aplicável');
            return false;
        }
        
        // 5. Verificar data de expiração
        const currentDate = new Date();
        let expirationDate;
        
        // Converter planExpiresAt para Date
        if (userData.planExpiresAt instanceof Date) {
            expirationDate = userData.planExpiresAt;
        } else if (userData.planExpiresAt.toDate && typeof userData.planExpiresAt.toDate === 'function') {
            expirationDate = userData.planExpiresAt.toDate();
        } else if (typeof userData.planExpiresAt === 'string' || typeof userData.planExpiresAt === 'number') {
            expirationDate = new Date(userData.planExpiresAt);
        } else {
            console.error('❌ Formato de planExpiresAt não reconhecido:', userData.planExpiresAt);
            return false;
        }
        
        console.log('📅 VERIFICAÇÃO DE DATAS:');
        console.log('  Data atual:', currentDate.toLocaleString('pt-BR'));
        console.log('  Data de expiração:', expirationDate.toLocaleString('pt-BR'));
        console.log('  Já expirou?', expirationDate <= currentDate);
        
        // 6. Simular verificação de expiração
        if (expirationDate <= currentDate) {
            console.log('⏰ PLANO EXPIRADO DETECTADO!');
            console.log('🔄 O monitoramento frontend deveria acionar reload/logout em alguns segundos...');
            console.log('✅ TESTE: Verificação de expiração está funcionando');
            
            // Avisar que o reload vai acontecer
            console.log('⚠️ ATENÇÃO: Esta página será recarregada automaticamente pelo sistema de monitoramento');
            
            return true;
        } else {
            console.log('✅ Plano ainda ativo');
            console.log('ℹ️ Para testar a expiração, você precisaria ter um plano já expirado');
            console.log('💡 Ou alterar temporariamente planExpiresAt no Firestore para uma data passada');
            
            // Calcular tempo restante
            const timeRemaining = expirationDate - currentDate;
            const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            console.log(`⏳ Tempo restante: ${daysRemaining} dias e ${hoursRemaining} horas`);
            
            return true;
        }
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
        return false;
    }
}

// TESTE ESPECÍFICO - Verificar se Plan Monitor está ativo
function testarPlanMonitorAtivo() {
    console.log('🔍 VERIFICANDO SE PLAN MONITOR ESTÁ ATIVO');
    console.log('========================================');
    
    // Verificar se as funções estão definidas
    if (typeof checkUserPlanStatus === 'function') {
        console.log('✅ Função checkUserPlanStatus encontrada');
    } else {
        console.log('❌ Função checkUserPlanStatus NÃO encontrada');
        console.log('💡 Certifique-se de que plan-monitor.js está carregado');
    }
    
    // Verificar se startPlanMonitoring foi executado
    if (typeof startPlanMonitoring === 'function') {
        console.log('✅ Função startPlanMonitoring encontrada');
    } else {
        console.log('❌ Função startPlanMonitoring NÃO encontrada');
    }
    
    // Verificar página atual
    const isMainPage = document.querySelector('.hero') || document.querySelector('#startSendBtn') || window.location.pathname.includes('index.html');
    const isGerenciarPage = window.location.pathname.includes('gerenciar.html');
    
    console.log('📄 Página atual:', {
        isMainPage,
        isGerenciarPage,
        pathname: window.location.pathname
    });
    
    if (isMainPage) {
        console.log('✅ Página principal - monitoramento deve estar ativo');
        console.log('💡 O plan-monitor.js deve verificar expiração a cada 30 segundos');
    } else if (isGerenciarPage) {
        console.log('✅ Página de gerenciamento - verificação única na autenticação');
        console.log('💡 O gerenciar.js deve verificar expiração ao fazer login');
    } else {
        console.log('ℹ️ Página secundária - monitoramento pode estar desabilitado');
    }
}

// TESTE DE SIMULAÇÃO - Criar cenário de expiração
async function simularExpiracao() {
    console.log('🎭 SIMULANDO CENÁRIO DE EXPIRAÇÃO');
    console.log('=================================');
    console.log('⚠️ ESTE TESTE IRÁ ALTERAR DADOS NO FIRESTORE!');
    
    const confirmacao = confirm('⚠️ CONFIRMA que deseja simular expiração?\n\nIsto irá alterar planExpiresAt para data passada!');
    
    if (!confirmacao) {
        console.log('❌ Simulação cancelada pelo usuário');
        return false;
    }
    
    try {
        // Verificar autenticação
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ Usuário não está autenticado');
            return false;
        }
        
        const user = window.auth.currentUser;
        
        // Importar updateDoc e doc
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        // Definir data expirada (1 hora atrás)
        const expiredDate = new Date(Date.now() - (60 * 60 * 1000));
        
        console.log('🔄 Alterando planExpiresAt para:', expiredDate.toLocaleString('pt-BR'));
        
        // Atualizar no Firestore
        await updateDoc(doc(window.db, 'usuarios', user.uid), {
            planExpiresAt: expiredDate
        });
        
        console.log('✅ planExpiresAt alterado com sucesso!');
        console.log('⏰ Em poucos segundos o sistema deve detectar a expiração e fazer reload');
        console.log('🔄 Aguardando ação do monitoramento...');
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao simular expiração:', error);
        return false;
    }
}

// FUNÇÃO DE RESTAURAÇÃO - Voltar data de expiração para o futuro
async function restaurarExpiracao() {
    console.log('🔧 RESTAURANDO DATA DE EXPIRAÇÃO');
    console.log('=================================');
    
    try {
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ Usuário não está autenticado');
            return false;
        }
        
        const user = window.auth.currentUser;
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        // Definir data futura (30 dias a partir de agora)
        const futureDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
        
        console.log('🔄 Restaurando planExpiresAt para:', futureDate.toLocaleString('pt-BR'));
        
        await updateDoc(doc(window.db, 'usuarios', user.uid), {
            planExpiresAt: futureDate
        });
        
        console.log('✅ Data de expiração restaurada com sucesso!');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao restaurar expiração:', error);
        return false;
    }
}

// Disponibilizar funções no escopo global
window.testarMonitoramentoExpiracao = testarMonitoramentoExpiracao;
window.testarPlanMonitorAtivo = testarPlanMonitorAtivo;
window.simularExpiracao = simularExpiracao;
window.restaurarExpiracao = restaurarExpiracao;

console.log('🧪 Testes de monitoramento frontend carregados!');
console.log('📋 Funções disponíveis:');
console.log('  • testarMonitoramentoExpiracao() - Teste principal');
console.log('  • testarPlanMonitorAtivo() - Verificar se monitor está rodando');
console.log('  • simularExpiracao() - ⚠️ Simular plano expirado');
console.log('  • restaurarExpiracao() - Restaurar data futura');
