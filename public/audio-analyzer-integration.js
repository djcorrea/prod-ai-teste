// 🎵 AUDIO ANALYZER INTEGRATION
// Conecta o sistema de análise de áudio com o chat existente

// Debug flag (silencia logs em produção; defina window.DEBUG_ANALYZER = true para habilitar)
const __DEBUG_ANALYZER__ = (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true);
const __dbg = (...a) => { if (__DEBUG_ANALYZER__) console.log(...a); };
const __dwrn = (...a) => { if (__DEBUG_ANALYZER__) console.warn(...a); };

let currentModalAnalysis = null;
let __audioIntegrationInitialized = false; // evita listeners duplicados

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioAnalyzerIntegration();
});


function initializeAudioAnalyzerIntegration() {
    if (__audioIntegrationInitialized) {
        __dbg('ℹ️ Integração do Audio Analyzer já inicializada. Ignorando chamada duplicada.');
        return;
    }
    __audioIntegrationInitialized = true;
    __dbg('🎵 Inicializando integração do Audio Analyzer...');
    
    // Botão de análise de música (novo design)
    const musicAnalysisBtn = document.getElementById('musicAnalysisBtn');
    if (musicAnalysisBtn) {
        musicAnalysisBtn.addEventListener('click', openAudioModal);
        __dbg('✅ Botão de Análise de Música configurado');
    }
    
    // Modal de áudio
    setupAudioModal();
    
    __dbg('🎵 Audio Analyzer Integration carregada com sucesso!');
}

// 🎵 Abrir modal de análise de áudio
function openAudioModal() {
    __dbg('🎵 Abrindo modal de análise de áudio...');
    
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
    __dbg('❌ Fechando modal de análise de áudio...');
    
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
        __dwrn('⚠️ Elementos do modal não encontrados');
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
        __dbg('📁 File input change triggered');
        if (e.target.files.length > 0) {
            __dbg('📁 File selected:', e.target.files[0].name);
            handleModalFileSelection(e.target.files[0]);
        }
    });
    
    // Não adicionar nenhum listener JS ao botão/label de upload!
    uploadArea.onclick = null;
    
    __dbg('✅ Modal de áudio configurado com sucesso');
}

// 📁 Processar arquivo selecionado no modal
async function handleModalFileSelection(file) {
    __dbg('📁 Arquivo selecionado no modal:', file.name);
    
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
        updateModalProgress(10, '⚡ Carregando Algoritmos Avançados...');
        
        // Aguardar audio analyzer carregar se necessário
        if (!window.audioAnalyzer) {
            __dbg('⏳ Aguardando Audio Analyzer carregar...');
            updateModalProgress(20, '🔧 Inicializando V2 Engine...');
            await waitForAudioAnalyzer();
        }
        
        // Analisar arquivo
        __dbg('🔬 Iniciando análise...');
        updateModalProgress(40, '🎵 Processando Waveform Digital...');
        
    const analysis = await window.audioAnalyzer.analyzeAudioFile(file);
        currentModalAnalysis = analysis;
        
        __dbg('✅ Análise concluída:', analysis);
        
        updateModalProgress(90, '🧠 Computando Métricas Avançadas...');
        
        // Aguardar um pouco para melhor UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateModalProgress(100, '✨ Análise Completa - Pronto!');
        
        // Mostrar resultados
        setTimeout(() => {
            // Telemetria: verificar elementos alvo antes de preencher o modal
            const exists = {
                audioUploadArea: !!document.getElementById('audioUploadArea'),
                audioAnalysisLoading: !!document.getElementById('audioAnalysisLoading'),
                audioAnalysisResults: !!document.getElementById('audioAnalysisResults'),
                modalTechnicalData: !!document.getElementById('modalTechnicalData')
            };
            __dbg('🛰️ [Telemetry] Front antes de preencher modal (existência de elementos):', exists);
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
    
    __dbg(`📈 Progresso: ${percentage}% - ${message}`);
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
    updateModalProgress(0, '🔄 Inicializando Engine de Análise...');
}

// 📈 Simular progresso
// (função de simulação de progresso removida — não utilizada)

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
    
    // Helpers seguros
    const safeFixed = (v, d=1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    const safeHz = (v) => (Number.isFinite(v) ? `${Math.round(v)} Hz` : '—');
    const pct = (v, d=0) => (Number.isFinite(v) ? `${(v*100).toFixed(d)}%` : '—');
    const tonalSummary = (tb) => {
        if (!tb || typeof tb !== 'object') return '—';
        const parts = [];
        if (tb.sub && Number.isFinite(tb.sub.rms_db)) parts.push(`Sub ${tb.sub.rms_db.toFixed(1)}dB`);
        if (tb.low && Number.isFinite(tb.low.rms_db)) parts.push(`Low ${tb.low.rms_db.toFixed(1)}dB`);
        if (tb.mid && Number.isFinite(tb.mid.rms_db)) parts.push(`Mid ${tb.mid.rms_db.toFixed(1)}dB`);
        if (tb.high && Number.isFinite(tb.high.rms_db)) parts.push(`High ${tb.high.rms_db.toFixed(1)}dB`);
        return parts.length ? parts.join(' • ') : '—';
    };

        // Layout com cards e KPIs, mantendo o container #modalTechnicalData
        const kpi = (value, label, cls='') => `
            <div class="kpi ${cls}">
                <div class="kpi-value">${value}</div>
                <div class="kpi-label">${label}</div>
            </div>`;

        const scoreKpi = Number.isFinite(analysis.qualityOverall) ? kpi(Math.round(analysis.qualityOverall), 'SCORE GERAL', 'kpi-score') : '';
        const timeKpi = Number.isFinite(analysis.processingMs) ? kpi(analysis.processingMs, 'TEMPO (MS)', 'kpi-time') : '';

        const row = (label, valHtml) => `
            <div class="data-row">
                <span class="label">${label}</span>
                <span class="value">${valHtml}</span>
            </div>`;

        const safePct = (v) => (Number.isFinite(v) ? `${(v*100).toFixed(0)}%` : '—');
        const monoCompat = (s) => s ? s : '—';

        const col1 = [
            row('Peak', `${safeFixed(analysis.technicalData.peak)} dB`),
            row('RMS', `${safeFixed(analysis.technicalData.rms)} dB`),
            row('Dinâmica', `${safeFixed(analysis.technicalData.dynamicRange)} dB`),
            row('Crest Factor', `${safeFixed(analysis.technicalData.crestFactor)}`),
            row('True Peak', Number.isFinite(analysis.technicalData.truePeakDbtp) ? `${safeFixed(analysis.technicalData.truePeakDbtp)} dBTP` : '—'),
            row('LUFS (Int.)', Number.isFinite(analysis.technicalData.lufsIntegrated) ? `${safeFixed(analysis.technicalData.lufsIntegrated)} LUFS` : '—'),
            row('LRA', Number.isFinite(analysis.technicalData.lra) ? `${safeFixed(analysis.technicalData.lra)} dB` : '—')
        ].join('');

        const col2 = [
            row('Correlação', Number.isFinite(analysis.technicalData.stereoCorrelation) ? safeFixed(analysis.technicalData.stereoCorrelation, 2) : '—'),
            row('Largura', Number.isFinite(analysis.technicalData.stereoWidth) ? safeFixed(analysis.technicalData.stereoWidth, 2) : '—'),
            row('Balance', Number.isFinite(analysis.technicalData.balanceLR) ? safePct(analysis.technicalData.balanceLR) : '—'),
            row('Mono Compat.', monoCompat(analysis.technicalData.monoCompatibility)),
            row('Centroide', Number.isFinite(analysis.technicalData.spectralCentroid) ? safeHz(analysis.technicalData.spectralCentroid) : '—'),
            row('Rolloff (85%)', Number.isFinite(analysis.technicalData.spectralRolloff85) ? safeHz(analysis.technicalData.spectralRolloff85) : '—'),
            row('Flux', Number.isFinite(analysis.technicalData.spectralFlux) ? safeFixed(analysis.technicalData.spectralFlux, 3) : '—'),
            row('Flatness', Number.isFinite(analysis.technicalData.spectralFlatness) ? safeFixed(analysis.technicalData.spectralFlatness, 3) : '—')
        ].join('');

            const col3 = [
                row('Tonal Balance', analysis.technicalData?.tonalBalance ? tonalSummary(analysis.technicalData.tonalBalance) : '—'),
                (analysis.technicalData.dominantFrequencies.length > 0 ? row('Freq. Dominante', `${Math.round(analysis.technicalData.dominantFrequencies[0].frequency)} Hz`) : ''),
                row('Problemas', analysis.problems.length > 0 ? `<span class="tag tag-danger">${analysis.problems.length} detectado(s)</span>` : '—'),
                row('Sugestões', analysis.suggestions.length > 0 ? `<span class="tag tag-success">${analysis.suggestions.length} disponível(s)</span>` : '—')
            ].join('');

            // Card extra: Métricas Avançadas (novo card)
            const advancedMetricsCard = () => {
                const rows = [];
                // LUFS ST/M e Headroom
                if (Number.isFinite(analysis.technicalData?.lufsShortTerm)) {
                    rows.push(row('LUFS (Short‑Term)', `${safeFixed(analysis.technicalData.lufsShortTerm, 1)} LUFS`));
                }
                if (Number.isFinite(analysis.technicalData?.lufsMomentary)) {
                    rows.push(row('LUFS (Momentary)', `${safeFixed(analysis.technicalData.lufsMomentary, 1)} LUFS`));
                }
                if (Number.isFinite(analysis.technicalData?.headroomDb)) {
                    rows.push(row('Headroom', `${safeFixed(analysis.technicalData.headroomDb, 1)} dB`));
                }
                // Picos por canal
                if (Number.isFinite(analysis.technicalData?.samplePeakLeftDb)) {
                    rows.push(row('Sample Peak (L)', `${safeFixed(analysis.technicalData.samplePeakLeftDb, 1)} dB`));
                }
                if (Number.isFinite(analysis.technicalData?.samplePeakRightDb)) {
                    rows.push(row('Sample Peak (R)', `${safeFixed(analysis.technicalData.samplePeakRightDb, 1)} dB`));
                }
                // Clipping (%)
                if (Number.isFinite(analysis.technicalData?.clippingPct)) {
                    rows.push(row('Clipping (%)', `${safeFixed(analysis.technicalData.clippingPct, 2)}%`));
                }
                // Frequências dominantes extras
                if (Array.isArray(analysis.technicalData?.dominantFrequencies) && analysis.technicalData.dominantFrequencies.length > 1) {
                    const extra = analysis.technicalData.dominantFrequencies.slice(1, 4)
                        .map((f, idx) => `${idx+2}. ${Math.round(f.frequency)} Hz (${f.occurrences || 1}x)`).join('<br>');
                    if (extra) rows.push(row('Top Freq. adicionais', `<span style="opacity:.9">${extra}</span>`));
                }
                return rows.join('') || row('Status', 'Sem métricas adicionais');
            };

            // Card extra: Problemas Técnicos detalhados
            const techProblems = () => {
                const rows = [];
                const clipVal = Number.isFinite(analysis.technicalData?.clippingSamples) ? analysis.technicalData.clippingSamples : 0;
                const dcVal = Number.isFinite(analysis.technicalData?.dcOffset) ? analysis.technicalData.dcOffset : 0;
                rows.push(row('Clipping', `<span class="warn">${clipVal} samples</span>`));
                rows.push(row('DC Offset', `${safeFixed(dcVal, 4)}`));
                return rows.join('');
            };

            // Card extra: Diagnóstico & Sugestões listados
            const diagCard = () => {
                const blocks = [];
                if (analysis.problems.length > 0) {
                    const list = analysis.problems.slice(0, 4).map(p => `
                        <div class="diag-item danger">
                            <div class="diag-title">${p.message}</div>
                            <div class="diag-tip">${p.solution || ''}</div>
                        </div>`).join('');
                    blocks.push(`<div class="diag-section"><div class="diag-heading">Problemas:</div>${list}</div>`);
                }
                if (analysis.suggestions.length > 0) {
                    const list = analysis.suggestions.slice(0, 4).map(s => `
                        <div class="diag-item info">
                            <div class="diag-title">${s.message}</div>
                            <div class="diag-tip">${s.action || ''}</div>
                        </div>`).join('');
                    blocks.push(`<div class="diag-section"><div class="diag-heading">Sugestões:</div>${list}</div>`);
                }
                // Subbloco opcional com diagnósticos do V2 (quando disponíveis)
                if (analysis.v2Diagnostics) {
                    const v2p = (analysis.v2Diagnostics.problems || []).slice(0, 4).map(p => `
                        <div class="diag-item danger">
                            <div class="diag-title">${p.message}</div>
                            <div class="diag-tip">${p.solution || ''}</div>
                        </div>`).join('');
                    const v2s = (analysis.v2Diagnostics.suggestions || []).slice(0, 4).map(s => `
                        <div class="diag-item info">
                            <div class="diag-title">${s.message}</div>
                            <div class="diag-tip">${s.action || ''}</div>
                        </div>`).join('');
                    const anyV2 = v2p || v2s;
                    if (anyV2) {
                        const v2Block = `
                            <div class="diag-section">
                                <div class="diag-heading">(V2) Diagnósticos Avançados:</div>
                                ${v2p ? `<div class=\"diag-subheading\">Problemas (V2)</div>${v2p}` : ''}
                                ${v2s ? `<div class=\"diag-subheading\">Sugestões (V2)</div>${v2s}` : ''}
                            </div>`;
                        blocks.push(v2Block);
                    }
                }
                return blocks.join('') || '<div class="diag-empty">Sem diagnósticos</div>';
            };

        const breakdown = analysis.qualityBreakdown || {};
        
        // Função para renderizar score com barra de progresso
        const renderScoreWithProgress = (label, value, color = '#00ffff') => {
            const numValue = parseFloat(value) || 0;
            const displayValue = value != null ? value : '—';
            
            if (value == null) {
                return `<div class="data-row">
                    <span class="label">${label}:</span>
                    <span class="value">—</span>
                </div>`;
            }
            
            return `<div class="data-row metric-with-progress">
                <span class="label">${label}:</span>
                <div class="metric-value-progress">
                    <span class="value">${displayValue}/100</span>
                    <div class="progress-bar-mini">
                        <div class="progress-fill-mini" style="width: ${Math.min(Math.max(numValue, 0), 100)}%; background: ${color}; color: ${color};"></div>
                    </div>
                </div>
            </div>`;
        };
        
        const scoreRows = breakdown ? `
            ${renderScoreWithProgress('Dinâmica', breakdown.dynamics, '#ffd700')}
            ${renderScoreWithProgress('Técnico', breakdown.technical, '#00ff92')}
            ${renderScoreWithProgress('Loudness', breakdown.loudness, '#ff3366')}
            ${renderScoreWithProgress('Frequência', breakdown.frequency, '#00ffff')}
        ` : '';

        technicalData.innerHTML = `
            <div class="kpi-row">${scoreKpi}${timeKpi}</div>
                    <div class="cards-grid">
                        <div class="card">
                    <div class="card-title">🎛️ Métricas Principais</div>
                    ${col1}
                </div>
                        <div class="card">
                    <div class="card-title">🎧 Análise Estéreo & Espectral</div>
                    ${col2}
                </div>
                        <div class="card">
                    <div class="card-title">🏆 Scores & Diagnóstico</div>
                    ${scoreRows}
                    ${col3}
                </div>
                        <div class="card">
                            <div class="card-title">🧠 Métricas Avançadas</div>
                            ${advancedMetricsCard()}
                        </div>
                        <div class="card card-span-2">
                            <div class="card-title">⚠️ Problemas Técnicos</div>
                            ${techProblems()}
                        </div>
                        <div class="card card-span-2">
                            <div class="card-title">🩺 Diagnóstico & Sugestões</div>
                            ${diagCard()}
                        </div>
            </div>
        `;
    
    __dbg('📊 Resultados exibidos no modal');
}

// 🤖 Enviar análise para chat
window.sendModalAnalysisToChat = async function sendModalAnalysisToChat() {
    __dbg('🎯 BOTÃO CLICADO: Pedir Ajuda à IA');
    
    if (!currentModalAnalysis) {
        alert('Nenhuma análise disponível');
        __dbg('❌ Erro: currentModalAnalysis não existe');
        return;
    }
    
    __dbg('🤖 Enviando análise para chat...', currentModalAnalysis);
    
    try {
        // Gerar prompt personalizado baseado nos problemas encontrados
        const prompt = window.audioAnalyzer.generateAIPrompt(currentModalAnalysis);
        const message = `🎵 Analisei meu áudio e preciso de ajuda para melhorar. Aqui estão os dados técnicos:\n\n${prompt}`;
        
        __dbg('📝 Prompt gerado:', message.substring(0, 200) + '...');
        
        // Tentar diferentes formas de integrar com o chat
        let messageSent = false;
        
        // Método 1: Usar diretamente o ProdAI Chatbot quando disponível
        if (window.prodAIChatbot) {
            __dbg('🎯 Tentando enviar via ProdAI Chatbot...');
            try {
                // Se o chat ainda não está ativo, ativar com a mensagem
                if (!window.prodAIChatbot.isActive && typeof window.prodAIChatbot.activateChat === 'function') {
                    __dbg('🚀 Chat inativo. Ativando com a primeira mensagem...');
                    await window.prodAIChatbot.activateChat(message);
                    showTemporaryFeedback('🎵 Análise enviada para o chat!');
                    closeAudioModal();
                    messageSent = true;
                } else if (typeof window.prodAIChatbot.sendMessage === 'function') {
                    // Chat já ativo: preencher input ativo e enviar
                    const activeInput = document.getElementById('chatbotActiveInput');
                    if (activeInput) {
                        activeInput.value = message;
                        activeInput.focus();
                        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
                        await window.prodAIChatbot.sendMessage();
                        showTemporaryFeedback('🎵 Análise enviada para o chat!');
                        closeAudioModal();
                        messageSent = true;
                    }
                }
            } catch (err) {
                __dwrn('⚠️ Falha ao usar ProdAIChatbot direto, tentando fallback...', err);
            }
        }
        // Método 2: Inserir diretamente no input e simular envio
        else {
            __dbg('🎯 Tentando método alternativo...');
            
            const input = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
            const sendBtn = document.getElementById('chatbotActiveSendBtn') || document.getElementById('chatbotSendButton');
            
            __dbg('🔍 Elementos encontrados:', { input: !!input, sendBtn: !!sendBtn });
            
            if (input && sendBtn) {
                input.value = message;
                input.focus();
                
                // Disparar eventos para simular interação do usuário
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Aguardar um pouco e clicar no botão
                setTimeout(() => {
                    sendBtn.click();
                    __dbg('✅ Botão clicado');
                    showTemporaryFeedback('🎵 Análise enviada para o chat!');
                    closeAudioModal();
                }, 500);
                
                messageSent = true;
            }
        }
        
        if (!messageSent) {
            __dbg('❌ Não foi possível enviar automaticamente, copiando para clipboard...');
            
            // Fallback: copiar para clipboard
            await navigator.clipboard.writeText(message);
            showTemporaryFeedback('📋 Análise copiada! Cole no chat manualmente.');
            __dbg('📋 Mensagem copiada para clipboard como fallback');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar análise para chat:', error);
        showTemporaryFeedback('❌ Erro ao enviar análise. Tente novamente.');
    }
}

// � Mostrar feedback temporário
// (definição duplicada de showTemporaryFeedback removida — mantida a versão consolidada abaixo)

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

__dbg('🎵 Audio Analyzer Integration Script carregado!');

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    __dbg('🎵 DOM carregado, inicializando Audio Analyzer...');
    initializeAudioAnalyzerIntegration();
});

// Fallback: se o DOM já estiver carregado
if (document.readyState !== 'loading') {
    // se DOM já pronto, inicializar uma vez
    initializeAudioAnalyzerIntegration();
}
