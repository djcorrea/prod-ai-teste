/* ============ VOICE MESSAGE LIMPO - PROD.AI ============ */
/* 🎤 Versão completamente nova e limpa */

console.log('🎤 VOICE CLEAN VERSION loaded');

// Aguardar DOM completamente carregado
window.addEventListener('load', () => {
    console.log('🚀 Window loaded - starting voice integration');
    setTimeout(setupVoice, 1500); // Aguarda 1.5s para garantir
});

function setupVoice() {
    console.log('🔍 Procurando elementos...');
    
    // Encontrar microfone
    const micIcon = document.querySelector('.chatbot-mic-icon');
    if (!micIcon) {
        console.log('❌ Microfone não encontrado, tentando novamente...');
        setTimeout(setupVoice, 2000);
        return;
    }
    
    console.log('✅ Microfone encontrado:', micIcon);
    
    // Verificar suporte ao Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('❌ Speech Recognition não suportado');
        micIcon.style.opacity = '0.5';
        micIcon.title = 'Speech Recognition não suportado neste navegador';
        return;
    }
    
    // Criar Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configuração ULTRA SIMPLES
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false; // Para automaticamente após silêncio
    recognition.maxAlternatives = 1;
    
    console.log('✅ Speech Recognition configurado');
    console.log('🔧 Configurações:', {
        lang: recognition.lang,
        continuous: recognition.continuous,
        interimResults: recognition.interimResults
    });
    
    let isRecording = false;
    let finalTranscript = '';
    
    // Tornar microfone clicável
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', handleMicClick);
    
    function handleMicClick() {
        console.log('🎤 Microfone clicado! Estado atual:', isRecording ? 'GRAVANDO' : 'PARADO');
        
        if (isRecording) {
            console.log('⏹️ Parando gravação...');
            recognition.stop();
        } else {
            console.log('🚀 Iniciando gravação...');
            startRecording();
        }
    }
    
    function startRecording() {
        // Encontrar input do chat
        let chatInput = document.getElementById('chatbotMainInput');
        
        if (!chatInput) {
            chatInput = document.getElementById('chatbotActiveInput');
            console.log('📍 Tentando chatbotActiveInput...');
        }
        
        if (!chatInput) {
            chatInput = document.querySelector('.chatbot-main-input');
            console.log('📍 Tentando classe chatbot-main-input...');
        }
        
        if (!chatInput) {
            chatInput = document.querySelector('input[placeholder*="mensagem"]');
            console.log('📍 Tentando input com placeholder mensagem...');
        }
        
        if (!chatInput) {
            console.log('❌ Input do chat não encontrado!');
            console.log('🔍 Inputs disponíveis:', document.querySelectorAll('input'));
            alert('❌ Campo de texto do chat não encontrado!');
            return;
        }
        
        console.log('✅ Input encontrado:', {
            id: chatInput.id,
            className: chatInput.className,
            placeholder: chatInput.placeholder
        });
        
        // Resetar variáveis
        finalTranscript = '';
        chatInput.value = '';
        
        // Feedback visual
        micIcon.style.fill = '#ff4444';
        micIcon.style.transform = 'scale(1.1)';
        chatInput.placeholder = '🔴 Gravando... Fale agora!';
        chatInput.style.borderColor = '#ff4444';
        
        // Configurar eventos do recognition
        recognition.onstart = function() {
            isRecording = true;
            console.log('🎤 ✅ GRAVAÇÃO INICIADA!');
        };
        
        recognition.onresult = function(event) {
            console.log('📝 Resultado recebido:', event.results.length, 'resultados');
            
            let interimTranscript = '';
            let newFinalTranscript = '';
            
            // Processar todos os resultados
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence || 0;
                const isFinal = event.results[i].isFinal;
                
                console.log(`   [${i}] "${transcript}" (final: ${isFinal}, conf: ${confidence.toFixed(2)})`);
                
                if (isFinal) {
                    newFinalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Atualizar transcript final
            if (newFinalTranscript) {
                finalTranscript += newFinalTranscript + ' ';
                console.log('✅ Texto final atualizado:', finalTranscript);
            }
            
            // Mostrar no input (final + interim)
            const displayText = (finalTranscript + interimTranscript).trim();
            chatInput.value = displayText;
            
            console.log('🔄 Input atualizado com:', displayText);
        };
        
        recognition.onend = function() {
            console.log('🏁 Gravação finalizada');
            console.log('📊 Texto final capturado:', finalTranscript);
            
            isRecording = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            micIcon.style.transform = 'scale(1)';
            chatInput.placeholder = 'Digite sua mensagem...';
            chatInput.style.borderColor = '';
            
            // Garantir que o texto final está no input
            const cleanText = finalTranscript.trim();
            if (cleanText) {
                chatInput.value = cleanText;
                console.log('✅ SUCESSO! Texto no input:', chatInput.value);
                
                // Disparar eventos
                chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                chatInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.log('⚠️ Nenhum texto foi capturado');
                chatInput.placeholder = 'Nenhum texto capturado - tente novamente';
            }
        };
        
        recognition.onerror = function(event) {
            console.log('❌ ERRO na gravação:', event.error);
            
            isRecording = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            micIcon.style.transform = 'scale(1)';
            chatInput.style.borderColor = '';
            
            // Tratar erros específicos
            switch(event.error) {
                case 'not-allowed':
                    chatInput.placeholder = '❌ Permissão negada - habilite o microfone';
                    alert('❌ Permissão do microfone negada!\n\nClique no ícone de microfone na barra de endereços e permita o acesso.');
                    break;
                case 'network':
                    chatInput.placeholder = '❌ Erro de rede - verifique sua conexão';
                    break;
                case 'no-speech':
                    chatInput.placeholder = '❌ Nenhuma fala detectada - tente novamente';
                    break;
                default:
                    chatInput.placeholder = `❌ Erro: ${event.error}`;
                    break;
            }
        };
        
        // INICIAR GRAVAÇÃO
        try {
            console.log('🎯 Chamando recognition.start()...');
            recognition.start();
        } catch (error) {
            console.log('❌ Erro ao iniciar gravação:', error);
            alert('❌ Erro ao iniciar gravação: ' + error.message);
        }
    }
    
    console.log('🎉 Voice integration configurada com sucesso!');
    micIcon.title = 'Clique para gravar mensagem de voz';
}

console.log('📄 voice-clean.js carregado');
