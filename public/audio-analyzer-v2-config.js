// 🎵 AUDIO ANALYZER V2 FEATURE FLAGS
// Configuração de funcionalidades e flags para o sistema V2

const AudioAnalyzerV2Config = {
  // 🎛️ Feature Flags
  features: {
    enableV2: true,                 // Ativar sistema V2
    useV2AsDefault: true,          // Usar V2 como padrão (fallback para V1)
    showVersionBadge: true,        // Mostrar badge "v2.0" na UI
    enableAdvancedMetrics: true,   // LUFS, key detection, BPM
    enableDiagnostics: true,       // Sistema de diagnósticos
    enableReporting: true,         // Relatórios detalhados
    enableAnalytics: true,         // Tracking de eventos
    enableExperimentalFeatures: false // Features experimentais
  },

  // 🎨 UI Configuration
  ui: {
    theme: 'glassmorphism',        // glassmorphism | minimal | dark
    primaryColor: '#00d4ff',       // Cor principal
    secondaryColor: '#b066ff',     // Cor secundária
    accentColor: '#00ff88',        // Cor de destaque
    warningColor: '#ff9500',       // Cor de aviso
    errorColor: '#ff6b6b',         // Cor de erro
    animationSpeed: 'normal',      // fast | normal | slow
    showProgressBar: true,         // Mostrar barra de progresso
    showLoadingAnimations: true,   // Animações de loading
    enableGlassmorphism: true      // Efeitos de vidro
  },

  // ⚡ Performance Settings
  performance: {
    autoDetectQuality: true,       // Detectar qualidade baseada no arquivo
    maxFileSize: 25 * 1024 * 1024, // 25MB
    enableWorkers: false,          // Web Workers (futuro)
    cacheResults: true,            // Cache de resultados
    batchProcessing: false,        // Processamento em lote (futuro)
    fftSize: 4096,                // Tamanho da FFT
    hopSize: 1024,                // Hop size para análise
    windowFunction: 'hanning'      // Função de janela
  },

  // 🔬 Analysis Settings
  analysis: {
    defaultQuality: 'balanced',    // fast | balanced | accurate
    enabledFeatures: [             // Features ativas por padrão
      'core',
      'spectral', 
      'stereo',
      'quality'
    ],
    qualityThresholds: {
      excellent: 90,
      good: 75,
      fair: 60,
      poor: 0
    },
    spectralFeatures: [            // Features espectrais ativas
      'centroid',
      'rolloff',
      'flux',
      'flatness',
      'kurtosis',
      'skewness'
    ],
    enableRealTimeAnalysis: false, // Análise em tempo real (futuro)
    sampleInterval: 0.1           // Intervalo de amostragem (segundos)
  },

  // 📊 Metrics Configuration
  metrics: {
    enableCoreMetrics: true,       // Peak, RMS, Dynamic Range
    enableSpectralAnalysis: true,  // Análise espectral
    enableStereoAnalysis: true,    // Análise estéreo
    enableQualityScoring: true,    // Scores de qualidade
    enableFrequencyAnalysis: true, // Análise de frequências dominantes
    enableLoudnessAnalysis: false, // LUFS real (requer backend)
    enableTempoAnalysis: false,    // BPM detection (implementar)
    enableKeyDetection: false,     // Key detection (implementar)
    enableMoodAnalysis: false      // Mood analysis (futuro)
  },

  // 🏥 Diagnostics Settings
  diagnostics: {
    enableProblemDetection: true,  // Detecção de problemas
    enableSuggestions: true,       // Sugestões automáticas
    enableFeedback: true,          // Feedback contextual
    severityLevels: ['low', 'medium', 'high', 'critical'],
    maxProblemsShown: 5,          // Máximo de problemas exibidos
    maxSuggestionsShown: 3        // Máximo de sugestões exibidas
  },

  // 🔗 Integration Settings
  integration: {
    enableChatIntegration: true,   // Integração com chat
    enableV1Fallback: true,        // Fallback para V1 se V2 falhar
    autoSendToChat: false,         // Enviar automaticamente para chat
    enableKeyboardShortcuts: true, // Atalhos de teclado
    enableDragAndDrop: true,       // Drag & drop de arquivos
    enableClipboardPaste: false,   // Colar do clipboard (futuro)
    chatPromptTemplate: 'v2'       // Template do prompt para IA
  },

  // 📁 File Handling
  files: {
    supportedFormats: [
      'audio/mpeg',      // MP3
      'audio/wav',       // WAV
      'audio/x-m4a',     // M4A
      'audio/flac',      // FLAC
      'audio/ogg',       // OGG
      'audio/aac'        // AAC
    ],
    maxFiles: 1,                  // Máximo de arquivos simultâneos
    enableBatchAnalysis: false,   // Análise em lote (futuro)
    autoDetectFormat: true,       // Detectar formato automaticamente
    validateBeforeAnalysis: true  // Validar arquivo antes da análise
  },

  // 📈 Analytics & Tracking
  analytics: {
    trackUsage: true,             // Rastrear uso
    trackPerformance: true,       // Rastrear performance
    trackErrors: true,           // Rastrear erros
    trackUserFlow: true,         // Rastrear fluxo do usuário
    anonymizeData: true,         // Anonimizar dados
    batchEvents: true,           // Agrupar eventos
    sendInterval: 30000          // Intervalo de envio (ms)
  },

  // 🛠️ Development Settings
  development: {
    enableDebugMode: false,       // Modo debug
    showPerformanceMetrics: false, // Mostrar métricas de performance
    enableConsoleLogging: true,   // Logs no console
    logLevel: 'info',            // error | warn | info | debug
    enableDevTools: false,       // Ferramentas de desenvolvimento
    mockAnalysisDelay: 0         // Delay simulado (ms)
  },

  // 🔄 Version Control
  version: {
    current: '2.0.0',
    build: Date.now(),
    compatibility: {
      minV1Version: '1.0.0',
      apiVersion: '2.0'
    }
  }
};

// 🌐 Detecção automática de ambiente
(function detectEnvironment() {
  // Produção vs Desenvolvimento
  const isProduction = window.location.hostname !== 'localhost';
  
  if (!isProduction) {
    // Configurações de desenvolvimento
    AudioAnalyzerV2Config.development.enableDebugMode = true;
    AudioAnalyzerV2Config.development.showPerformanceMetrics = true;
    AudioAnalyzerV2Config.development.logLevel = 'debug';
    AudioAnalyzerV2Config.analytics.trackUsage = false;
  }

  // Detectar capacidades do dispositivo
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency <= 2;

  if (isMobile || isLowEndDevice) {
    // Otimizações para dispositivos móveis/menos potentes
    AudioAnalyzerV2Config.analysis.defaultQuality = 'fast';
    AudioAnalyzerV2Config.performance.fftSize = 2048;
    AudioAnalyzerV2Config.ui.animationSpeed = 'fast';
    AudioAnalyzerV2Config.ui.showLoadingAnimations = false;
    AudioAnalyzerV2Config.performance.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  // Detectar suporte a Web Audio API
  if (!window.AudioContext && !window.webkitAudioContext) {
    console.warn('🎵 Web Audio API não suportada, desabilitando V2');
    AudioAnalyzerV2Config.features.enableV2 = false;
    AudioAnalyzerV2Config.features.useV2AsDefault = false;
  }

  // Detectar suporte a Workers
  if (typeof Worker !== 'undefined') {
    AudioAnalyzerV2Config.performance.enableWorkers = true;
  }
})();

// 🎯 Função para obter configuração
function getAudioAnalyzerV2Config() {
  return AudioAnalyzerV2Config;
}

// 🔧 Função para atualizar configuração
function updateAudioAnalyzerV2Config(updates) {
  if (typeof updates === 'object' && updates !== null) {
    Object.assign(AudioAnalyzerV2Config, updates);
    console.log('🎵 Configuração V2 atualizada:', updates);
  }
}

// 🚀 Exportar para uso global
if (typeof window !== 'undefined') {
  window.AudioAnalyzerV2Config = AudioAnalyzerV2Config;
  window.getAudioAnalyzerV2Config = getAudioAnalyzerV2Config;
  window.updateAudioAnalyzerV2Config = updateAudioAnalyzerV2Config;
}

// 📦 Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AudioAnalyzerV2Config,
    getAudioAnalyzerV2Config,
    updateAudioAnalyzerV2Config
  };
}

console.log('🎵 Audio Analyzer V2 Config carregado!', `v${AudioAnalyzerV2Config.version.current}`);
