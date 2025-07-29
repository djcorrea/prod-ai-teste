/* ============ VERIFICAÇÃO DE MUDANÇA DE PLANO (PLUS PERSONALIZAÇÃO) ============ */
// Verificar se o usuário mudou de plano durante a sessão
let currentUserPlan = null;

async function checkUserPlanStatus() {
    try {
        // Aguardar Firebase estar disponível com verificação mais robusta
        if (!window.auth || !window.db || !window.firebaseReady) {
            // Log silencioso para evitar spam
            return;
        }
        
        const user = window.auth.currentUser;
        if (!user) return;

        // Importar getDoc e doc se necessário
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
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
        // Log silencioso - apenas registrar sem causar alarme
        // console.log('⚠️ Plan monitor aguardando inicialização completa');
    }
}

// Verificar plano a cada 30 segundos para detectar mudanças (só se estiver na página principal)
function startPlanMonitoring() {
    // Verificar se estamos na página principal onde faz sentido monitorar
    const isMainPage = document.querySelector('.hero') || document.querySelector('#startSendBtn') || window.location.pathname.includes('index.html');
    
    if (isMainPage) {
        console.log('🔄 Iniciando monitoramento de plano...');
        setInterval(checkUserPlanStatus, 30000);
        setTimeout(checkUserPlanStatus, 2000); // Verificação inicial
    } else {
        console.log('📄 Página secundária - pulando monitoramento de plano');
    }
}

// Inicializar quando a página carrega
document.addEventListener('DOMContentLoaded', startPlanMonitoring);
