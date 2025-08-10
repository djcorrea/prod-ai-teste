// 🎵 AUDIO ANALYSIS CONFIGURATION - FASE 2
// Feature flags e configurações para análise de áudio avançada

export const AUDIO_CONFIG = {
  // Feature Flags - Fase 2 Core Features
  FEATURES: {
    LOUDNESS: true,        // LUFS Integrado + LRA
    TRUEPEAK: true,        // True Peak dBTP com oversampling
    CREST: true,           // Crest Factor
    DR: true,              // Dynamic Range
    CENTROID: true,        // Spectral Centroid
    ROLLOFF: true,         // Spectral Rolloff 85%
    FLUX: true,            // Spectral Flux
    BPM: true,             // BPM + confiança
    KEY: true,             // Key & scale
    STEREO: true,          // Correlação estéreo
    TONALBALANCE: true     // Tonal balance por bandas
  },

  // Configurações de processamento
  PROCESSING: {
    TARGET_SAMPLE_RATE: 48000,
    FFT_SIZE: 4096,
    HOP_SIZE: 2048,
    WINDOW_TYPE: 'hann',
    OVERSAMPLING_FACTOR: 4,
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    TIMEOUT_MS: 45000
  },

  // Bandas de frequência (Hz)
  FREQUENCY_BANDS: {
    SUB: { min: 20, max: 60 },
    LOW: { min: 60, max: 250 },
    MID: { min: 250, max: 4000 },
    HIGH: { min: 4000, max: 20000 }
  },

  // Thresholds para detectar problemas
  THRESHOLDS: {
    CLIPPING_DB: -0.1,
    DC_OFFSET_MAX: 0.01,
    TRUE_PEAK_MAX: -1.0,
    LRA_MIN: 3.0,
    LRA_MAX: 20.0,
    CORRELATION_MIN: 0.3,
    BPM_MIN: 50,
    BPM_MAX: 200
  },

  // Gates para LUFS (EBU R128)
  LUFS_GATES: {
    ABSOLUTE_GATE: -70.0,     // LUFS absoluto
    RELATIVE_GATE_OFFSET: -10.0 // Offset relativo em LU
  },

  // Janelas de medição
  MEASUREMENT_WINDOWS: {
    MOMENTARY_MS: 400,
    SHORT_TERM_MS: 3000,
    LRA_PERCENTILES: { LOW: 10, HIGH: 95 }
  }
};

// Validar configuração no ambiente serverless
export function validateEnvironment() {
  const warnings = [];
  
  // Verificar se estamos em ambiente serverless
  const isServerless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isServerless) {
    warnings.push('🔧 Ambiente serverless detectado - usando otimizações');
    
    // Reduzir timeouts e tamanhos em serverless
    AUDIO_CONFIG.PROCESSING.TIMEOUT_MS = Math.min(AUDIO_CONFIG.PROCESSING.TIMEOUT_MS, 25000);
    AUDIO_CONFIG.PROCESSING.MAX_FILE_SIZE = Math.min(AUDIO_CONFIG.PROCESSING.MAX_FILE_SIZE, 10 * 1024 * 1024);
  }

  // Verificar recursos disponíveis
  const memoryLimit = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '1024';
  const memoryMB = parseInt(memoryLimit, 10);
  
  if (memoryMB < 512) {
    warnings.push('⚠️  Memória limitada - desabilitando features avançadas');
    AUDIO_CONFIG.FEATURES.BPM = false;
    AUDIO_CONFIG.FEATURES.KEY = false;
  }

  return warnings;
}

// Feature flag checker
export function isFeatureEnabled(featureName) {
  return AUDIO_CONFIG.FEATURES[featureName] === true;
}

console.log('🎵 Audio Config (Fase 2) carregado:', {
  features: Object.keys(AUDIO_CONFIG.FEATURES).filter(f => AUDIO_CONFIG.FEATURES[f]),
  sampleRate: AUDIO_CONFIG.PROCESSING.TARGET_SAMPLE_RATE,
  maxFileSize: `${AUDIO_CONFIG.PROCESSING.MAX_FILE_SIZE / (1024 * 1024)}MB`
});
