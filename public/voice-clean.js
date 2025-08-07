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
    
    // Encontrar TODOS os microfones (inicial e ativo)
    const allMicIcons = document.querySelectorAll('.chatbot-mic-icon');
    
    if (allMicIcons.length === 0) {
        console.log('❌ Nenhum microfone encontrado, tentando novamente...');
        setTimeout(setupVoice, 2000);
        return;
    }
    
    console.log(`✅ ${allMicIcons.length} microfone(s) encontrado(s):`, allMicIcons);
    
    // Verificar suporte ao Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('❌ Speech Recognition não suportado');
        allMicIcons.forEach(mic => {
            mic.style.opacity = '0.5';
            mic.title = 'Speech Recognition não suportado neste navegador';
        });
        return;
    }
    
    // Criar Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configuração ULTRA SIMPLES
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true; // MODO CONTÍNUO - NÃO PARA SOZINHO
    recognition.maxAlternatives = 1;
    
    console.log('✅ Speech Recognition configurado para GRAVAÇÃO CONTÍNUA');
    console.log('🔧 Configurações:', {
        lang: recognition.lang,
        continuous: recognition.continuous,
        interimResults: recognition.interimResults
    });
    
    let isRecording = false;
    let finalTranscript = '';
    let currentMicIcon = null;
    let currentInput = null;
    
    // Configurar TODOS os microfones
    allMicIcons.forEach(micIcon => {
        micIcon.style.cursor = 'pointer';
        micIcon.title = 'Clique para gravar mensagem de voz';
        micIcon.addEventListener('click', () => handleMicClick(micIcon));
        console.log('✅ Microfone configurado:', micIcon);
    });
    
    function handleMicClick(clickedMicIcon) {
        console.log('🎤 Microfone clicado!');
        console.log('📊 Estado atual:', isRecording ? '🔴 GRAVANDO' : '⚫ PARADO');
        console.log('🎯 Microfone clicado:', clickedMicIcon);
        
        currentMicIcon = clickedMicIcon;
        
        if (isRecording) {
            console.log('⏹️ USUÁRIO QUER PARAR - finalizando gravação...');
            isRecording = false; // Marcar que usuário quer parar
            recognition.stop(); // Parar recognition
        } else {
            console.log('🚀 USUÁRIO QUER GRAVAR - iniciando gravação...');
            startRecording();
        }
    }
    
    function startRecording() {
        // Encontrar input ATUAL dinamicamente
        let chatInput = null;
        
        // ESTRATÉGIA 1: Procurar input visível e não disabled
        const allInputs = [
            document.getElementById('chatbotActiveInput'),
            document.getElementById('chatbotMainInput'),
            document.querySelector('.chatbot-active-input'),
            document.querySelector('.chatbot-main-input'),
            ...document.querySelectorAll('input[type="text"]')
        ];
        
        for (let input of allInputs) {
            if (input && !input.disabled) {
                // Verificar se o input está visível
                const style = window.getComputedStyle(input);
                const parent = input.closest('.chatbot-active-state, .chatbot-welcome-state');
                
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    if (!parent || window.getComputedStyle(parent).display !== 'none') {
                        chatInput = input;
                        console.log(`✅ Input ATIVO encontrado: ${input.id || input.className}`);
                        break;
                    }
                }
            }
        }
        
        if (!chatInput) {
            console.log('❌ NENHUM input ativo encontrado!');
            console.log('🔍 Inputs disponíveis:', {
                activeInput: document.getElementById('chatbotActiveInput'),
                mainInput: document.getElementById('chatbotMainInput'),
                allInputs: document.querySelectorAll('input')
            });
            alert('❌ Campo de texto do chat não encontrado!');
            return;
        }
        
        currentInput = chatInput;
        console.log('✅ Usando input:', {
            id: chatInput.id,
            className: chatInput.className,
            placeholder: chatInput.placeholder,
            visible: window.getComputedStyle(chatInput).display !== 'none'
        });
        
        // Resetar variáveis
        finalTranscript = '';
        chatInput.value = '';
        
        // Feedback visual CONTÍNUO para o microfone atual
        if (currentMicIcon) {
            currentMicIcon.style.fill = '#ff4444';
            currentMicIcon.style.transform = 'scale(1.1)';
            currentMicIcon.style.filter = 'drop-shadow(0 0 10px #ff4444)';
            currentMicIcon.style.animation = 'pulse 1.5s infinite';
        }
        
        chatInput.placeholder = '🔴 GRAVANDO CONTÍNUO... Clique novamente para parar';
        chatInput.style.borderColor = '#ff4444';
        chatInput.style.boxShadow = '0 0 10px rgba(255, 68, 68, 0.3)';
        
        // Adicionar animação pulsante para indicar gravação ativa
        if (!document.querySelector('#voice-animation-style')) {
            const style = document.createElement('style');
            style.id = 'voice-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1.1); }
                    50% { transform: scale(1.2); filter: drop-shadow(0 0 15px #ff4444); }
                    100% { transform: scale(1.1); }
                }
            `;
            document.head.appendChild(style);
        }
        
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
            
            // Mostrar no input ATUAL (final + interim)
            if (currentInput) {
                const displayText = (finalTranscript + interimTranscript).trim();
                currentInput.value = displayText;
                console.log('🔄 Input ATUAL atualizado com:', displayText);
            }
        };
        
        recognition.onend = function() {
            console.log('🏁 Recognition tentou finalizar');
            console.log('📊 Texto final capturado:', finalTranscript);
            console.log('🎤 Usuário ainda quer gravar?', isRecording);
            
            // SE O USUÁRIO AINDA QUER GRAVAR (não clicou para parar)
            if (isRecording) {
                console.log('🔄 REINICIANDO automaticamente - usuário não parou manualmente');
                
                // Tentar reiniciar em 100ms
                setTimeout(() => {
                    if (isRecording) {
                        try {
                            console.log('🚀 Reiniciando recognition...');
                            recognition.start();
                            return; // NÃO continuar com finalização
                        } catch (e) {
                            console.log('❌ Erro ao reiniciar:', e.message);
                            // Se não conseguir reiniciar, finalizar normalmente
                        }
                    }
                }, 100);
                
                // Se conseguir reiniciar, não executar o resto da função
                if (isRecording) return;
            }
            
            // FINALIZAÇÃO NORMAL (quando usuário clicou para parar)
            console.log('🏁 Finalizando gravação por solicitação do usuário');
            isRecording = false;
            
            // Restaurar visual COMPLETAMENTE do microfone atual
            if (currentMicIcon) {
                currentMicIcon.style.fill = 'currentColor';
                currentMicIcon.style.transform = 'scale(1)';
                currentMicIcon.style.filter = 'none';
                currentMicIcon.style.animation = 'none';
            }
            
            if (currentInput) {
                currentInput.placeholder = 'Digite sua mensagem...';
                currentInput.style.borderColor = '';
                currentInput.style.boxShadow = '';
            }
            
            console.log('🎨 Visual restaurado - gravação finalizada');
            
            // Garantir que o texto final está no input ATUAL
            const cleanText = finalTranscript.trim();
            if (cleanText && currentInput) {
                currentInput.value = cleanText;
                console.log('✅ SUCESSO! Texto final no input ATUAL:', currentInput.value);
                
                // Disparar eventos
                currentInput.dispatchEvent(new Event('input', { bubbles: true }));
                currentInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.log('⚠️ Nenhum texto foi capturado');
                if (currentInput) {
                    currentInput.placeholder = 'Nenhum texto capturado - tente novamente';
                }
            }
        };
        
        recognition.onerror = function(event) {
            console.log('❌ ERRO na gravação:', event.error);
            
            isRecording = false;
            
            // Restaurar visual COMPLETAMENTE do microfone atual
            if (currentMicIcon) {
                currentMicIcon.style.fill = 'currentColor';
                currentMicIcon.style.transform = 'scale(1)';
                currentMicIcon.style.filter = 'none';
                currentMicIcon.style.animation = 'none';
            }
            
            if (currentInput) {
                currentInput.style.borderColor = '';
                currentInput.style.boxShadow = '';
            }
            
            // Tratar erros específicos
            switch(event.error) {
                case 'not-allowed':
                    if (currentInput) currentInput.placeholder = '❌ Permissão negada - habilite o microfone';
                    alert('❌ Permissão do microfone negada!\n\nClique no ícone de microfone na barra de endereços e permita o acesso.');
                    break;
                case 'network':
                    if (currentInput) currentInput.placeholder = '❌ Erro de rede - verifique sua conexão';
                    break;
                case 'no-speech':
                    if (currentInput) currentInput.placeholder = '❌ Nenhuma fala detectada - tente novamente';
                    break;
                case 'aborted':
                    if (currentInput) currentInput.placeholder = 'Gravação interrompida pelo usuário';
                    console.log('ℹ️ Gravação foi interrompida pelo usuário - normal');
                    break;
                default:
                    if (currentInput) currentInput.placeholder = `❌ Erro: ${event.error}`;
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
