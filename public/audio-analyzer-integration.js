// 🎵 AUDIO ANALYZER INTEGRATION
// Conecta o sistema de análise de áudio com o chat existente

let currentModalAnalysis = null;

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioAnalyzerIntegration();
});

// 📱 Trigger para upload de arquivo mobile-friendly
function triggerMobileFileUpload() {
    console.log('📱 Trigger mobile file upload');
    
    // Debug info
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    
    console.log('📱 Device info:', { isIOS, isAndroid, userAgent });
    
    const fileInput = document.getElementById('modalAudioFileInput');
    if (!fileInput) {
        console.error('❌ File input not found!');
        return;
    }
    
    console.log('📱 File input found:', fileInput);
    console.log('📱 File input accept:', fileInput.accept);
    
    if (isIOS) {
        // Estratégia específica para iOS
        console.log('📱 Using iOS-specific file upload strategy');
        
        // Tornar visível temporariamente
        fileInput.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            opacity: 0.01 !important;
            z-index: 999999 !important;
            width: 100px !important;
            height: 100px !important;
            pointer-events: auto !important;
        `;
        
        // Foco no input antes do click
        fileInput.focus();
        
        setTimeout(() => {
            try {
                fileInput.click();
                console.log('📱 iOS file input clicked');
            } catch (error) {
                console.error('❌ Error clicking file input:', error);
            }
            
            // Reesconder após delay maior
            setTimeout(() => {
                fileInput.style.cssText = `
                    position: absolute !important;
                    left: -9999px !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                `;
            }, 300);
        }, 50);
    } else {
        // Estratégia padrão para outros dispositivos
        console.log('📱 Using standard file upload strategy');
        
        fileInput.style.position = 'fixed';
        fileInput.style.top = '0';
        fileInput.style.left = '0';
        fileInput.style.opacity = '0.01';
        fileInput.style.pointerEvents = 'auto';
        fileInput.style.zIndex = '9999';
        
        fileInput.click();
        
        setTimeout(() => {
            fileInput.style.position = 'absolute';
            fileInput.style.left = '-9999px';
            fileInput.style.opacity = '0';
            fileInput.style.pointerEvents = 'none';
            fileInput.style.zIndex = 'auto';
        }, 100);
    }
}

// Tornar função global
window.triggerMobileFileUpload = triggerMobileFileUpload;

function initializeAudioAnalyzerIntegration() {
    console.log('🎵 Inicializando integração do Audio Analyzer...');
    
    // Botão de análise de música (novo design)
    const musicAnalysisBtn = document.getElementById('musicAnalysisBtn');
    if (musicAnalysisBtn) {
        musicAnalysisBtn.addEventListener('click', openAudioModal);
        console.log('✅ Botão de Análise de Música configurado');
    }
    
    // Modal de áudio
    setupAudioModal();
    
    console.log('🎵 Audio Analyzer Integration carregada com sucesso!');
}

// 🎵 Abrir modal de análise de áudio
function openAudioModal() {
    console.log('🎵 Abrindo modal de análise de áudio...');
    
    const modal = document.getElementById('audioAnalysisModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Reset modal state
        resetModalState();
        
        // Focus no modal
        modal.setAttribute('tabindex', '-1');
        modal.focus();
    }
}

// ❌ Fechar modal de análise de áudio
function closeAudioModal() {
    console.log('❌ Fechando modal de análise de áudio...');
    
    const modal = document.getElementById('audioAnalysisModal');
    if (modal) {
        modal.style.display = 'none';
        currentModalAnalysis = null;
        resetModalState();
    }
}

// 🔄 Reset estado do modal
function resetModalState() {
    // Mostrar área de upload
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (uploadArea) uploadArea.style.display = 'block';
    if (loading) loading.style.display = 'none';
    if (results) results.style.display = 'none';
    
    // Reset progress
    const progressFill = document.getElementById('audioProgressFill');
    if (progressFill) progressFill.style.width = '0%';
}

// ⚙️ Configurar modal de áudio
function setupAudioModal() {
    const modal = document.getElementById('audioAnalysisModal');
    const fileInput = document.getElementById('modalAudioFileInput');
    const uploadArea = document.getElementById('audioUploadArea');
    
    if (!modal || !fileInput || !uploadArea) {
        console.warn('⚠️ Elementos do modal não encontrados');
        return;
    }
    
    // Fechar modal clicando fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAudioModal();
        }
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeAudioModal();
        }
    });
    
    // Detectar se é dispositivo móvel
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) {
        // Drag and Drop (apenas para desktop)
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.querySelector('.upload-content').classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.querySelector('.upload-content').classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.querySelector('.upload-content').classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleModalFileSelection(files[0]);
            }
        });
    }
    
    // File input change event
    fileInput.addEventListener('change', (e) => {
        console.log('📁 File input change triggered');
        if (e.target.files.length > 0) {
            console.log('📁 File selected:', e.target.files[0].name);
            handleModalFileSelection(e.target.files[0]);
        }
    });
    
    // Click na área de upload (mobile-friendly)
    uploadArea.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.closest('.upload-content') || e.target.closest('.upload-btn')) {
            console.log('📱 Upload area clicked');
            triggerMobileFileUpload();
        }
    });
    
    // Touch events para mobile
    uploadArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        console.log('📱 Touch start on upload area');
    });
    
    uploadArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        console.log('📱 Touch end on upload area');
        if (e.target.closest('.upload-content') || e.target.closest('.upload-btn')) {
            triggerMobileFileUpload();
        }
    });
    
    console.log('✅ Modal de áudio configurado com sucesso');
}

// 📁 Processar arquivo selecionado no modal
async function handleModalFileSelection(file) {
    console.log('📁 Arquivo selecionado no modal:', file.name);
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('audio/')) {
        showModalError('Por favor, selecione um arquivo de áudio válido.');
        return;
    }
    
    // Validar tamanho (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
        showModalError('Arquivo muito grande. Tamanho máximo: 20MB');
        return;
    }
    
    try {
        // Mostrar loading com progresso detalhado
        showModalLoading();
        updateModalProgress(10, 'Inicializando analisador...');
        
        // Aguardar audio analyzer carregar se necessário
        if (!window.audioAnalyzer) {
            console.log('⏳ Aguardando Audio Analyzer carregar...');
            updateModalProgress(20, 'Carregando motor de análise...');
            await waitForAudioAnalyzer();
        }
        
        // Analisar arquivo
        console.log('🔬 Iniciando análise...');
        updateModalProgress(40, 'Decodificando arquivo de áudio...');
        
        const analysis = await window.audioAnalyzer.analyzeAudioFile(file);
        currentModalAnalysis = analysis;
        
        console.log('✅ Análise concluída:', analysis);
        
        updateModalProgress(90, 'Gerando relatório...');
        
        // Aguardar um pouco para melhor UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateModalProgress(100, 'Análise concluída!');
        
        // Mostrar resultados
        setTimeout(() => {
            displayModalResults(analysis);
        }, 800);
        
    } catch (error) {
        console.error('❌ Erro na análise do modal:', error);
        showModalError(`Erro ao analisar arquivo: ${error.message}`);
    }
}

// ⏳ Aguardar Audio Analyzer carregar
function waitForAudioAnalyzer() {
    return new Promise((resolve) => {
        if (window.audioAnalyzer) {
            resolve();
            return;
        }
        
        const checkInterval = setInterval(() => {
            if (window.audioAnalyzer) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        // Timeout após 10 segundos
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 10000);
    });
}

// � Atualizar progresso no modal
function updateModalProgress(percentage, message) {
    const progressFill = document.getElementById('audioProgressFill');
    const progressText = document.getElementById('audioProgressText');
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = message || `${percentage}%`;
    }
    
    console.log(`📈 Progresso: ${percentage}% - ${message}`);
}

// ❌ Mostrar erro no modal
function showModalError(message) {
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (results) {
        results.style.display = 'block';
        results.innerHTML = `
            <div style="color: #ff4444; text-align: center; padding: 30px;">
                <div style="font-size: 3em; margin-bottom: 15px;">⚠️</div>
                <h3 style="margin: 0 0 15px 0; color: #ff4444;">Erro na Análise</h3>
                <p style="margin: 0 0 25px 0; color: #666; line-height: 1.4;">${message}</p>
                <button onclick="resetModalState()" style="
                    background: #ff4444; 
                    color: white; 
                    border: none; 
                    padding: 12px 25px; 
                    border-radius: 6px; 
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#ff3333'" 
                   onmouseout="this.style.background='#ff4444'">
                    Tentar Novamente
                </button>
            </div>
        `;
    }
}

// �🔄 Mostrar loading no modal
function showModalLoading() {
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (results) results.style.display = 'none';
    if (loading) loading.style.display = 'block';
    
    // Reset progress
    updateModalProgress(0, 'Iniciando análise...');
}

// 📈 Simular progresso
function simulateProgress() {
    const progressFill = document.getElementById('audioProgressFill');
    if (!progressFill) return;
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 95) {
            progress = 95; // Parar em 95% até análise concluir
            clearInterval(interval);
        }
        progressFill.style.width = progress + '%';
    }, 150);
    
    // Completar ao final
    setTimeout(() => {
        clearInterval(interval);
        progressFill.style.width = '100%';
    }, 3000);
}

// 📊 Mostrar resultados no modal
function displayModalResults(analysis) {
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    const technicalData = document.getElementById('modalTechnicalData');
    
    if (!results || !technicalData) {
        console.error('❌ Elementos de resultado não encontrados');
        return;
    }
    
    // Ocultar outras seções
    if (uploadArea) uploadArea.style.display = 'none';
    if (loading) loading.style.display = 'none';
    
    // Mostrar resultados
    results.style.display = 'block';
    
    // Construir dados técnicos
    technicalData.innerHTML = `
        <div class="data-row">
            <span class="label">📈 Peak:</span>
            <span class="value">${analysis.technicalData.peak.toFixed(1)} dB</span>
        </div>
        <div class="data-row">
            <span class="label">🔊 RMS:</span>
            <span class="value">${analysis.technicalData.rms.toFixed(1)} dB</span>
        </div>
        <div class="data-row">
            <span class="label">📊 Dinâmica:</span>
            <span class="value">${analysis.technicalData.dynamicRange.toFixed(1)} dB</span>
        </div>
        <div class="data-row">
            <span class="label">⏱️ Duração:</span>
            <span class="value">${analysis.duration.toFixed(1)}s</span>
        </div>
        ${analysis.technicalData.dominantFrequencies.length > 0 ? `
        <div class="data-row">
            <span class="label">🎯 Freq. Dominante:</span>
            <span class="value">${Math.round(analysis.technicalData.dominantFrequencies[0].frequency)} Hz</span>
        </div>
        ` : ''}
        ${analysis.problems.length > 0 ? `
        <div class="data-row">
            <span class="label">🚨 Problemas:</span>
            <span class="value" style="color: #ff6b6b;">${analysis.problems.length} detectado(s)</span>
        </div>
        ` : ''}
        ${analysis.suggestions.length > 0 ? `
        <div class="data-row">
            <span class="label">💡 Sugestões:</span>
            <span class="value" style="color: #51cf66;">${analysis.suggestions.length} disponível(s)</span>
        </div>
        ` : ''}
    `;
    
    console.log('📊 Resultados exibidos no modal');
}

// 🤖 Enviar análise para chat
async function sendModalAnalysisToChat() {
    console.log('🎯 BOTÃO CLICADO: Pedir Ajuda à IA');
    
    if (!currentModalAnalysis) {
        alert('Nenhuma análise disponível');
        console.log('❌ Erro: currentModalAnalysis não existe');
        return;
    }
    
    console.log('🤖 Enviando análise para chat...', currentModalAnalysis);
    
    try {
        // Gerar prompt personalizado baseado nos problemas encontrados
        const prompt = window.audioAnalyzer.generateAIPrompt(currentModalAnalysis);
        const message = `🎵 Analisei meu áudio e preciso de ajuda para melhorar. Aqui estão os dados técnicos:\n\n${prompt}`;
        
        console.log('📝 Prompt gerado:', message.substring(0, 200) + '...');
        
        // Tentar diferentes formas de integrar com o chat
        let messageSent = false;
        
        // Método 1: Usar o sistema ProdAI Chatbot
        if (window.prodAIChatbot && typeof window.prodAIChatbot.sendMessage === 'function') {
            console.log('🎯 Tentando enviar via ProdAI Chatbot...');
            
            // Inserir mensagem no input ativo
            const activeInput = document.getElementById('chatbotActiveInput');
            if (activeInput) {
                console.log('✅ Input encontrado:', activeInput);
                
                activeInput.value = message;
                activeInput.focus();
                
                // Disparar evento de input para simular digitação
                const inputEvent = new Event('input', { bubbles: true });
                activeInput.dispatchEvent(inputEvent);
                
                // Aguardar um pouco e enviar mensagem
                setTimeout(async () => {
                    try {
                        await window.prodAIChatbot.sendMessage();
                        console.log('✅ Mensagem enviada via ProdAI Chatbot');
                        showTemporaryFeedback('🎵 Análise enviada para o chat!');
                        closeAudioModal();
                    } catch (error) {
                        console.error('❌ Erro no envio:', error);
                        showTemporaryFeedback('❌ Erro ao enviar. Tente novamente.');
                    }
                }, 500);
                
                messageSent = true;
            } else {
                console.log('❌ Input não encontrado');
            }
        }
        // Método 2: Inserir diretamente no input e simular envio
        else {
            console.log('🎯 Tentando método alternativo...');
            
            const input = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
            const sendBtn = document.getElementById('chatbotActiveSendBtn') || document.getElementById('chatbotSendButton');
            
            console.log('🔍 Elementos encontrados:', { input: !!input, sendBtn: !!sendBtn });
            
            if (input && sendBtn) {
                input.value = message;
                input.focus();
                
                // Disparar eventos para simular interação do usuário
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Aguardar um pouco e clicar no botão
                setTimeout(() => {
                    sendBtn.click();
                    console.log('✅ Botão clicado');
                    showTemporaryFeedback('🎵 Análise enviada para o chat!');
                    closeAudioModal();
                }, 500);
                
                messageSent = true;
            }
        }
        
        if (!messageSent) {
            console.log('❌ Não foi possível enviar automaticamente, copiando para clipboard...');
            
            // Fallback: copiar para clipboard
            await navigator.clipboard.writeText(message);
            showTemporaryFeedback('📋 Análise copiada! Cole no chat manualmente.');
            console.log('📋 Mensagem copiada para clipboard como fallback');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar análise para chat:', error);
        showTemporaryFeedback('❌ Erro ao enviar análise. Tente novamente.');
    }
}

// � Mostrar feedback temporário
function showTemporaryFeedback(message, duration = 3000) {
    // Criar elemento de feedback
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    feedback.textContent = message;
    document.body.appendChild(feedback);
    
    // Animar entrada
    setTimeout(() => {
        feedback.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover após o tempo especificado
    setTimeout(() => {
        feedback.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, duration);
}

// �📄 Baixar relatório do modal
function downloadModalAnalysis() {
    if (!currentModalAnalysis) {
        alert('Nenhuma análise disponível');
        return;
    }
    
    console.log('📄 Baixando relatório...');
    
    try {
        const report = generateDetailedReport(currentModalAnalysis);
        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `prod_ai_audio_analysis_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Relatório baixado com sucesso');
        showTemporaryFeedback('📄 Relatório baixado!');
        
    } catch (error) {
        console.error('❌ Erro ao baixar relatório:', error);
        alert('Erro ao gerar relatório');
    }
}

// 📋 Gerar relatório detalhado
function generateDetailedReport(analysis) {
    const now = new Date();
    let report = `🎵 PROD.AI - RELATÓRIO DE ANÁLISE DE ÁUDIO\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `📅 Data: ${now.toLocaleString('pt-BR')}\n`;
    report += `🔬 Análise realizada com tecnologia Web Audio API\n\n`;
    
    report += `📊 DADOS TÉCNICOS PRINCIPAIS:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `Peak Level: ${analysis.technicalData.peak.toFixed(2)} dB\n`;
    report += `RMS Level: ${analysis.technicalData.rms.toFixed(2)} dB\n`;
    report += `Dynamic Range: ${analysis.technicalData.dynamicRange.toFixed(2)} dB\n`;
    report += `Duration: ${analysis.duration.toFixed(2)} seconds\n`;
    report += `Sample Rate: ${analysis.sampleRate || 'N/A'} Hz\n`;
    report += `Channels: ${analysis.channels || 'N/A'}\n\n`;
    
    if (analysis.technicalData.dominantFrequencies.length > 0) {
        report += `🎯 FREQUÊNCIAS DOMINANTES:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.technicalData.dominantFrequencies.slice(0, 10).forEach((freq, i) => {
            report += `${i + 1}. ${Math.round(freq.frequency)} Hz (${freq.occurrences} ocorrências)\n`;
        });
        report += `\n`;
    }
    
    if (analysis.problems.length > 0) {
        report += `🚨 PROBLEMAS DETECTADOS:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.problems.forEach((problem, i) => {
            report += `${i + 1}. PROBLEMA: ${problem.message}\n`;
            report += `   SOLUÇÃO: ${problem.solution}\n`;
            report += `   SEVERIDADE: ${problem.severity}\n\n`;
        });
    }
    
    if (analysis.suggestions.length > 0) {
        report += `💡 SUGESTÕES DE MELHORIA:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.suggestions.forEach((suggestion, i) => {
            report += `${i + 1}. ${suggestion.message}\n`;
            report += `   AÇÃO: ${suggestion.action}\n`;
            report += `   TIPO: ${suggestion.type}\n\n`;
        });
    }
    
    report += `📝 OBSERVAÇÕES TÉCNICAS:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `• Esta análise foi realizada usando Web Audio API\n`;
    report += `• Para análises mais avançadas, considere usar ferramentas profissionais\n`;
    report += `• Valores de referência: RMS ideal para streaming: -14 LUFS\n`;
    report += `• Peak ideal: máximo -1 dB para evitar clipping\n`;
    report += `• Dynamic range ideal: entre 8-15 dB para música popular\n\n`;
    
    report += `🎵 Gerado por PROD.AI - Seu mentor de produção musical\n`;
    report += `📱 Para mais análises: prod-ai-teste.vercel.app\n`;
    
    return report;
}

// 💬 Mostrar feedback temporário
function showTemporaryFeedback(message) {
    // Criar elemento de feedback
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #00d4ff, #0096cc);
        color: #000;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
    `;
    feedback.textContent = message;
    
    // Adicionar animação CSS
    if (!document.getElementById('feedbackStyles')) {
        const style = document.createElement('style');
        style.id = 'feedbackStyles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // Remover após 3 segundos
    setTimeout(() => {
        feedback.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, 3000);
}

console.log('🎵 Audio Analyzer Integration Script carregado!');

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 DOM carregado, inicializando Audio Analyzer...');
    initializeAudioAnalyzerIntegration();
});

// Fallback: se o DOM já estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAudioAnalyzerIntegration);
} else {
    initializeAudioAnalyzerIntegration();
}
