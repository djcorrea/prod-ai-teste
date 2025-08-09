/**
 * 🎵 AUDIO ANALYZER V2 - INTEGRATION - FASE 2
 * Sistema de integração focado nas 12 métricas core
 * Sem recursos avançados - apenas FASE 2
 */

class AudioAnalyzerV2Integration {
    constructor() {
        this.analyzer = null;
        this.modal = null;
        this.fileInput = null;
        this.isAnalyzing = false;
        
        this.config = {
            version: '2.0.0',
            modalId: 'audioAnalyzerModal',
            enabledFeatures: [
                'fileUpload',
                'coreMetricsDisplay',
                'basicVisualization',
                'recommendations'
            ]
        };
        
        console.log(`🎵 Audio Analyzer V2 ${this.config.version} inicializado`);
    }
    
    async initialize() {
        try {
            console.log('🎵 Inicializando integração...');
            
            // Inicializar analisador
            if (typeof AudioAnalyzerV2 === 'undefined') {
                throw new Error('AudioAnalyzerV2 não encontrado - carregue o arquivo principal primeiro');
            }
            
            this.analyzer = new AudioAnalyzerV2();
            await this.analyzer.initialize();
            
            // Configurar interface
            this.setupModal();
            this.setupEventListeners();
            
            console.log('✅ Integração inicializada');
            return true;
            
        } catch (error) {
            console.error('❌ Erro na inicialização da integração:', error);
            throw error;
        }
    }
    
    setupModal() {
        // Criar modal se não existir
        let modal = document.getElementById(this.config.modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = this.config.modalId;
            modal.className = 'audio-analyzer-modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = this.createModalHTML();
        this.modal = modal;
        
        // Configurar eventos do modal
        this.setupModalEvents();
    }
    
    createModalHTML() {
        return `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🎵 Analisador de Áudio</h2>
                        <button class="close-button" onclick="window.audioAnalyzerV2Integration.closeModal()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Estado 1: Upload de arquivo -->
                        <div class="upload-section" id="uploadSection">
                            <div class="upload-icon-main">🎵</div>
                            <h3>Selecione um arquivo de áudio</h3>
                            <div class="file-upload-area" id="fileUploadArea">
                                <input type="file" id="audioFileInput" accept="audio/*" style="display: none;">
                                <div class="upload-content">
                                    <div class="upload-icon">📁</div>
                                    <p>Clique ou arraste um arquivo de áudio</p>
                                    <p class="upload-formats">MP3, WAV, M4A, FLAC</p>
                                </div>
                            </div>
                            <button id="selectFileButton" class="primary-button">Escolher Arquivo</button>
                        </div>
                        
                        <!-- Estado 2: Processamento -->
                        <div class="processing-section" id="processingSection" style="display: none;">
                            <div class="processing-animation">
                                <div class="audio-wave">
                                    <div class="wave-bar"></div>
                                    <div class="wave-bar"></div>
                                    <div class="wave-bar"></div>
                                    <div class="wave-bar"></div>
                                    <div class="wave-bar"></div>
                                </div>
                            </div>
                            <h3 id="processingTitle">Carregando arquivo...</h3>
                            <p id="processingStatus">Preparando análise...</p>
                            <div class="progress-bar">
                                <div class="progress-fill" id="progressFill"></div>
                            </div>
                        </div>
                        
                        <!-- Estado 3: Resultados -->
                        <div class="results-section" id="resultsSection" style="display: none;">
                            
                            <!-- Score Geral -->
                            <div class="score-section">
                                <h4>🎯 Análise Geral</h4>
                                <div class="score-display">
                                    <div class="score-circle">
                                        <span id="overallScore">0</span>%
                                    </div>
                                    <div class="score-interpretation" id="scoreInterpretation">
                                        Aguardando análise...
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Métricas Core -->
                            <div class="metrics-section">
                                <h4>� Características do Áudio</h4>
                                <div class="metrics-grid" id="metricsGrid">
                                    <!-- Métricas serão inseridas aqui -->
                                </div>
                            </div>
                            
                            <!-- Interpretação -->
                            <div class="interpretation-section">
                                <h4>🎭 Interpretação</h4>
                                <div class="interpretation-grid" id="interpretationGrid">
                                    <!-- Interpretações serão inseridas aqui -->
                                </div>
                            </div>
                            
                            <!-- Recomendações -->
                            <div class="recommendations-section">
                                <h4>💡 Recomendações</h4>
                                <div class="recommendations-list" id="recommendationsList">
                                    <!-- Recomendações serão inseridas aqui -->
                                </div>
                            </div>
                            
                            <!-- Informações técnicas -->
                            <div class="technical-info">
                                <h4>🔧 Informações Técnicas</h4>
                                <div class="tech-info-grid" id="techInfoGrid">
                                    <!-- Info técnica será inserida aqui -->
                                </div>
                            </div>
                            
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button id="analyzeButton" class="analyze-button" style="display: none;">
                            🎵 Analisar Áudio
                        </button>
                        <button id="newAnalysisButton" class="new-analysis-button" style="display: none;" onclick="window.audioAnalyzerV2Integration.resetAnalysis()">
                            🔄 Nova Análise
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupModalEvents() {
        const selectButton = document.getElementById('selectFileButton');
        const fileInput = document.getElementById('audioFileInput');
        const uploadArea = document.getElementById('fileUploadArea');
        const analyzeButton = document.getElementById('analyzeButton');
        
        // Botão selecionar arquivo
        selectButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Input de arquivo
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelected(file);
            }
        });
        
        // Drag & Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                this.handleFileSelected(file);
            }
        });
        
        // Botão analisar
        analyzeButton.addEventListener('click', () => {
            this.analyzeAudio();
        });
        
        // Clique na área de upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        this.fileInput = fileInput;
    }
    
    setupEventListeners() {
        // Escutar evento customizado para abrir modal
        window.addEventListener('openAudioAnalyzer', () => {
            this.openModal();
        });
        
        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                this.closeModal();
            }
        });
    }
    
    openModal() {
        console.log('🎵 Abrindo Audio Analyzer V2 - FASE 2');
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Alias para compatibilidade com o botão existente
    openModalV2() {
        this.openModal();
    }
    
    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Reset do estado
        this.resetAnalysisState();
    }
    
    handleFileSelected(file) {
        console.log(`📁 Arquivo selecionado: ${file.name}`);
        console.log(`📊 Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🎵 Tipo: ${file.type}`);
        
        // Mostrar botão de análise
        const analyzeButton = document.getElementById('analyzeButton');
        analyzeButton.style.display = 'block';
        analyzeButton.disabled = false;
        analyzeButton.textContent = `🎵 Analisar ${file.name}`;
        
        // Salvar arquivo para análise
        this.selectedFile = file;
    }
    
    async analyzeAudio() {
        if (!this.selectedFile || this.isAnalyzing) {
            return;
        }
        
        this.isAnalyzing = true;
        
        try {
            // Esconder seção de upload
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('analyzeButton').style.display = 'none';
            
            // Mostrar seção de processamento
            const processingSection = document.getElementById('processingSection');
            processingSection.style.display = 'block';
            
            // Simular etapas de processamento
            await this.simulateProcessing();
            
            console.log('🎵 Iniciando análise...');
            
            // Executar análise
            const results = await this.analyzer.analyzeFile(this.selectedFile);
            
            console.log('✅ Análise concluída:', results);
            
            // Esconder processamento e mostrar resultados
            processingSection.style.display = 'none';
            
            const resultsSection = document.getElementById('resultsSection');
            resultsSection.style.display = 'block';
            
            // Mostrar botão de nova análise
            document.getElementById('newAnalysisButton').style.display = 'block';
            
            // Exibir resultados
            this.displayResults(results);
            
        } catch (error) {
            console.error('❌ Erro na análise:', error);
            this.showError('Erro na análise: ' + error.message);
        } finally {
            this.isAnalyzing = false;
        }
    }
    
    async simulateProcessing() {
        const steps = [
            { text: 'Carregando arquivo...', duration: 1000 },
            { text: 'Decodificando áudio...', duration: 1500 },
            { text: 'Extraindo características...', duration: 2000 },
            { text: 'Calculando métricas...', duration: 1500 },
            { text: 'Finalizando análise...', duration: 1000 }
        ];
        
        const progressFill = document.getElementById('progressFill');
        const processingTitle = document.getElementById('processingTitle');
        const processingStatus = document.getElementById('processingStatus');
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const progress = ((i + 1) / steps.length) * 100;
            
            processingTitle.textContent = step.text;
            processingStatus.textContent = `Etapa ${i + 1} de ${steps.length}`;
            progressFill.style.width = `${progress}%`;
            
            await new Promise(resolve => setTimeout(resolve, step.duration));
        }
    }
    
    resetAnalysis() {
        // Reset do estado
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('processingSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('analyzeButton').style.display = 'none';
        document.getElementById('newAnalysisButton').style.display = 'none';
        
        // Reset da interface de upload
        const uploadContent = document.querySelector('.upload-content');
        uploadContent.innerHTML = `
            <div class="upload-icon">📁</div>
            <p>Clique ou arraste um arquivo de áudio</p>
            <p class="upload-formats">MP3, WAV, M4A, FLAC</p>
        `;
        
        // Reset da barra de progresso
        document.getElementById('progressFill').style.width = '0%';
        
        this.selectedFile = null;
        this.isAnalyzing = false;
    }
    
    updateAnalysisStatus(text, progress = 0) {
        const statusText = document.getElementById('statusText');
        statusText.textContent = text;
        
        console.log(`📊 ${text} (${progress}%)`);
    }
    
    displayResults(results) {
        console.log('📊 Exibindo resultados FASE 2');
        
        // Score geral
        this.displayOverallScore(results.overallScore, results.analysis.overall);
        
        // Métricas core
        this.displayCoreMetrics(results.coreMetrics);
        
        // Interpretação
        this.displayInterpretation(results.analysis);
        
        // Recomendações
        this.displayRecommendations(results.recommendations);
        
        // Info técnica
        this.displayTechnicalInfo(results);
    }
    
    displayOverallScore(score, interpretation) {
        const scoreElement = document.getElementById('overallScore');
        const interpretationElement = document.getElementById('scoreInterpretation');
        
        scoreElement.textContent = Math.round(score);
        
        const interpretationTexts = {
            'bright_energetic': '⚡ Brilhante e Energético',
            'harmonic_tonal': '🎵 Harmônico e Tonal',
            'noisy_textured': '🌊 Texturizado/Ruidoso',
            'quiet_subdued': '🔇 Silencioso/Suave',
            'balanced': '⚖️ Balanceado'
        };
        
        interpretationElement.textContent = interpretationTexts[interpretation] || '⚖️ Balanceado';
        
        // Cor baseada no score
        const scoreCircle = document.querySelector('.score-circle');
        if (score >= 75) {
            scoreCircle.style.background = 'linear-gradient(135deg, #4CAF50, #8BC34A)';
        } else if (score >= 50) {
            scoreCircle.style.background = 'linear-gradient(135deg, #FF9800, #FFC107)';
        } else {
            scoreCircle.style.background = 'linear-gradient(135deg, #F44336, #FF5722)';
        }
    }
    
    displayCoreMetrics(metrics) {
        const metricsGrid = document.getElementById('metricsGrid');
        
        const metricLabels = {
            spectralCentroid: { name: 'Centro Espectral', unit: '', description: 'Brilho do som' },
            spectralRolloff: { name: 'Rolloff Espectral', unit: '', description: 'Extensão de frequência' },
            spectralSpread: { name: 'Dispersão Espectral', unit: '', description: 'Largura do espectro' },
            spectralFlatness: { name: 'Planura Espectral', unit: '', description: 'Tonalidade vs Ruído' },
            rms: { name: 'RMS', unit: '', description: 'Energia do sinal' },
            loudness: { name: 'Loudness', unit: 'dB', description: 'Volume percebido' },
            mfcc: { name: 'MFCC', unit: '', description: 'Características timbrais' },
            chromaticityCoefficient: { name: 'Cromaticidade', unit: '', description: 'Conteúdo harmônico' },
            spectralSlope: { name: 'Inclinação Espectral', unit: '', description: 'Balanço grave/agudo' },
            spectralKurtosis: { name: 'Curtose Espectral', unit: '', description: 'Concentração espectral' },
            spectralSkewness: { name: 'Assimetria Espectral', unit: '', description: 'Desvio espectral' },
            harmonicRatio: { name: 'Razão Harmônica', unit: '', description: 'Conteúdo harmônico' }
        };
        
        let html = '';
        
        Object.keys(metricLabels).forEach(key => {
            if (metrics[key] !== undefined) {
                const metric = metricLabels[key];
                let value = metrics[key];
                
                // Formatação especial para diferentes tipos
                if (Array.isArray(value)) {
                    value = `[${value.length} coeficientes]`;
                } else if (typeof value === 'number') {
                    value = value.toFixed(3);
                }
                
                html += `
                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-name">${metric.name}</span>
                            <span class="metric-value">${value}${metric.unit}</span>
                        </div>
                        <div class="metric-description">${metric.description}</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${Array.isArray(metrics[key]) ? 50 : Math.min(Math.abs(metrics[key]) * 100, 100)}%"></div>
                        </div>
                    </div>
                `;
            }
        });
        
        metricsGrid.innerHTML = html;
    }
    
    displayInterpretation(analysis) {
        const interpretationGrid = document.getElementById('interpretationGrid');
        
        const interpretationLabels = {
            brightness: { icon: '💡', name: 'Brilho' },
            energy: { icon: '⚡', name: 'Energia' },
            tonality: { icon: '🎵', name: 'Tonalidade' },
            harmony: { icon: '🎼', name: 'Harmonia' },
            richness: { icon: '🌈', name: 'Riqueza' },
            balance: { icon: '⚖️', name: 'Balanço' }
        };
        
        let html = '';
        
        Object.keys(interpretationLabels).forEach(key => {
            if (analysis[key]) {
                const interp = interpretationLabels[key];
                const value = analysis[key];
                
                html += `
                    <div class="interpretation-card">
                        <div class="interp-icon">${interp.icon}</div>
                        <div class="interp-content">
                            <div class="interp-name">${interp.name}</div>
                            <div class="interp-value">${this.formatInterpretationValue(value)}</div>
                        </div>
                    </div>
                `;
            }
        });
        
        interpretationGrid.innerHTML = html;
    }
    
    formatInterpretationValue(value) {
        const valueTexts = {
            'very_bright': 'Muito Brilhante',
            'bright': 'Brilhante',
            'balanced': 'Balanceado',
            'dark': 'Escuro',
            'very_high': 'Muito Alto',
            'high': 'Alto',
            'medium': 'Médio',
            'low': 'Baixo',
            'very_low': 'Muito Baixo',
            'very_tonal': 'Muito Tonal',
            'tonal': 'Tonal',
            'mixed': 'Misto',
            'noisy': 'Ruidoso',
            'very_noisy': 'Muito Ruidoso',
            'very_harmonic': 'Muito Harmônico',
            'harmonic': 'Harmônico',
            'moderately_harmonic': 'Moderadamente Harmônico',
            'inharmonic': 'Inarmônico',
            'very_inharmonic': 'Muito Inarmônico',
            'very_rich': 'Muito Rico',
            'rich': 'Rico',
            'moderate': 'Moderado',
            'simple': 'Simples',
            'very_simple': 'Muito Simples',
            'bass_heavy': 'Graves Acentuados',
            'treble_heavy': 'Agudos Acentuados',
            'slightly_imbalanced': 'Levemente Desbalanceado'
        };
        
        return valueTexts[value] || value;
    }
    
    displayRecommendations(recommendations) {
        const recommendationsList = document.getElementById('recommendationsList');
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p class="no-recommendations">✅ Nenhuma recomendação específica - áudio está bem balanceado!</p>';
            return;
        }
        
        let html = '';
        recommendations.forEach((rec, index) => {
            html += `
                <div class="recommendation-item">
                    <div class="rec-number">${index + 1}</div>
                    <div class="rec-text">${rec}</div>
                </div>
            `;
        });
        
        recommendationsList.innerHTML = html;
    }
    
    displayTechnicalInfo(results) {
        const techInfoGrid = document.getElementById('techInfoGrid');
        
        const techInfo = [
            { label: 'Versão', value: results.version },
            { label: 'Fase', value: results.phase },
            { label: 'Arquivo', value: results.filename },
            { label: 'Duração', value: `${results.duration.toFixed(2)}s` },
            { label: 'Sample Rate', value: `${results.sampleRate} Hz` },
            { label: 'Canais', value: results.channels },
            { label: 'Análise', value: new Date(results.timestamp).toLocaleString() }
        ];
        
        let html = '';
        techInfo.forEach(info => {
            html += `
                <div class="tech-info-item">
                    <span class="tech-label">${info.label}:</span>
                    <span class="tech-value">${info.value}</span>
                </div>
            `;
        });
        
        techInfoGrid.innerHTML = html;
    }
    
    showError(message) {
        const analysisStatus = document.getElementById('analysisStatus');
        analysisStatus.innerHTML = `
            <div class="error-message">
                <div class="error-icon">❌</div>
                <p>${message}</p>
            </div>
        `;
    }
    
    resetAnalysisState() {
        const analysisSection = document.getElementById('analysisSection');
        const resultsContainer = document.getElementById('resultsContainer');
        const analyzeButton = document.getElementById('analyzeButton');
        
        analysisSection.style.display = 'none';
        resultsContainer.style.display = 'none';
        analyzeButton.disabled = true;
        analyzeButton.textContent = '🎵 Analisar Áudio';
        
        this.selectedFile = null;
        this.isAnalyzing = false;
        
        // Resetar área de upload
        const uploadContent = document.querySelector('.upload-content');
        uploadContent.innerHTML = `
            <div class="upload-icon">🎵</div>
            <p>Clique ou arraste um arquivo de áudio</p>
            <p class="upload-formats">MP3, WAV, M4A, FLAC</p>
        `;
    }
}

// Função global para abrir o analisador
window.openAudioAnalyzer = function() {
    if (window.audioAnalyzerV2Integration) {
        window.audioAnalyzerV2Integration.openModal();
    } else {
        console.error('❌ Audio Analyzer V2 Integration não inicializado');
    }
};

// Inicialização automática quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎵 Inicializando Audio Analyzer V2 Integration - FASE 2...');
        
        window.audioAnalyzerV2Integration = new AudioAnalyzerV2Integration();
        await window.audioAnalyzerV2Integration.initialize();
        
        console.log('✅ Audio Analyzer V2 Integration FASE 2 pronto!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização da integração:', error);
    }
});

console.log('✅ Audio Analyzer V2 Integration FASE 2 (Core Features) carregado');
