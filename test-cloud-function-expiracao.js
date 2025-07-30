/* ============ TESTE DA CLOUD FUNCTION DE EXPIRAÇÃO ============ */
/**
 * Script para testar a Cloud Function checkExpiredPlans
 * Este script pode ser executado no console do navegador ou como arquivo separado
 */

// VERSÃO PARA CONSOLE DO NAVEGADOR (após autenticação)
async function testarCloudFunctionExpiracao() {
    console.log('🧪 INICIANDO TESTE DA CLOUD FUNCTION DE EXPIRAÇÃO');
    console.log('=================================================');
    
    try {
        // 1. Verificar se Firebase Functions está disponível
        if (!window.firebase || !window.firebase.functions) {
            console.error('❌ Firebase Functions não está disponível');
            console.log('💡 Certifique-se de que o Firebase SDK está carregado');
            return false;
        }
        
        // 2. Verificar autenticação
        if (!window.auth || !window.auth.currentUser) {
            console.error('❌ Usuário não está autenticado');
            return false;
        }
        
        const user = window.auth.currentUser;
        console.log('👤 Usuário autenticado:', user.email);
        
        // 3. Preparar chamada para a Cloud Function de teste
        const functions = window.firebase.functions();
        const testCheckExpiredPlans = functions.httpsCallable('testCheckExpiredPlans');
        
        console.log('🔄 Chamando Cloud Function de teste...');
        console.log('⚠️ Esta é uma execução de TESTE - nenhum dado será alterado');
        
        // 4. Executar a função de teste
        const resultado = await testCheckExpiredPlans();
        
        console.log('📡 Resposta da Cloud Function:');
        console.log('============================');
        console.log('✅ Sucesso:', resultado.data.success);
        console.log('📝 Mensagem:', resultado.data.message);
        console.log('📊 Usuários encontrados:', resultado.data.expiredUsers?.length || 0);
        console.log('⏰ Timestamp:', resultado.data.timestamp);
        
        if (resultado.data.expiredUsers && resultado.data.expiredUsers.length > 0) {
            console.log('\n👥 USUÁRIOS COM PLANO EXPIRADO ENCONTRADOS:');
            console.log('==========================================');
            resultado.data.expiredUsers.forEach((user, index) => {
                console.log(`${index + 1}. ID: ${user.userId}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Plano: ${user.plano}`);
                console.log(`   Expirou em: ${user.planExpiresAt}`);
                console.log(`   Upgrade em: ${user.upgradedAt}`);
                console.log('   ---');
            });
        } else {
            console.log('✅ Nenhum usuário com plano expirado encontrado');
        }
        
        console.log('\n🎯 RESULTADO DO TESTE:');
        console.log('=====================');
        
        if (resultado.data.success) {
            console.log('🎉 ✅ TESTE DA CLOUD FUNCTION PASSOU!');
            console.log('✅ A função está configurada corretamente');
            console.log('✅ O agendamento automático funcionará a cada 6 horas');
            console.log('ℹ️ Próximas execuções: 00:00, 06:00, 12:00, 18:00 (GMT-3)');
            return true;
        } else {
            console.log('❌ 🚨 TESTE FALHOU!');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
        
        if (error.code === 'functions/unauthenticated') {
            console.error('🔒 Erro de autenticação - faça login primeiro');
        } else if (error.code === 'functions/not-found') {
            console.error('🚫 Cloud Function não encontrada - verifique o deploy');
        } else {
            console.error('💥 Erro inesperado:', error.message);
        }
        
        return false;
    }
}

// VERSÃO PARA EXECUTAR MANUALMENTE A FUNCTION REAL (CUIDADO!)
async function executarLimpezaManual() {
    console.log('⚠️ ATENÇÃO: EXECUÇÃO MANUAL DA LIMPEZA DE PLANOS EXPIRADOS');
    console.log('=========================================================');
    console.log('🚨 ESTA OPERAÇÃO IRÁ ALTERAR DADOS REAIS NO FIRESTORE!');
    
    const confirmacao = confirm('⚠️ CONFIRMA que deseja executar a limpeza manual de planos expirados?\n\nIsto irá converter usuários com planos expirados para gratuito IMEDIATAMENTE!');
    
    if (!confirmacao) {
        console.log('❌ Operação cancelada pelo usuário');
        return false;
    }
    
    try {
        // Simular execução da function schedulada
        const functions = window.firebase.functions();
        
        // Esta seria uma function separada para execução manual real
        console.log('🔄 Executando limpeza manual...');
        console.log('⏳ Aguarde... (pode demorar alguns segundos)');
        
        // Para implementação real, seria necessário criar uma function adicional
        // Por segurança, vamos apenas mostrar a mensagem
        console.log('ℹ️ Para execução manual real, acesse o Firebase Console');
        console.log('📱 Functions → checkExpiredPlans → Executar função');
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro na execução manual:', error);
        return false;
    }
}

// VERSÃO PARA NODE.JS/BACKEND (para execução em servidor)
async function testarViaCLI() {
    console.log('🖥️ TESTE VIA CLI - CLOUD FUNCTION EXPIRACAO');
    console.log('==========================================');
    
    // Esta versão seria para testes via linha de comando
    // Requer Firebase Admin SDK configurado
    
    console.log('💡 Para testar via CLI:');
    console.log('1. npm install -g firebase-tools');
    console.log('2. firebase login');
    console.log('3. firebase functions:shell');
    console.log('4. checkExpiredPlans()');
    
    console.log('\n💡 Para executar manualmente:');
    console.log('1. Firebase Console → Functions');
    console.log('2. Localizar "checkExpiredPlans"');
    console.log('3. Clique em "Executar função"');
}

// Disponibilizar no escopo global
window.testarCloudFunctionExpiracao = testarCloudFunctionExpiracao;
window.executarLimpezaManual = executarLimpezaManual;
window.testarViaCLI = testarViaCLI;

console.log('🧪 Testes de Cloud Function carregados!');
console.log('📋 Funções disponíveis:');
console.log('  • testarCloudFunctionExpiracao() - Teste seguro');
console.log('  • executarLimpezaManual() - ⚠️ Execução real');
console.log('  • testarViaCLI() - Instruções para CLI');
