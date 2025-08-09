// 🎵 AUDIO ANALYZER V2 INTEGRATION
// Conecta o motor V2 com o modal glassmorphism e chat

class AudioAnalyzerIntegrationV2 {
  constructor() {
    this.analyzer = new window.AudioAnalyzerV2();
    this.advancedAnalyzer = null; // Will be initialized if available
    this.currentAnalysis = null;
    this.isV2Enabled = true; // Feature flag
    this.config = {
      version: '2.0',
      features: ['core', 'spectral', 'stereo', 'quality', 'advanced'],
      enableAdvanced: true,
      usePresets: true,
      enableRealTimeViz: true,
      autoDetectQuality: true
    };
    
    // Initialize advanced analyzer if available
    this.initializeAdvancedFeatures();
    
    console.log('🎵 Audio Analyzer Integration V2 initialized');
  }

  // 🚀 Initialize advanced features
  initializeAdvancedFeatures() {
    if (typeof window.AudioAnalyzerV2Advanced !== 'undefined') {
      this.advancedAnalyzer = new window.AudioAnalyzerV2Advanced();
      console.log('✅ Advanced features enabled');
    } else {
      console.warn('⚠️ Advanced features not available');
    }
  }

  // 🎤 Inicializar integração
  async initialize() {
    console.log('🎵 Inicializando Audio Analyzer V2 Integration...');
    
    try {
      // Inicializar o analisador
      await this.analyzer.initialize();
      
      // Configurar event listeners
      this.setupEventListeners();
      
      // Configurar modal V2
      this.setupModalV2();
      
      console.log('✅ Audio Analyzer V2 Integration inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar integração V2:', error);
      return false;
    }
  }

  // ⚙️ Configurar event listeners
  setupEventListeners() {
    // Botão de análise de música (compatibilidade com V1)
    const musicAnalysisBtn = document.getElementById('musicAnalysisBtn');
    if (musicAnalysisBtn) {
      musicAnalysisBtn.addEventListener('click', () => this.openModalV2());
    }
    
    // Detectar se há botão de audio analyzer no chat
    const audioAnalyzerBtns = document.querySelectorAll('[data-action="audio-analyzer"], .chatbot-audio-analyze-btn');
    audioAnalyzerBtns.forEach(btn => {
      btn.addEventListener('click', () => this.openModalV2());
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen()) {
        this.closeModalV2();
      }
    });
    
    console.log('🎯 Event listeners configurados');
  }

  // 🎨 Configurar modal V2
  setupModalV2() {
    // Verificar se o modal V2 já existe
    let modal = document.getElementById('audioAnalysisModalV2');
    
    if (!modal) {
      // Criar modal V2 dinamicamente
      modal = this.createModalV2();
      document.body.appendChild(modal);
    }
    
    // Configurar eventos do modal
    this.setupModalEvents(modal);
    
    console.log('🎨 Modal V2 configurado');
  }

  // 🏗️ Criar modal V2 HTML
  createModalV2() {
    const modal = document.createElement('div');
    modal.id = 'audioAnalysisModalV2';
    modal.className = 'audio-analyzer-modal-v2';
    modal.style.display = 'none';
    
    modal.innerHTML = `
      <div class="analyzer-modal-content-v2">
        <!-- Header -->
        <div class="analyzer-modal-header-v2">
          <div style="display: flex; align-items: center;">
            <h3 class="analyzer-modal-title-v2">🎵 Audio Analyzer</h3>
            <span class="analyzer-modal-version-v2">v2.0</span>
          </div>
          <button class="analyzer-modal-close-v2" onclick="window.audioAnalyzerV2Integration?.closeModalV2()">&times;</button>
        </div>
        
        <!-- Upload Area -->
        <div class="analyzer-upload-area-v2" id="uploadAreaV2">
          <div class="upload-zone-v2" id="uploadZoneV2">
            <div class="upload-icon-v2">🎵</div>
            <h4 class="upload-title-v2">Análise Profissional de Áudio</h4>
            <p class="upload-description-v2">Arraste seu arquivo aqui ou clique para selecionar</p>
            <p class="upload-formats-v2">Suporta: MP3, WAV, M4A, FLAC, OGG (máx. 25MB)</p>
            <input type="file" id="audioFileInputV2" accept="audio/*" style="display: none;">
            <button class="upload-button-v2" onclick="document.getElementById('audioFileInputV2').click()">
              Escolher Arquivo
            </button>
          </div>
        </div>
        
        <!-- Loading -->
        <div class="analyzer-loading-v2" id="loadingAreaV2" style="display: none;">
          <div class="loading-spinner-v2"></div>
          <p class="loading-text-v2" id="loadingTextV2">Analisando áudio...</p>
          <div class="progress-bar-v2">
            <div class="progress-fill-v2" id="progressFillV2"></div>
          </div>
        </div>
        
        <!-- Results -->
        <div class="analyzer-results-v2" id="resultsAreaV2" style="display: none;">
          <div class="results-header-v2">
            <h4 class="results-title-v2">📊 Análise Completa</h4>
            <div class="results-summary-v2">
              <div class="summary-score-v2">
                <div class="score-value-v2" id="overallScoreV2">--</div>
                <div class="score-label-v2">Score Geral</div>
              </div>
              <div class="summary-score-v2">
                <div class="score-value-v2" id="processingTimeV2">--</div>
                <div class="score-label-v2">Tempo (ms)</div>
              </div>
            </div>
          </div>
          
          <div class="metrics-grid-v2" id="metricsGridV2">
            <!-- Cards de métricas serão inseridos dinamicamente -->
          </div>
          
          <div class="analyzer-actions-v2">
            <button class="action-btn-v2 action-btn-primary-v2" onclick="window.audioAnalyzerV2Integration?.sendAnalysisToChat()">
              🤖 Pedir Ajuda à IA
            </button>
            <button class="action-btn-v2 action-btn-secondary-v2" onclick="window.audioAnalyzerV2Integration?.downloadReport()">
              📄 Baixar Relatório
            </button>
          </div>
        </div>
      </div>
    `;
    
    return modal;
  }

  // 🎯 Configurar eventos do modal
  setupModalEvents(modal) {
    // File input
    const fileInput = modal.querySelector('#audioFileInputV2');
    const uploadZone = modal.querySelector('#uploadZoneV2');
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelection(e.target.files[0]);
      }
    });
    
    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      
      if (e.dataTransfer.files.length > 0) {
        this.handleFileSelection(e.dataTransfer.files[0]);
      }
    });
    
    // Click no modal para fechar
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModalV2();
      }
    });
  }

  // 🎵 Abrir modal V2
  openModalV2() {
    console.log('🎵 Abrindo modal V2...');
    
    const modal = document.getElementById('audioAnalysisModalV2');
    if (modal) {
      modal.style.display = 'flex';
      this.resetModalState();
      
      // Analytics
      this.trackEvent('modal_opened', { version: '2.0' });
    }
  }

  // ❌ Fechar modal V2
  closeModalV2() {
    console.log('❌ Fechando modal V2...');
    
    const modal = document.getElementById('audioAnalysisModalV2');
    if (modal) {
      modal.style.display = 'none';
      this.currentAnalysis = null;
    }
  }

  // 🔄 Reset estado do modal
  resetModalState() {
    const uploadArea = document.getElementById('uploadAreaV2');
    const loadingArea = document.getElementById('loadingAreaV2');
    const resultsArea = document.getElementById('resultsAreaV2');
    
    if (uploadArea) uploadArea.style.display = 'block';
    if (loadingArea) loadingArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'none';
    
    // Reset progress
    const progressFill = document.getElementById('progressFillV2');
    if (progressFill) progressFill.style.width = '0%';
  }

  // 📁 Processar arquivo selecionado
  async handleFileSelection(file) {
    console.log('📁 Arquivo selecionado:', file.name, file.size);
    
    try {
      // Mostrar loading
      this.showLoading();
      this.updateProgress(10, 'Validando arquivo...');
      
      // Determinar qualidade de análise baseada no tamanho do arquivo
      let quality = 'balanced';
      if (this.config.autoDetectQuality) {
        if (file.size < 5 * 1024 * 1024) quality = 'accurate'; // < 5MB
        else if (file.size > 15 * 1024 * 1024) quality = 'fast'; // > 15MB
      }
      
      this.updateProgress(20, 'Iniciando análise...');
      
      // Configurar análise
      const analysisConfig = {
        ...this.config,
        quality,
        features: this.determineFeatures(file)
      };
      
      console.log('🔬 Configuração da análise:', analysisConfig);
      this.updateProgress(30, 'Decodificando áudio...');
      
      // Analisar arquivo
      const analysis = await this.analyzer.analyzeFile(file, analysisConfig);
      
      this.updateProgress(90, 'Gerando relatório...');
      
      // Aguardar um pouco para UX
      await this.delay(500);
      
      this.currentAnalysis = analysis;
      this.updateProgress(100, 'Análise concluída!');
      
      // Mostrar resultados após delay
      setTimeout(() => {
        this.displayResults(analysis);
      }, 800);
      
      // Analytics
      this.trackEvent('analysis_completed', {
        version: '2.0',
        fileSize: file.size,
        duration: analysis.metadata?.duration,
        score: analysis.metrics?.quality?.overall,
        processingTime: analysis.processingTime
      });
      
    } catch (error) {
      console.error('❌ Erro na análise:', error);
      this.showError(error.message);
      
      this.trackEvent('analysis_error', {
        version: '2.0',
        error: error.message
      });
    }
  }

  // 📊 Mostrar resultados no modal
  displayResults(analysis) {
    console.log('📊 Exibindo resultados V2:', analysis);
    
    // Ocultar loading, mostrar results
    const uploadArea = document.getElementById('uploadAreaV2');
    const loadingArea = document.getElementById('loadingAreaV2');
    const resultsArea = document.getElementById('resultsAreaV2');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (loadingArea) loadingArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'block';
    
    // Atualizar summary
    this.updateSummary(analysis);
    
    // Gerar cards de métricas
    this.renderMetricsCards(analysis);
  }

  // 📈 Atualizar summary
  updateSummary(analysis) {
    const overallScore = document.getElementById('overallScoreV2');
    const processingTime = document.getElementById('processingTimeV2');
    
    if (overallScore) {
      const score = analysis.metrics?.quality?.overall || 0;
      overallScore.textContent = score;
      overallScore.className = `score-value-v2 ${this.getScoreClass(score)}`;
    }
    
    if (processingTime) {
      processingTime.textContent = analysis.processingTime || '--';
    }
  }

  // 🎯 Renderizar cards de métricas
  renderMetricsCards(analysis) {
    const grid = document.getElementById('metricsGridV2');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const { core, stereo, quality } = analysis.metrics;
    
    // Card 1: Core Metrics
    const coreCard = this.createMetricCard('📊 Métricas Principais', [
      { label: 'Peak', value: `${core.peak.toFixed(1)} dB`, class: this.getPeakClass(core.peak) },
      { label: 'RMS', value: `${core.rms.toFixed(1)} dB`, class: this.getRMSClass(core.rms) },
      { label: 'Dinâmica', value: `${core.dynamicRange.toFixed(1)} dB`, class: this.getDynamicClass(core.dynamicRange) },
      { label: 'Crest Factor', value: core.crestFactor.toFixed(1), class: 'value-good-v2' }
    ]);
    grid.appendChild(coreCard);
    
    // Card 2: Spectral Analysis
    if (core.spectralCentroid) {
      const spectralCard = this.createMetricCard('🌈 Análise Espectral', [
        { label: 'Centroide', value: `${Math.round(core.spectralCentroid)} Hz`, class: 'value-good-v2' },
        { label: 'Rolloff', value: core.spectralRolloff ? `${Math.round(core.spectralRolloff)} Hz` : 'N/A', class: 'value-good-v2' },
        { label: 'Flux', value: core.spectralFlux ? core.spectralFlux.toFixed(3) : 'N/A', class: 'value-good-v2' },
        { label: 'Flatness', value: core.spectralFlatness ? core.spectralFlatness.toFixed(3) : 'N/A', class: 'value-good-v2' }
      ]);
      grid.appendChild(spectralCard);
    }
    
    // Card 3: Stereo Analysis
    if (stereo) {
      const stereoCard = this.createMetricCard('🔊 Análise Estéreo', [
        { label: 'Correlação', value: stereo.correlation.toFixed(2), class: this.getCorrelationClass(stereo.correlation) },
        { label: 'Largura', value: stereo.width.toFixed(2), class: 'value-good-v2' },
        { label: 'Balance', value: `${(stereo.balance * 100).toFixed(0)}%`, class: this.getBalanceClass(stereo.balance) },
        { label: 'Mono Compat.', value: stereo.monoCompatibility, class: this.getMonoCompatClass(stereo.monoCompatibility) }
      ]);
      grid.appendChild(stereoCard);
    }
    
    // Card 4: Quality Scores
    if (quality) {
      const qualityCard = this.createMetricCard('🏆 Scores de Qualidade', [
        { label: 'Dinâmica', value: `${quality.breakdown.dynamics}/100`, class: this.getScoreClass(quality.breakdown.dynamics) },
        { label: 'Técnico', value: `${quality.breakdown.technical}/100`, class: this.getScoreClass(quality.breakdown.technical) },
        { label: 'Loudness', value: `${quality.breakdown.loudness}/100`, class: this.getScoreClass(quality.breakdown.loudness) },
        { label: 'Frequência', value: `${quality.breakdown.frequency}/100`, class: this.getScoreClass(quality.breakdown.frequency) }
      ]);
      grid.appendChild(qualityCard);
    }
    
    // Card 5: Dominant Frequencies
    if (core.dominantFrequencies?.length > 0) {
      const freqCard = this.createFrequencyCard(core.dominantFrequencies);
      grid.appendChild(freqCard);
    }
    
    // Card 6: Technical Issues
    if (core.clippingEvents > 0 || Math.abs(core.dcOffset) > 0.01) {
      const techCard = this.createMetricCard('⚠️ Problemas Técnicos', [
        { label: 'Clipping', value: `${core.clippingEvents} samples`, class: core.clippingEvents > 0 ? 'value-error-v2' : 'value-excellent-v2' },
        { label: 'DC Offset', value: core.dcOffset.toFixed(4), class: Math.abs(core.dcOffset) > 0.01 ? 'value-warning-v2' : 'value-excellent-v2' }
      ]);
      grid.appendChild(techCard);
    }
    
    // Card 7: Diagnostics
    if (analysis.diagnostics?.problems?.length > 0 || analysis.diagnostics?.suggestions?.length > 0) {
      const diagnosticsCard = this.createDiagnosticsCard(analysis.diagnostics);
      grid.appendChild(diagnosticsCard);
    }
  }

  // 🏗️ Criar card de métrica genérico
  createMetricCard(title, rows) {
    const card = document.createElement('div');
    card.className = 'metric-card-v2';
    
    let rowsHTML = '';
    rows.forEach(row => {
      rowsHTML += `
        <div class="data-row-v2">
          <span class="data-label-v2">${row.label}</span>
          <span class="data-value-v2 ${row.class || ''}">${row.value}</span>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="card-title-v2">
        <span class="card-icon-v2">${title.split(' ')[0]}</span>
        ${title.substring(2)}
      </div>
      ${rowsHTML}
    `;
    
    return card;
  }

  // 🎵 Criar card de frequências dominantes
  createFrequencyCard(frequencies) {
    const card = document.createElement('div');
    card.className = 'metric-card-v2';
    
    let freqHTML = '';
    frequencies.slice(0, 6).forEach(freq => {
      freqHTML += `
        <div class="frequency-item-v2">
          <span class="frequency-hz-v2">${Math.round(freq.frequency)} Hz</span>
          <span class="frequency-count-v2">${freq.occurrences}x</span>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="card-title-v2">
        <span class="card-icon-v2">🎯</span>
        Frequências Dominantes
      </div>
      <div class="frequency-list-v2">
        ${freqHTML}
      </div>
    `;
    
    return card;
  }

  // 🏥 Criar card de diagnósticos
  createDiagnosticsCard(diagnostics) {
    const card = document.createElement('div');
    card.className = 'metric-card-v2';
    
    let content = '';
    
    // Problemas
    if (diagnostics.problems?.length > 0) {
      content += '<div style="margin-bottom: 16px;"><strong style="color: var(--accent-orange);">Problemas:</strong></div>';
      diagnostics.problems.slice(0, 3).forEach(problem => {
        content += `
          <div class="problem-item-v2 problem-${problem.severity}-v2">
            <div class="problem-message-v2">${problem.message}</div>
            <div class="problem-solution-v2">${problem.solution}</div>
          </div>
        `;
      });
    }
    
    // Sugestões
    if (diagnostics.suggestions?.length > 0) {
      if (content) content += '<div style="margin: 16px 0;"></div>';
      content += '<div style="margin-bottom: 16px;"><strong style="color: var(--accent-green);">Sugestões:</strong></div>';
      diagnostics.suggestions.slice(0, 3).forEach(suggestion => {
        content += `
          <div class="suggestion-item-v2">
            <div class="suggestion-message-v2">${suggestion.message}</div>
            <div class="suggestion-action-v2">${suggestion.action}</div>
          </div>
        `;
      });
    }
    
    // Feedback
    if (diagnostics.feedback?.length > 0) {
      if (content) content += '<div style="margin: 16px 0;"></div>';
      diagnostics.feedback.forEach(feedback => {
        content += `<div class="feedback-item-v2">${feedback}</div>`;
      });
    }
    
    card.innerHTML = `
      <div class="card-title-v2">
        <span class="card-icon-v2">🏥</span>
        Diagnóstico & Sugestões
      </div>
      ${content}
    `;
    
    return card;
  }

  // 🤖 Enviar análise para chat
  async sendAnalysisToChat() {
    if (!this.currentAnalysis) {
      alert('Nenhuma análise disponível');
      return;
    }
    
    console.log('🤖 Enviando análise V2 para chat...');
    
    try {
      const prompt = this.analyzer.generateAIPrompt(this.currentAnalysis);
      const message = `🎵 Análise V2 completa! Preciso de ajuda para melhorar:\n\n${prompt}`;
      
      // Tentar integração com chat
      let success = false;
      
      // Método 1: ProdAI Chatbot direto
      if (window.prodAIChatbot) {
        try {
          if (!window.prodAIChatbot.isActive) {
            await window.prodAIChatbot.activateChat(message);
          } else {
            const input = document.getElementById('chatbotActiveInput');
            if (input) {
              input.value = message;
              input.focus();
              await window.prodAIChatbot.sendMessage();
            }
          }
          success = true;
        } catch (err) {
          console.warn('Método 1 falhou:', err);
        }
      }
      
      // Método 2: Input direto + simulação
      if (!success) {
        const input = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
        const sendBtn = document.getElementById('chatbotActiveSendBtn') || document.getElementById('chatbotSendButton');
        
        if (input && sendBtn) {
          input.value = message;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          setTimeout(() => sendBtn.click(), 500);
          success = true;
        }
      }
      
      if (success) {
        this.showNotification('🎵 Análise enviada para o chat!', 'success');
        this.closeModalV2();
      } else {
        // Fallback: copiar para clipboard
        await navigator.clipboard.writeText(message);
        this.showNotification('📋 Análise copiada! Cole no chat manualmente.', 'info');
      }
      
      this.trackEvent('analysis_sent_to_chat', { version: '2.0' });
      
    } catch (error) {
      console.error('❌ Erro ao enviar para chat:', error);
      this.showNotification('❌ Erro ao enviar análise. Tente novamente.', 'error');
    }
  }

  // 📄 Baixar relatório
  downloadReport() {
    if (!this.currentAnalysis) {
      alert('Nenhuma análise disponível');
      return;
    }
    
    console.log('📄 Baixando relatório V2...');
    
    try {
      const report = this.generateDetailedReport(this.currentAnalysis);
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_analysis_v2_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('📄 Relatório baixado!', 'success');
      this.trackEvent('report_downloaded', { version: '2.0' });
      
    } catch (error) {
      console.error('❌ Erro ao baixar relatório:', error);
      this.showNotification('❌ Erro ao gerar relatório', 'error');
    }
  }

  // 📋 Gerar relatório detalhado
  generateDetailedReport(analysis) {
    const now = new Date();
    let report = `🎵 PROD.AI - RELATÓRIO DE ANÁLISE DE ÁUDIO V2\n`;
    report += `${'='.repeat(60)}\n\n`;
    report += `📅 Data: ${now.toLocaleString('pt-BR')}\n`;
    report += `🔬 Versão: ${analysis.version}\n`;
    report += `⏱️ Tempo de processamento: ${analysis.processingTime}ms\n\n`;
    
    // Metadados
    report += `📊 METADADOS:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `Duração: ${analysis.metadata.duration.toFixed(2)}s\n`;
    report += `Sample Rate: ${analysis.metadata.sampleRate}Hz\n`;
    report += `Canais: ${analysis.metadata.channels}\n\n`;
    
    // Core metrics
    const core = analysis.metrics.core;
    report += `🎯 MÉTRICAS PRINCIPAIS:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `Peak: ${core.peak.toFixed(2)}dB\n`;
    report += `RMS: ${core.rms.toFixed(2)}dB\n`;
    report += `Dynamic Range: ${core.dynamicRange.toFixed(2)}dB\n`;
    report += `Crest Factor: ${core.crestFactor.toFixed(2)}\n`;
    report += `DC Offset: ${core.dcOffset.toFixed(6)}\n`;
    report += `Clipping Events: ${core.clippingEvents}\n`;
    
    if (core.spectralCentroid) {
      report += `Spectral Centroid: ${Math.round(core.spectralCentroid)}Hz\n`;
    }
    
    // Stereo analysis
    if (analysis.metrics.stereo) {
      const stereo = analysis.metrics.stereo;
      report += `\n🔊 ANÁLISE ESTÉREO:\n`;
      report += `${'-'.repeat(30)}\n`;
      report += `Correlação: ${stereo.correlation.toFixed(3)}\n`;
      report += `Largura: ${stereo.width.toFixed(3)}\n`;
      report += `Balance: ${(stereo.balance * 100).toFixed(1)}%\n`;
      report += `Compatibilidade Mono: ${stereo.monoCompatibility}\n`;
    }
    
    // Quality scores
    if (analysis.metrics.quality) {
      const quality = analysis.metrics.quality;
      report += `\n🏆 SCORES DE QUALIDADE:\n`;
      report += `${'-'.repeat(30)}\n`;
      report += `Geral: ${quality.overall}/100\n`;
      report += `Dinâmica: ${quality.breakdown.dynamics}/100\n`;
      report += `Técnico: ${quality.breakdown.technical}/100\n`;
      report += `Loudness: ${quality.breakdown.loudness}/100\n`;
      report += `Frequência: ${quality.breakdown.frequency}/100\n`;
      if (quality.breakdown.stereo) {
        report += `Estéreo: ${quality.breakdown.stereo}/100\n`;
      }
    }
    
    // Diagnostics
    if (analysis.diagnostics) {
      const diag = analysis.diagnostics;
      
      if (diag.problems?.length > 0) {
        report += `\n🚨 PROBLEMAS DETECTADOS:\n`;
        report += `${'-'.repeat(30)}\n`;
        diag.problems.forEach((problem, i) => {
          report += `${i + 1}. [${problem.severity.toUpperCase()}] ${problem.message}\n`;
          report += `   Solução: ${problem.solution}\n\n`;
        });
      }
      
      if (diag.suggestions?.length > 0) {
        report += `💡 SUGESTÕES:\n`;
        report += `${'-'.repeat(30)}\n`;
        diag.suggestions.forEach((suggestion, i) => {
          report += `${i + 1}. ${suggestion.message}\n`;
          report += `   Ação: ${suggestion.action}\n\n`;
        });
      }
    }
    
    report += `📝 OBSERVAÇÕES TÉCNICAS V2:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `• Análise realizada com Web Audio API + Meyda\n`;
    report += `• Métricas espectrais calculadas com FFT profissional\n`;
    report += `• Scores baseados em padrões da indústria\n`;
    report += `• Para LUFS real, use ferramentas profissionais\n\n`;
    
    report += `🎵 Gerado por PROD.AI - Audio Analyzer V2\n`;
    report += `📱 Para mais análises: prod-ai-teste.vercel.app\n`;
    
    return report;
  }

  // 🛠️ FUNÇÕES UTILITÁRIAS

  showLoading() {
    const uploadArea = document.getElementById('uploadAreaV2');
    const loadingArea = document.getElementById('loadingAreaV2');
    const resultsArea = document.getElementById('resultsAreaV2');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'none';
    if (loadingArea) loadingArea.style.display = 'block';
  }

  updateProgress(percentage, message) {
    const progressFill = document.getElementById('progressFillV2');
    const loadingText = document.getElementById('loadingTextV2');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (loadingText) loadingText.textContent = message;
  }

  showError(message) {
    const uploadArea = document.getElementById('uploadAreaV2');
    const loadingArea = document.getElementById('loadingAreaV2');
    const resultsArea = document.getElementById('resultsAreaV2');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (loadingArea) loadingArea.style.display = 'none';
    if (resultsArea) {
      resultsArea.style.display = 'block';
      resultsArea.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #ff6b6b;">
          <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
          <h3 style="color: #ff6b6b; margin-bottom: 16px;">Erro na Análise</h3>
          <p style="color: #aaa; margin-bottom: 24px;">${message}</p>
          <button onclick="window.audioAnalyzerV2Integration?.resetModalState()" 
                  style="background: #ff6b6b; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">
            Tentar Novamente
          </button>
        </div>
      `;
    }
  }

  showNotification(message, type = 'info') {
    const colors = {
      success: '#00ff88',
      error: '#ff6b6b',
      warning: '#ff9500',
      info: '#00d4ff'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      background: rgba(26, 26, 26, 0.95);
      backdrop-filter: blur(10px);
      color: ${colors[type]};
      padding: 16px 24px;
      border-radius: 12px;
      border: 1px solid ${colors[type]}40;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      z-index: 10001;
      font-weight: 500;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isModalOpen() {
    const modal = document.getElementById('audioAnalysisModalV2');
    return modal && modal.style.display !== 'none';
  }

  // Determinação inteligente de features
  determineFeatures(file) {
    const features = ['core'];
    
    // Sempre incluir espectral para arquivos de áudio
    features.push('spectral');
    
    // Incluir estéreo se provável que seja stereo
    if (!file.name.toLowerCase().includes('mono')) {
      features.push('stereo');
    }
    
    // Sempre incluir quality
    features.push('quality');
    
    return features;
  }

  // Classes CSS baseadas em valores
  getScoreClass(score) {
    if (score >= 90) return 'value-excellent-v2';
    if (score >= 75) return 'value-good-v2';
    if (score >= 60) return 'value-warning-v2';
    return 'value-error-v2';
  }

  getPeakClass(peak) {
    if (peak > -1) return 'value-error-v2';
    if (peak > -3) return 'value-warning-v2';
    if (peak > -6) return 'value-good-v2';
    return 'value-excellent-v2';
  }

  getRMSClass(rms) {
    if (rms >= -16 && rms <= -12) return 'value-excellent-v2';
    if (rms >= -20 && rms <= -10) return 'value-good-v2';
    if (rms < -30) return 'value-error-v2';
    return 'value-warning-v2';
  }

  getDynamicClass(dr) {
    if (dr >= 12) return 'value-excellent-v2';
    if (dr >= 8) return 'value-good-v2';
    if (dr >= 4) return 'value-warning-v2';
    return 'value-error-v2';
  }

  getCorrelationClass(corr) {
    if (corr >= 0.9) return 'value-excellent-v2';
    if (corr >= 0.7) return 'value-good-v2';
    if (corr >= 0.5) return 'value-warning-v2';
    return 'value-error-v2';
  }

  getBalanceClass(balance) {
    const abs = Math.abs(balance);
    if (abs <= 0.1) return 'value-excellent-v2';
    if (abs <= 0.2) return 'value-good-v2';
    if (abs <= 0.3) return 'value-warning-v2';
    return 'value-error-v2';
  }

  getMonoCompatClass(compat) {
    const classes = {
      excellent: 'value-excellent-v2',
      good: 'value-good-v2',
      fair: 'value-warning-v2',
      poor: 'value-error-v2'
    };
    return classes[compat] || 'value-good-v2';
  }

  // Analytics tracking
  trackEvent(event, data = {}) {
    console.log(`📊 Analytics: ${event}`, data);
    // Implementar tracking real se necessário
  }
}

// 🌟 Inicialização global
let audioAnalyzerV2Integration = null;

// Função para inicializar quando tudo estiver disponível
function initializeV2Integration() {
  if (typeof window.AudioAnalyzerV2 === 'undefined') {
    console.warn('🎵 AudioAnalyzerV2 não disponível ainda, tentando novamente...');
    setTimeout(initializeV2Integration, 100);
    return;
  }
  
  console.log('🎵 Inicializando Audio Analyzer V2 Integration...');
  
  try {
    audioAnalyzerV2Integration = new AudioAnalyzerIntegrationV2();
    audioAnalyzerV2Integration.initialize();
    
    // Tornar disponível globalmente
    window.audioAnalyzerV2Integration = audioAnalyzerV2Integration;
    
    console.log('✅ Audio Analyzer V2 Integration pronto!');
  } catch (error) {
    console.error('❌ Erro na inicialização V2:', error);
  }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeV2Integration);

// Fallback se DOM já carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeV2Integration();
}

console.log('🎵 Audio Analyzer V2 Integration Module carregado!');
