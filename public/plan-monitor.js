/* ============ VERIFICAÇÃO DE MUDANÇA DE PLANO (PLUS PERSONALIZAÇÃO) ============ */
// Verificar se o usuário mudou de plano durante a sessão
let currentUserPlan = null;

async function checkUserPlanStatus() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const userDoc = await firebase.firestore().collection('usuarios').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (userData && userData.plano !== currentUserPlan) {
            const previousPlan = currentUserPlan;
            currentUserPlan = userData.plano;
            
            // Se mudou de gratuito para plus, mostrar mensagem
            if (previousPlan === 'gratis' && currentUserPlan === 'plus') {
                if (typeof addMessageToChat === 'function') {
                    addMessageToChat('system', '🎉 Parabéns! Agora você tem acesso a respostas personalizadas baseadas no seu perfil técnico. As próximas respostas serão adaptadas ao seu nível e estilo musical!');
                    
                    // Se tem perfil, mostrar resumo
                    if (userData.perfil && userData.perfil.entrevistaConcluida) {
                        const perfil = userData.perfil;
                        addMessageToChat('system', `✅ Perfil detectado: ${perfil.nomeArtistico || 'Produtor'} (${perfil.nivelTecnico}, ${perfil.daw}, ${perfil.estilo}). Suas respostas agora são personalizadas!`);
                    } else {
                        addMessageToChat('system', '💡 Dica: Complete sua entrevista de perfil para respostas ainda mais personalizadas! <a href="entrevista.html" target="_blank">Clique aqui</a>');
                    }
                }
            }
            
            console.log('🔄 Plano do usuário atualizado:', previousPlan, '->', currentUserPlan);
        }
    } catch (error) {
        console.error('❌ Erro ao verificar plano do usuário:', error);
    }
}

// Verificar plano a cada 30 segundos para detectar mudanças
setInterval(checkUserPlanStatus, 30000);

// Verificar plano inicial quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar Firebase estar pronto
    setTimeout(checkUserPlanStatus, 2000);
});
