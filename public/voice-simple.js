/* ============ VOICE MESSAGE ULTRA SIMPLES - PROD.AI ============ */
/* 🎤 Versão simplificada que funciona garantidamente */

console.log('🎤 Loading ULTRA SIMPLE Voice Message...');

// Aguardar DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, starting voice integration...');
    setupSimpleVoice();
});

// Backup se DOM já estiver carregado
if (document.readyState !== 'loading') {
    console.log('📄 DOM already loaded, starting voice integration...');
    setupSimpleVoice();
}

function setupSimpleVoice() {
    // Encontrar o ícone de microfone
    const micIcon = document.querySelector('.chatbot-mic-icon');
    
    if (!micIcon) {
        console.log('❌ Mic icon not found, retrying in 2s...');
        setTimeout(setupSimpleVoice, 2000);
        return;
    }
    
    console.log('✅ Mic icon found!', micIcon);
    
    // Variáveis de controle
    let recognition = null;
    let isListening = false;
    let finalText = '';
    
    // Inicializar Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // CONFIGURAÇÕES MAIS AGRESSIVAS
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        // Detecção de dispositivo móvel
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            recognition.continuous = false; // Mobile: para automaticamente
            console.log('📱 MOBILE CONFIG: continuous=false, interimResults=true');
        } else {
            recognition.continuous = true; // Desktop: contínuo
            console.log('💻 DESKTOP CONFIG: continuous=true, interimResults=true');
        }
        
        console.log('✅ Speech Recognition ready with aggressive settings');
        console.log('🔧 Config:', {
            lang: recognition.lang,
            continuous: recognition.continuous,
            interimResults: recognition.interimResults,
            maxAlternatives: recognition.maxAlternatives
        });
    } else {
        console.log('❌ Speech Recognition not supported');
        return;
    }
    
    // Fazer ícone clicável
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', toggleVoice);
    
    function toggleVoice() {
        console.log('🎤 Mic icon clicked. Currently listening:', isListening);
        
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    function startListening() {
        console.log('🚀 Starting to listen...');
        
        // Encontrar input ativo
        const input = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
        
        if (!input) {
            console.log('❌ No input found');
            alert('Input não encontrado');
            return;
        }
        
        console.log('✅ Input found:', input.id);
        
        // Reset
        finalText = '';
        input.value = '';
        
        // Visual feedback
        micIcon.style.fill = '#ff4444';
        micIcon.style.filter = 'drop-shadow(0 0 10px #ff4444)';
        input.placeholder = '🔴 Ouvindo... Fale sua pergunta!';
        input.style.borderColor = '#ff4444';
        
        // Configurar events
        recognition.onstart = () => {
            isListening = true;
            console.log('🎤 Recognition started successfully');
        };
        
        recognition.onresult = (event) => {
            console.log('� RESULTADO DETECTADO! Total results:', event.results.length);
            
            let interim = '';
            let allFinalText = '';
            
            // Processar TODOS os resultados com mais detalhes
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                const confidence = result[0].confidence || 0;
                const isFinal = result.isFinal;
                
                console.log(`📝 Result[${i}]: "${transcript}" | Final: ${isFinal} | Confidence: ${confidence.toFixed(2)}`);
                
                if (isFinal) {
                    allFinalText += transcript + ' ';
                    console.log(`✅ TEXTO FINAL CAPTURADO: "${transcript}"`);
                } else {
                    interim += transcript;
                    console.log(`⏳ Texto interim: "${transcript}"`);
                }
            }
            
            // Atualizar finalText se tiver texto final novo
            if (allFinalText.trim()) {
                finalText = allFinalText.trim();
                console.log('🎯 FINAL TEXT UPDATED TO:', `"${finalText}"`);
            }
            
            // Mostrar texto em tempo real (final + interim)
            const displayText = (finalText + ' ' + interim).trim();
            
            // MÚLTIPLAS FORMAS DE FORÇAR O INPUT
            console.log(`🚀 FORÇANDO INPUT COM: "${displayText}"`);
            
            // Método 1: Valor direto
            input.value = displayText;
            
            // Método 2: Propriedade textContent (backup)
            input.setAttribute('value', displayText);
            
            // Método 3: Eventos múltiplos
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            
            input.dispatchEvent(inputEvent);
            input.dispatchEvent(changeEvent);
            
            // Método 4: Focus para garantir
            input.focus();
            
            console.log(`✅ Input value após força: "${input.value}"`);
            console.log(`✅ Input getAttribute: "${input.getAttribute('value') || 'null'}"`);
        };
        
        recognition.onend = () => {
            console.log('🏁 RECOGNITION ENDED!');
            console.log(`🎯 Final text captured: "${finalText}"`);
            console.log(`📱 Is mobile: ${/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}`);
            console.log(`🎤 Is still listening: ${isListening}`);
            
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // ESTRATÉGIA MOBILE: Se parou e não tem texto, tentar mais uma vez
            if (isMobile && isListening) {
                const textLength = finalText.trim().length;
                console.log(`📱 Mobile check - Text length: ${textLength}`);
                
                if (textLength === 0) {
                    console.log('📱 MOBILE: Sem texto capturado, tentando novamente em 200ms...');
                    setTimeout(() => {
                        if (isListening) {
                            console.log('📱 RESTARTING mobile recognition...');
                            try {
                                recognition.start();
                                return;
                            } catch (e) {
                                console.log('❌ Erro ao reiniciar:', e);
                            }
                        }
                    }, 200);
                    return;
                }
            }
            
            // FINALIZAR CAPTURA
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            micIcon.style.filter = 'none';
            input.placeholder = 'Digite sua mensagem...';
            input.style.borderColor = '';
            
            // SUPER FORÇA o texto final - TODAS AS ESTRATÉGIAS
            const cleanText = finalText.trim();
            console.log(`🔥 SUPER FORCING final text: "${cleanText}"`);
            
            if (cleanText) {
                // Estratégia 1: Valor direto múltiplas vezes
                input.value = cleanText;
                input.value = cleanText; // Duplo para garantir
                
                // Estratégia 2: Attribute
                input.setAttribute('value', cleanText);
                
                // Estratégia 3: textContent backup
                if (input.value !== cleanText) {
                    console.log('⚠️ Input.value falhou, usando setAttribute...');
                    input.setAttribute('value', cleanText);
                }
                
                // Estratégia 4: Eventos FORTES
                ['input', 'change', 'keyup', 'paste'].forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                    input.dispatchEvent(event);
                });
                
                // Estratégia 5: Focus + blur para forçar atualização
                input.focus();
                setTimeout(() => input.blur(), 50);
                
                // Verificação MÚLTIPLA
                setTimeout(() => {
                    console.log(`🔍 VERIFICAÇÃO 1 (50ms): input.value = "${input.value}"`);
                    if (input.value !== cleanText) {
                        console.log('⚠️ TENTATIVA 2: Forçando novamente...');
                        input.value = cleanText;
                        input.focus();
                    }
                }, 50);
                
                setTimeout(() => {
                    console.log(`🔍 VERIFICAÇÃO 2 (100ms): input.value = "${input.value}"`);
                    if (input.value !== cleanText) {
                        console.log('⚠️ TENTATIVA 3: Usando createElement strategy...');
                        // Estratégia extrema: simular typing
                        input.focus();
                        input.value = '';
                        input.value = cleanText;
                    }
                    console.log(`✅ VALOR FINAL CONFIRMADO: "${input.value}"`);
                }, 100);
            } else {
                console.log('❌ Nenhum texto capturado para finalizar');
            }
            
            // Auto-enviar se tiver texto suficiente
            if (cleanText.length > 2) {
                console.log('🚀 Tentando auto-enviar mensagem...');
                setTimeout(() => {
                    const sendBtn = document.getElementById('chatbotActiveSendBtn') || 
                                  document.getElementById('chatbotSendButton') ||
                                  document.querySelector('.chatbot-send-button') ||
                                  document.querySelector('[id*="send"]') ||
                                  document.querySelector('button[type="submit"]');
                                  
                    if (sendBtn) {
                        console.log('📤 SEND BUTTON ENCONTRADO, clicando:', sendBtn);
                        sendBtn.click();
                    } else {
                        console.log('❌ Nenhum botão de envio encontrado');
                        console.log('🔍 Botões disponíveis:', document.querySelectorAll('button'));
                    }
                }, 2000); // 2 segundos para garantir que o texto foi definido
            }
        };
        
        recognition.onerror = (event) => {
            console.log('❌ Recognition error:', event.error);
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            micIcon.style.filter = 'none';
            input.placeholder = 'Erro - tente novamente';
            input.style.borderColor = '';
            
            // Salvar texto parcial
            if (finalText.trim()) {
                input.value = finalText.trim();
                console.log('💾 Saved partial text:', finalText.trim());
            }
        };
        
        // Iniciar
        console.log('🎯 Starting recognition...');
        recognition.start();
    }
    
    function stopListening() {
        if (recognition && isListening) {
            console.log('⏹️ Stopping recognition...');
            recognition.stop();
        }
    }
    
    console.log('🎉 Simple Voice Message setup complete!');
}

console.log('📁 voice-simple.js loaded');
