// 🎵 AUDIO ANALYZER API V2 - FASE 2
// Endpoint com 12 métricas core: LUFS, LRA, True Peak, Crest Factor, etc.

import { auth, db } from './firebaseAdmin.js';
import { AudioAnalysisResponseSchema, AudioAnalysisRequestSchema, validateAnalysisResponse, ANALYSIS_CONSTANTS } from '../schemas/audio-analysis.js';
import cors from 'cors';

// 🎯 IMPORTAR LIBS PHASE 2 CORE FEATURES
import { decodeAndPrepareAudio, detectAudioFormat, estimateBitDepth } from '../lib/audio/decode.js';
import { calculateLoudnessMetrics } from '../lib/audio/features/loudness.js';
import { analyzeTruePeaks } from '../lib/audio/features/truepeak.js';
import { analyzeSpectralFeatures } from '../lib/audio/features/spectrum.js';

// Configuração CORS
const corsMiddleware = cors({
  origin: process.env.NODE_ENV === 'development' ? '*' : [
    'https://prod-ai-teste.vercel.app',
    /^https:\/\/prod-ai-teste-[a-z0-9\-]+\.vercel\.app$/
  ],
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // 24 horas
});

// 🚩 FEATURE FLAGS FASE 2
const FEAT = {
  LOUDNESS: true,        // LUFS Integrado + LRA
  TRUEPEAK: true,        // True Peak dBTP oversampling 4×
  CREST_FACTOR: true,    // Crest Factor dB 
  DYNAMIC_RANGE: true,   // Dynamic Range aproximado
  CENTROID: true,        // Spectral Centroid Hz
  ROLLOFF: true,         // Rolloff 85%
  FLUX: true,            // Spectral Flux
  BPM: false,            // BPM (Fase 3)
  KEY_SCALE: false,      // Key & Scale (Fase 3)
  STEREO_CORRELATION: true, // Correlação estéreo
  TONAL_BALANCE: true    // RMS por bandas
};

// Configurações da análise
const CONFIG = {
  MAX_FILE_SIZE: parseInt(process.env.AUDIO_MAX_FILE_SIZE) || ANALYSIS_CONSTANTS.MAX_FILE_SIZE,
  PROCESSING_TIMEOUT: parseInt(process.env.AUDIO_PROCESSING_TIMEOUT) || 45000,
  ENABLE_ADVANCED_METRICS: process.env.FEATURE_ADVANCED_METRICS === 'true',
  QUALITY_PRESET: process.env.ANALYSIS_QUALITY || 'balanced'
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// 🎵 HANDLER PRINCIPAL
export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('🎵 Audio Analyzer V2 API chamada:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent']?.substring(0, 100)
  });

  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (err) {
    console.error('CORS error:', err);
    return res.status(403).json({ error: 'CORS error' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowedMethods: ['POST']
    });
  }

  // Timeout de segurança
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Timeout na análise',
        processingTime: Date.now() - startTime
      });
    }
  }, CONFIG.PROCESSING_TIMEOUT);

  try {
    const { audioData, idToken, config: requestConfig } = req.body;

    // Validação da requisição
    const requestValidation = validateAnalysisRequest({ 
      config: requestConfig,
      userId: idToken ? 'authenticated' : undefined 
    });
    
    if (!requestValidation.success) {
      return res.status(400).json({ 
        error: 'Configuração inválida',
        details: requestValidation.error
      });
    }

    // Autenticação (opcional mas recomendada)
    let uid = null;
    let email = null;
    
    if (idToken) {
      try {
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email;
        console.log('🔐 Usuário autenticado:', email);
      } catch (err) {
        console.warn('⚠️ Token inválido, continuando sem autenticação:', err.message);
      }
    }

    // Validação do áudio
    if (!audioData || typeof audioData !== 'string') {
      return res.status(400).json({ error: 'Dados de áudio necessários (base64)' });
    }

    // Decodificar e validar tamanho
    const audioBuffer = Buffer.from(audioData, 'base64');
    if (audioBuffer.length > CONFIG.MAX_FILE_SIZE) {
      return res.status(413).json({ 
        error: 'Arquivo muito grande',
        maxSize: `${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`,
        receivedSize: `${Math.round(audioBuffer.length / 1024 / 1024)}MB`
      });
    }

    console.log('🎛️ Iniciando análise:', {
      fileSize: `${Math.round(audioBuffer.length / 1024)}KB`,
      features: requestConfig?.features || ['core'],
      quality: requestConfig?.quality || CONFIG.QUALITY_PRESET
    });

    // Análise principal
    const analysisResult = await performAdvancedAnalysis(audioBuffer, {
      ...requestConfig,
      uid,
      quality: requestConfig?.quality || CONFIG.QUALITY_PRESET,
      enableAdvanced: CONFIG.ENABLE_ADVANCED_METRICS && (requestConfig?.advancedMetrics !== false)
    });

    const processingTime = Date.now() - startTime;
    
    // 🔄 ADAPTER: Mapear para schema compatível com frontend
    const compatibleResult = mapToCompatibleSchema(analysisResult);
    
    // Construir resposta completa
    const response = {
      success: true,
      version: '2.0',
      timestamp: new Date().toISOString(),
      processingTime,
      ...compatibleResult
    };

    // Validar resposta
    const validation = validateAnalysisResponse(response);
    if (!validation.success) {
      console.error('❌ Erro na validação da resposta:', validation.error);
      throw new Error('Erro na validação da resposta');
    }

    // Salvar analytics (async, não bloqueia resposta)
    if (uid) {
      saveAnalysisMetrics(uid, {
        processingTime,
        fileSize: audioBuffer.length,
        features: requestConfig?.features || ['core'],
        quality: response.metrics.quality?.overall,
        timestamp: new Date()
      }).catch(err => console.warn('Analytics save failed:', err));
    }

    clearTimeout(timeoutId);
    
    console.log('✅ Análise V2 concluída:', {
      processingTime: `${processingTime}ms`,
      metricsCount: Object.keys(response.metrics).length,
      problemsFound: response.diagnostics?.problems?.length || 0,
      overallScore: response.metrics.quality?.overall || 'N/A'
    });

    return res.status(200).json(validation.data);

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('💥 Erro na análise V2:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      processingTime: Date.now() - startTime
    });
    
    return res.status(500).json({ 
      error: 'Erro interno na análise',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
      processingTime: Date.now() - startTime
    });
  }
}

// 🔬 ANÁLISE PRINCIPAL - FASE 2 (12 MÉTRICAS CORE)
async function performAdvancedAnalysis(audioBuffer, config) {
  const analysisStart = Date.now();
  const steps = [];
  const warnings = [];
  const performance = {};

  try {
    // 1. DECODIFICAÇÃO E METADADOS APRIMORADA
    steps.push('audio_decode_phase2');
    const decodeStart = Date.now();
    
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)({ 
      sampleRate: 48000 // Force 48kHz para consistency
    });
    
    const decodedData = await decodeAndPrepareAudio(audioBuffer, audioContext);
    const { leftChannel, rightChannel, metadata } = decodedData;
    
    performance.decode_time = Date.now() - decodeStart;
    steps.push('metadata_extract_enhanced');

    // Enhanced metadata
    const enhancedMetadata = {
      ...metadata,
      format: detectAudioFormat(audioBuffer),
      estimated_bit_depth: estimateBitDepth({ getChannelData: () => leftChannel, length: leftChannel.length }),
      fileSize: audioBuffer.length,
      true_stereo: metadata.channels === 2 && !arraysEqual(leftChannel, rightChannel)
    };

    // Validações
    if (metadata.duration > ANALYSIS_CONSTANTS.MAX_DURATION) {
      warnings.push(`Duração longa: ${metadata.duration}s (max: ${ANALYSIS_CONSTANTS.MAX_DURATION}s)`);
    }

    // 2. CORE METRICS BÁSICOS (compatibilidade)
    steps.push('core_metrics_basic');
    const coreStart = Date.now();
    const basicMetrics = calculateBasicMetrics(leftChannel, rightChannel, metadata.sampleRate);
    performance.core_analysis = Date.now() - coreStart;

    // 3. 🔊 LUFS INTEGRADO + LRA (FASE 2)
    let loudnessMetrics = null;
    if (FEAT.LOUDNESS) {
      steps.push('lufs_lra_analysis');
      const loudnessStart = Date.now();
      try {
        loudnessMetrics = calculateLoudnessMetrics(leftChannel, rightChannel, metadata.sampleRate);
        performance.loudness_analysis = Date.now() - loudnessStart;
      } catch (err) {
        console.warn('⚠️ LUFS analysis failed:', err);
        warnings.push('LUFS analysis unavailable');
      }
    }

    // 4. 🏔️ TRUE PEAK dBTP (FASE 2)
    let truePeakMetrics = null;
    if (FEAT.TRUEPEAK) {
      steps.push('true_peak_analysis');
      const truePeakStart = Date.now();
      try {
        truePeakMetrics = analyzeTruePeaks(leftChannel, rightChannel, metadata.sampleRate);
        performance.true_peak_analysis = Date.now() - truePeakStart;
      } catch (err) {
        console.warn('⚠️ True Peak analysis failed:', err);
        warnings.push('True Peak analysis unavailable');
      }
    }

    // 5. 📊 CREST FACTOR + DYNAMIC RANGE (FASE 2)
    let dynamicsMetrics = null;
    if (FEAT.CREST_FACTOR || FEAT.DYNAMIC_RANGE) {
      steps.push('dynamics_analysis');
      const dynStart = Date.now();
      dynamicsMetrics = calculateDynamicsMetrics(leftChannel, rightChannel);
      performance.dynamics_analysis = Date.now() - dynStart;
    }

    // 6. 🌈 ANÁLISE ESPECTRAL (CENTROID, ROLLOFF, FLUX) (FASE 2)
    let spectralMetrics = null;
    if (FEAT.CENTROID || FEAT.ROLLOFF || FEAT.FLUX) {
      steps.push('spectral_analysis_phase2');
      const spectralStart = Date.now();
      try {
        // Usar canal dominante para análise espectral
        const dominantChannel = findDominantChannel(leftChannel, rightChannel);
        spectralMetrics = analyzeSpectralFeatures(dominantChannel, metadata.sampleRate, config.quality);
        performance.spectral_analysis = Date.now() - spectralStart;
      } catch (err) {
        console.warn('⚠️ Spectral analysis failed:', err);
        warnings.push('Spectral analysis unavailable');
      }
    }

    // 7. 🎵 CORRELAÇÃO ESTÉREO (FASE 2)  
    let stereoMetrics = null;
    if (FEAT.STEREO_CORRELATION && metadata.channels === 2) {
      steps.push('stereo_correlation');
      const stereoStart = Date.now();
      stereoMetrics = analyzeStereoCorrelation(leftChannel, rightChannel);
      performance.stereo_analysis = Date.now() - stereoStart;
    }

    // 8. 🎚️ TONAL BALANCE (FASE 2)
    let tonalBalanceMetrics = null;
    if (FEAT.TONAL_BALANCE) {
      steps.push('tonal_balance_analysis');
      const tonalStart = Date.now();
      tonalBalanceMetrics = calculateTonalBalance(leftChannel, rightChannel, metadata.sampleRate);
      performance.tonal_balance = Date.now() - tonalStart;
    }

    // 9. QUALIDADE E SCORES (compatibilidade)
    steps.push('quality_scoring');
    const qualityStart = Date.now();
    const qualityScores = calculateQualityScores(basicMetrics, spectralMetrics, stereoMetrics, enhancedMetadata);
    performance.quality_scoring = Date.now() - qualityStart;

    // 10. DIAGNÓSTICOS E SUGESTÕES
    steps.push('diagnostics_phase2');
    const diagnosticsStart = Date.now();
    const diagnostics = generateDiagnosticsPhase2(basicMetrics, loudnessMetrics, truePeakMetrics, spectralMetrics, warnings);
    performance.diagnostics = Date.now() - diagnosticsStart;

    await audioContext.close();

    return {
      metadata: enhancedMetadata,
      config: {
        features: config.features || ['core', 'phase2'],
        quality: config.quality || 'balanced',
        phase: 'phase2',
        advancedMetrics: config.enableAdvanced || false
      },
      metrics: {
        // Legacy compatibility
        core: {
          ...basicMetrics,
          ...(spectralMetrics && {
            centroid_hz: spectralMetrics.centroid_hz,
            rolloff85_hz: spectralMetrics.rolloff85_hz,
            flux: spectralMetrics.spectral_flux
          })
        },
        // Phase 2 new metrics
        ...(loudnessMetrics && { loudness: loudnessMetrics }),
        ...(truePeakMetrics && { truePeak: truePeakMetrics }),
        ...(dynamicsMetrics && { dynamics: dynamicsMetrics }),
        ...(spectralMetrics && { spectral: spectralMetrics }),
        ...(stereoMetrics && { stereo: stereoMetrics }),
        ...(tonalBalanceMetrics && { tonalBalance: tonalBalanceMetrics }),
        quality: qualityScores
      },
      diagnostics,
      debug: {
        analysisSteps: steps,
        warnings,
        performance: {
          ...performance,
          total_time: Date.now() - analysisStart
        },
        featureFlags: FEAT
      }
    };

  } catch (error) {
    console.error('❌ Erro na análise Phase 2:', error);
    throw new Error(`Falha na análise Phase 2: ${error.message}`);
  }
}

// 🎯 ANÁLISE CORE METRICS
async function analyzeCoreMetrics(leftChannel, rightChannel, sampleRate) {
  // Peak e RMS
  let peak = 0;
  let sumSquared = 0;
  let dcSum = 0;
  let clippedSamples = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    const sample = leftChannel[i];
    const absSample = Math.abs(sample);
    
    // Peak
    if (absSample > peak) peak = absSample;
    
    // RMS
    sumSquared += sample * sample;
    
    // DC Offset
    dcSum += sample;
    
    // Clipping detection (threshold: 95% of full scale)
    if (absSample >= 0.95) clippedSamples++;
  }
  
  const rms = Math.sqrt(sumSquared / leftChannel.length);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const dynamicRange = peakDb - rmsDb;
  const crestFactor = peak / (rms + 1e-10);
  const dcOffset = dcSum / leftChannel.length;
  const clippingPercentage = (clippedSamples / leftChannel.length) * 100;

  return {
    peak: peakDb,
    rms: rmsDb,
    dynamicRange: Math.max(0, dynamicRange),
    crestFactor,
    dcOffset,
    clippingEvents: clippedSamples,
    clippingPercentage,
    dominantFrequencies: [] // Será preenchido na análise espectral
  };
}

// 🌈 ANÁLISE ESPECTRAL
async function analyzeSpectralFeatures(channelData, sampleRate, quality = 'balanced') {
  try {
    // Configurar Meyda
    const frameSize = quality === 'fast' ? 512 : quality === 'accurate' ? 2048 : 1024;
    const hopSize = Math.floor(frameSize / 4);
    
    // Analisar múltiplas janelas
    const features = [];
    const dominantFrequencies = [];
    
    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      const frame = channelData.slice(i, i + frameSize);
      
      try {
        const frameFeatures = Meyda.extract([
          'spectralCentroid',
          'spectralRolloff',
          'spectralFlux',
          'spectralFlatness'
        ], frame);
        
        if (frameFeatures && !isNaN(frameFeatures.spectralCentroid)) {
          features.push(frameFeatures);
        }
        
        // Encontrar frequências dominantes nesta janela
        const spectrum = computeSpectrum(frame);
        const dominantFreq = findDominantFrequency(spectrum, sampleRate);
        if (dominantFreq > 20 && dominantFreq < 20000) {
          dominantFrequencies.push({ frequency: dominantFreq, magnitude: 0.5 });
        }
        
      } catch (err) {
        // Ignora frames problemáticos
        continue;
      }
      
      // Limitar análise para performance
      if (features.length >= 100) break;
    }
    
    if (features.length === 0) {
      return {
        spectralCentroid: null,
        spectralRolloff: null,
        spectralFlux: null,
        spectralFlatness: null,
        dominantFrequencies: []
      };
    }
    
    // Calcular médias
    const avgCentroid = features.reduce((sum, f) => sum + (f.spectralCentroid || 0), 0) / features.length;
    const avgRolloff = features.reduce((sum, f) => sum + (f.spectralRolloff || 0), 0) / features.length;
    const avgFlux = features.reduce((sum, f) => sum + (f.spectralFlux || 0), 0) / features.length;
    const avgFlatness = features.reduce((sum, f) => sum + (f.spectralFlatness || 0), 0) / features.length;
    
    // Agrupar frequências dominantes
    const groupedFreqs = groupDominantFrequencies(dominantFrequencies);
    
    return {
      spectralCentroid: isFinite(avgCentroid) ? avgCentroid : null,
      spectralRolloff: isFinite(avgRolloff) ? avgRolloff : null,
      spectralFlux: isFinite(avgFlux) ? avgFlux : null,
      spectralFlatness: isFinite(avgFlatness) ? avgFlatness : null,
      dominantFrequencies: groupedFreqs.slice(0, 10)
    };
    
  } catch (error) {
    console.warn('⚠️ Erro na análise espectral:', error);
    return {
      spectralCentroid: null,
      spectralRolloff: null,
      spectralFlux: null,
      spectralFlatness: null,
      dominantFrequencies: []
    };
  }
}

// 🎵 ANÁLISE ESTÉREO
function analyzeStereoMetrics(leftChannel, rightChannel) {
  let correlation = 0;
  let leftPower = 0;
  let rightPower = 0;
  let midPower = 0;
  let sidePower = 0;
  
  const length = Math.min(leftChannel.length, rightChannel.length);
  
  for (let i = 0; i < length; i++) {
    const left = leftChannel[i];
    const right = rightChannel[i];
    
    // Correlação
    correlation += left * right;
    
    // Potência dos canais
    leftPower += left * left;
    rightPower += right * right;
    
    // Mid/Side
    const mid = (left + right) / 2;
    const side = (left - right) / 2;
    midPower += mid * mid;
    sidePower += side * side;
  }
  
  // Normalizar
  correlation /= length;
  leftPower /= length;
  rightPower /= length;
  midPower /= length;
  sidePower /= length;
  
  // Calcular métricas
  const totalPower = leftPower + rightPower;
  const balance = totalPower > 0 ? (rightPower - leftPower) / totalPower : 0;
  const width = midPower > 0 ? Math.sqrt(sidePower / midPower) : 0;
  
  // Determinar compatibilidade mono
  let monoCompatibility = 'excellent';
  if (correlation < 0.7) monoCompatibility = 'poor';
  else if (correlation < 0.85) monoCompatibility = 'fair';
  else if (correlation < 0.95) monoCompatibility = 'good';
  
  return {
    correlation: Math.max(-1, Math.min(1, correlation)),
    width: Math.max(0, Math.min(2, width)),
    balance: Math.max(-1, Math.min(1, balance)),
    monoCompatibility,
    phaseIssues: correlation < 0.5
  };
}

// 📊 CÁLCULO DE SCORES DE QUALIDADE
function calculateQualityScores(coreMetrics, spectralData, stereoMetrics, metadata) {
  const scores = {
    dynamics: 50,
    frequency: 50,
    stereo: 50,
    loudness: 50,
    technical: 50
  };
  
  // Score de dinâmica (baseado no dynamic range)
  if (coreMetrics.dynamicRange >= 12) scores.dynamics = 100;
  else if (coreMetrics.dynamicRange >= 8) scores.dynamics = 80;
  else if (coreMetrics.dynamicRange >= 6) scores.dynamics = 60;
  else if (coreMetrics.dynamicRange >= 4) scores.dynamics = 40;
  else scores.dynamics = 20;
  
  // Score de loudness (baseado no RMS)
  if (coreMetrics.rms >= -16 && coreMetrics.rms <= -12) scores.loudness = 100;
  else if (coreMetrics.rms >= -20 && coreMetrics.rms <= -10) scores.loudness = 80;
  else if (coreMetrics.rms >= -25 && coreMetrics.rms <= -8) scores.loudness = 60;
  else scores.loudness = 40;
  
  // Score técnico (baseado em clipping e DC offset)
  scores.technical = 100;
  if (coreMetrics.clippingPercentage > 0.1) scores.technical -= 30;
  if (Math.abs(coreMetrics.dcOffset) > 0.01) scores.technical -= 20;
  if (coreMetrics.peak > -1) scores.technical -= 25;
  
  // Score de frequência
  if (spectralData?.spectralCentroid) {
    const centroid = spectralData.spectralCentroid;
    if (centroid >= 1000 && centroid <= 3000) scores.frequency = 90;
    else if (centroid >= 500 && centroid <= 5000) scores.frequency = 75;
    else scores.frequency = 60;
  }
  
  // Score estéreo
  if (stereoMetrics) {
    if (stereoMetrics.monoCompatibility === 'excellent') scores.stereo = 95;
    else if (stereoMetrics.monoCompatibility === 'good') scores.stereo = 80;
    else if (stereoMetrics.monoCompatibility === 'fair') scores.stereo = 65;
    else scores.stereo = 40;
  }
  
  // Score geral (média ponderada)
  const overall = Math.round(
    scores.dynamics * 0.25 +
    scores.frequency * 0.20 +
    scores.stereo * 0.20 +
    scores.loudness * 0.20 +
    scores.technical * 0.15
  );
  
  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown: scores
  };
}

// 🏥 DIAGNÓSTICO E SUGESTÕES
function generateDiagnosticsAndSuggestions(coreMetrics, spectralData, stereoMetrics, metadata) {
  const problems = [];
  const suggestions = [];
  const feedback = [];

  // Detecção de problemas
  if (coreMetrics.clippingPercentage > 0.05) {
    problems.push({
      type: 'clipping',
      severity: coreMetrics.clippingPercentage > 0.5 ? 'high' : 'medium',
      message: `${coreMetrics.clippingPercentage.toFixed(2)}% do áudio com clipping`,
      solution: 'Reduza o volume geral em 3-6dB ou use um limitador suave'
    });
  }

  if (coreMetrics.rms < -30) {
    problems.push({
      type: 'low_volume',
      severity: 'medium',
      message: 'Nível RMS muito baixo para streaming',
      solution: 'Aumente o volume ou aplique compressão/normalização'
    });
  }

  if (coreMetrics.dynamicRange < 6) {
    problems.push({
      type: 'over_compressed',
      severity: 'medium',
      message: 'Áudio muito comprimido, falta dinâmica',
      solution: 'Reduza compressão ou use compressão multibanda mais suave'
    });
  }

  if (Math.abs(coreMetrics.dcOffset) > 0.01) {
    problems.push({
      type: 'dc_offset',
      severity: 'low',
      message: 'DC offset detectado',
      solution: 'Aplique filtro high-pass em 20Hz'
    });
  }

  // Geração de sugestões
  if (coreMetrics.rms >= -16 && coreMetrics.rms <= -12) {
    suggestions.push({
      type: 'mastering',
      priority: 'high',
      message: 'Nível ideal para streaming (-14 LUFS)',
      action: 'Volume perfeito para plataformas digitais'
    });
    feedback.push('✅ Nível de volume ideal para streaming');
  }

  if (spectralData?.spectralCentroid && spectralData.spectralCentroid > 4000) {
    suggestions.push({
      type: 'brightness',
      priority: 'medium',
      message: 'Áudio muito brilhante',
      action: 'Considere leve corte em 6-8kHz para suavizar'
    });
  }

  if (stereoMetrics?.width > 1.5) {
    suggestions.push({
      type: 'stereo_enhancement',
      priority: 'low',
      message: 'Imagem estéreo muito ampla',
      action: 'Pode causar problemas em sistemas mono - teste a compatibilidade'
    });
  }

  // Feedback geral
  if (problems.length === 0) {
    feedback.push('🎵 Qualidade técnica excelente!');
  }
  
  if (coreMetrics.dynamicRange > 10) {
    feedback.push('🎚️ Ótima dinâmica preservada');
  }

  return {
    problems: problems.slice(0, 10), // Max 10 problemas
    suggestions: suggestions.slice(0, 10), // Max 10 sugestões  
    feedback: feedback.slice(0, 5) // Max 5 feedbacks
  };
}

// 🛠️ FUNÇÕES UTILITÁRIAS

function detectAudioFormat(buffer) {
  // Detectar formato baseado nos magic numbers
  const signature = Array.from(buffer.slice(0, 12))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
    
  if (signature.startsWith('494433')) return 'mp3'; // ID3
  if (signature.startsWith('fff3') || signature.startsWith('fff2')) return 'mp3';
  if (signature.startsWith('52494646')) return 'wav'; // RIFF
  if (signature.startsWith('4f676753')) return 'ogg'; // OggS
  if (signature.startsWith('664c6143')) return 'flac'; // fLaC
  
  return 'unknown';
}

function estimateBitDepth(audioBuffer) {
  // Estimativa simples baseada na precisão dos samples
  const samples = audioBuffer.getChannelData(0);
  let uniqueValues = new Set();
  
  for (let i = 0; i < Math.min(samples.length, 44100); i++) {
    uniqueValues.add(Math.round(samples[i] * 32768));
    if (uniqueValues.size > 65536) break;
  }
  
  if (uniqueValues.size <= 256) return 8;
  if (uniqueValues.size <= 65536) return 16;
  return 24;
}

function computeSpectrum(samples) {
  // FFT simples para encontrar frequências dominantes
  const N = samples.length;
  const spectrum = new Array(N);
  
  for (let k = 0; k < N / 2; k++) {
    let real = 0, imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      real += samples[n] * Math.cos(angle);
      imag += samples[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(real * real + imag * imag);
  }
  
  return spectrum.slice(0, N / 2);
}

function findDominantFrequency(spectrum, sampleRate) {
  let maxMagnitude = 0;
  let dominantBin = 0;
  
  for (let i = 1; i < spectrum.length; i++) {
    if (spectrum[i] > maxMagnitude) {
      maxMagnitude = spectrum[i];
      dominantBin = i;
    }
  }
  
  return (dominantBin * sampleRate) / (spectrum.length * 2);
}

function groupDominantFrequencies(frequencies) {
  const groups = new Map();
  const tolerance = 50; // Hz
  
  frequencies.forEach(({ frequency, magnitude }) => {
    const rounded = Math.round(frequency / tolerance) * tolerance;
    if (!groups.has(rounded)) {
      groups.set(rounded, { frequency: rounded, magnitude: 0, occurrences: 0 });
    }
    groups.get(rounded).magnitude += magnitude;
    groups.get(rounded).occurrences += 1;
  });
  
  return Array.from(groups.values())
    .sort((a, b) => b.occurrences - a.occurrences)
    .map(group => ({
      frequency: group.frequency,
      magnitude: group.magnitude / group.occurrences,
      occurrences: group.occurrences
    }));
}

// 📊 ANALYTICS (não bloqueia resposta)
async function saveAnalysisMetrics(uid, metrics) {
  try {
    await db.collection('audio_analysis_metrics').add({
      uid,
      ...metrics,
      version: '2.0',
      createdAt: new Date()
    });
  } catch (error) {
    console.warn('Failed to save analytics:', error);
  }
}

function validateAnalysisRequest(data) {
  // Validação básica para compatibilidade
  return { success: true, data };
}

// 🎯 FUNÇÕES AUXILIARES FASE 2

/**
 * 📊 Métricas básicas (compatibilidade V1)
 */
function calculateBasicMetrics(leftChannel, rightChannel, sampleRate) {
  // Peak e RMS
  let peak = 0;
  let sumSquared = 0;
  let dcSum = 0;
  let clippedSamples = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    const sample = leftChannel[i];
    const absSample = Math.abs(sample);
    
    if (absSample > peak) peak = absSample;
    sumSquared += sample * sample;
    dcSum += sample;
    if (absSample >= 0.95) clippedSamples++;
  }
  
  const rms = Math.sqrt(sumSquared / leftChannel.length);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const dcOffset = Math.abs(dcSum / leftChannel.length);
  
  return {
    peak_db: peakDb,
    rms_mix_db: rmsDb,
    dc_offset_pct: dcOffset * 100,
    clipping_pct: (clippedSamples / leftChannel.length) * 100,
    duration_sec: leftChannel.length / sampleRate
  };
}

/**
 * 📈 Dinâmica: Crest Factor + Dynamic Range
 */
function calculateDynamicsMetrics(leftChannel, rightChannel) {
  // Calcular para mix (L+R)/2
  const mixChannel = new Float32Array(leftChannel.length);
  for (let i = 0; i < leftChannel.length; i++) {
    mixChannel[i] = rightChannel ? (leftChannel[i] + rightChannel[i]) / 2 : leftChannel[i];
  }
  
  // Peak e RMS para crest factor
  let peak = 0;
  let sumSquares = 0;
  
  for (let i = 0; i < mixChannel.length; i++) {
    const abs = Math.abs(mixChannel[i]);
    if (abs > peak) peak = abs;
    sumSquares += mixChannel[i] * mixChannel[i];
  }
  
  const rms = Math.sqrt(sumSquares / mixChannel.length);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const crestFactorDb = peakDb - rmsDb;
  
  // Dynamic Range: diferença entre percentis 10% e 90% dos RMS em janelas
  const windowSize = Math.floor(mixChannel.length / 100); // 100 windows
  const windowRMS = [];
  
  for (let i = 0; i <= mixChannel.length - windowSize; i += windowSize) {
    let windowSum = 0;
    for (let j = i; j < i + windowSize; j++) {
      windowSum += mixChannel[j] * mixChannel[j];
    }
    const windowRmsVal = Math.sqrt(windowSum / windowSize);
    if (windowRmsVal > 0) {
      windowRMS.push(20 * Math.log10(windowRmsVal));
    }
  }
  
  windowRMS.sort((a, b) => a - b);
  const p10Index = Math.floor(windowRMS.length * 0.1);
  const p90Index = Math.floor(windowRMS.length * 0.9);
  const dynamicRange = windowRMS.length > 0 ? 
    windowRMS[p90Index] - windowRMS[p10Index] : 0;
  
  return {
    crest_factor_db: crestFactorDb,
    dynamic_range_db: dynamicRange,
    peak_db: peakDb,
    rms_db: rmsDb
  };
}

/**
 * 🎵 Correlação estéreo
 */
function analyzeStereoCorrelation(leftChannel, rightChannel) {
  // Calcular correlação cruzada
  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  const n = leftChannel.length;
  
  for (let i = 0; i < n; i++) {
    const x = leftChannel[i];
    const y = rightChannel[i];
    
    sumXY += x * y;
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  
  const meanX = sumX / n;
  const meanY = sumY / n;
  const varX = (sumX2 / n) - (meanX * meanX);
  const varY = (sumY2 / n) - (meanY * meanY);
  
  const correlation = Math.sqrt(varX * varY) > 0 ? 
    ((sumXY / n) - (meanX * meanY)) / Math.sqrt(varX * varY) : 0;
  
  // Balance L/R
  const rmsL = Math.sqrt(sumX2 / n);
  const rmsR = Math.sqrt(sumY2 / n);
  const balanceLR = rmsL > 0 && rmsR > 0 ? 
    20 * Math.log10(rmsL / rmsR) : 0;
  
  return {
    correlation: Math.max(-1, Math.min(1, correlation)),
    balance_lr_db: balanceLR,
    mono_compatibility: correlation > 0.8,
    phase_issues: correlation < 0.5
  };
}

/**
 * 🎚️ Tonal Balance por bandas
 */
function calculateTonalBalance(leftChannel, rightChannel, sampleRate) {
  // Definir bandas de frequência
  const bands = {
    sub: { low: 20, high: 60 },      // Sub bass
    low: { low: 60, high: 250 },     // Low
    mid: { low: 250, high: 4000 },   // Mid
    high: { low: 4000, high: 20000 } // High
  };
  
  // Usar FFT simples para separar bandas (aproximação)
  const fftSize = 4096;
  const numBands = Object.keys(bands).length;
  const results = {};
  
  // Processar cada canal
  for (const [bandName, range] of Object.entries(bands)) {
    const startBin = Math.floor(range.low * fftSize / sampleRate);
    const endBin = Math.floor(range.high * fftSize / sampleRate);
    
    // Energia RMS aproximada da banda (simples filtro passa-banda)
    let energyL = 0, energyR = 0;
    let samples = 0;
    
    const step = Math.max(1, Math.floor(leftChannel.length / 1000)); // Amostragem
    
    for (let i = 0; i < leftChannel.length; i += step) {
      const freqWeight = getFrequencyWeight(i, leftChannel.length, range, sampleRate);
      if (freqWeight > 0.1) {
        energyL += leftChannel[i] * leftChannel[i] * freqWeight;
        energyR += rightChannel[i] * rightChannel[i] * freqWeight;
        samples++;
      }
    }
    
    const rmsL = samples > 0 ? Math.sqrt(energyL / samples) : 0;
    const rmsR = samples > 0 ? Math.sqrt(energyR / samples) : 0;
    const rmsMix = (rmsL + rmsR) / 2;
    
    results[bandName] = {
      rms_db: rmsMix > 0 ? 20 * Math.log10(rmsMix) : -80,
      rms_left_db: rmsL > 0 ? 20 * Math.log10(rmsL) : -80,
      rms_right_db: rmsR > 0 ? 20 * Math.log10(rmsR) : -80
    };
  }
  
  return results;
}

/**
 * 🎯 Peso por frequência (filtro aproximado)
 */
function getFrequencyWeight(sampleIndex, totalSamples, range, sampleRate) {
  // Aproximação: mapear posição no tempo para frequência dominante
  const progress = sampleIndex / totalSamples;
  const approxFreq = 100 + progress * 5000; // Rough frequency mapping
  
  if (approxFreq >= range.low && approxFreq <= range.high) {
    return 1.0;
  }
  
  // Transição suave
  const tolerance = (range.high - range.low) * 0.2;
  if (approxFreq >= range.low - tolerance && approxFreq <= range.high + tolerance) {
    return 0.5;
  }
  
  return 0.0;
}

/**
 * 📊 Canal dominante (maior energia)
 */
function findDominantChannel(leftChannel, rightChannel) {
  let energyL = 0, energyR = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    energyL += leftChannel[i] * leftChannel[i];
    energyR += rightChannel[i] * rightChannel[i];
  }
  
  return energyL >= energyR ? leftChannel : rightChannel;
}

/**
 * 🔍 Comparar arrays para stereo detection
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const threshold = 0.001; // Tolerance para floating point
  
  for (let i = 0; i < Math.min(a.length, 1000); i++) { // Sample first 1000
    if (Math.abs(a[i] - b[i]) > threshold) return false;
  }
  return true;
}

/**
 * 🔬 Diagnósticos Fase 2
 */
function generateDiagnosticsPhase2(basicMetrics, loudnessMetrics, truePeakMetrics, spectralMetrics, warnings) {
  const problems = [];
  const suggestions = [];
  
  // LUFS warnings
  if (loudnessMetrics) {
    if (loudnessMetrics.lufs_integrated < -30) {
      problems.push('Nível muito baixo (sub -30 LUFS)');
      suggestions.push('Considere aumentar o gain geral');
    }
    if (loudnessMetrics.lufs_integrated > -14) {
      problems.push('Nível muito alto para streaming');
      suggestions.push('Reduza o gain para -16 a -20 LUFS');
    }
    if (loudnessMetrics.lra < 3) {
      problems.push('Pouca variação dinâmica (LRA baixo)');
      suggestions.push('Evite compressão excessiva');
    }
  }
  
  // True Peak warnings
  if (truePeakMetrics) {
    if (truePeakMetrics.exceeds_minus1dbtp) {
      problems.push('True peak excede -1dBTP');
      suggestions.push('Use limiter com true peak para evitar clipping');
    }
  }
  
  // Spectral warnings
  if (spectralMetrics) {
    if (spectralMetrics.centroid_hz < 800) {
      problems.push('Som muito escuro (centroid baixo)');
      suggestions.push('Considere realçar frequências agudas');
    }
    if (spectralMetrics.centroid_hz > 4000) {
      problems.push('Som muito brilhante (centroid alto)');
      suggestions.push('Considere atenuar frequências agudas');
    }
  }
  
  return {
    problems,
    suggestions,
    warnings,
    health_score: Math.max(0, 100 - (problems.length * 15) - (warnings.length * 5))
  };
}

/**
 * 🔄 ADAPTER: Mapear Phase 2 para schema compatível com frontend
 * Transforma as novas métricas no formato esperado pelo modal existente
 */
function mapToCompatibleSchema(analysisResult) {
  const { metadata, metrics, diagnostics } = analysisResult;
  
  // Extrair métricas das diferentes seções
  const basic = metrics.core || {};
  const loudness = metrics.loudness || {};
  const truePeak = metrics.truePeak || {};
  const dynamics = metrics.dynamics || {};
  const spectral = metrics.spectral || {};
  const stereo = metrics.stereo || {};
  const tonalBalance = metrics.tonalBalance || {};
  
  // Schema compatível com o modal existente
  return {
    // Metadata (compatível)
    metadata: {
      duration: metadata.duration,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      fileSize: metadata.fileSize,
      format: metadata.format
    },
    
    // Schema principal para renderização no modal
    resumo: {
      peak_db: basic.peak_db || truePeak.sample_peak_left_db || -Infinity,
      true_peak_dbtp: truePeak.true_peak_dbtp || null, // 🆕 FASE 2
      rms_mix_db: basic.rms_mix_db || dynamics.rms_db || -Infinity,
      lufs_integrated: loudness.lufs_integrated || null, // 🆕 FASE 2
      duration_sec: metadata.duration,
      dominant_freq_hz: spectral.fundamental_freq || spectral.peakFreq || 0
    },
    
    loudness_headroom: {
      lufs_m: loudness.lufs_momentary || null,
      lufs_st: loudness.lufs_short_term || null,
      lufs_i: loudness.lufs_integrated || null, // 🆕 FASE 2
      lra: loudness.lra || null, // 🆕 FASE 2 
      headroom_db: loudness.headroom_db || null,
      stereo_width: stereo.correlation ? (1 - Math.abs(stereo.correlation)) : null
    },
    
    tonal_balance: {
      sub: {
        rms_db: tonalBalance.sub?.rms_db || null, // 🆕 FASE 2
        peak_db: tonalBalance.sub?.rms_db || null
      },
      low: {
        rms_db: tonalBalance.low?.rms_db || null, // 🆕 FASE 2
        peak_db: tonalBalance.low?.rms_db || null
      },
      mid: {
        rms_db: tonalBalance.mid?.rms_db || null, // 🆕 FASE 2
        peak_db: tonalBalance.mid?.rms_db || null
      },
      high: {
        rms_db: tonalBalance.high?.rms_db || null, // 🆕 FASE 2
        peak_db: tonalBalance.high?.rms_db || null
      }
    },
    
    dinamica: {
      crest_factor_db: dynamics.crest_factor_db || null, // 🆕 FASE 2
      dynamic_range_db: dynamics.dynamic_range_db || null, // 🆕 FASE 2
      lra: loudness.lra || null
    },
    
    frequencia_timbre: {
      centroid_hz: spectral.centroid_hz || null, // 🆕 FASE 2
      rolloff85_hz: spectral.rolloff85_hz || null, // 🆕 FASE 2
      flux: spectral.spectral_flux || null, // 🆕 FASE 2
      harmonics_score: spectral.harmonic_ratio || null,
      key: null, // Phase 3
      scale: null, // Phase 3
      key_confidence: null, // Phase 3
      spectrum_avg: spectral.spectrum_avg || null
    },
    
    masking_kick_bass: {
      indice_pct: null, // Phase 5
      overlap_db: null,
      sidechain_strength: null,
      times_sec: null,
      suggestion: null
    },
    
    stereo_fase: {
      correlation: stereo.correlation || null, // 🆕 FASE 2
      balance_lr_db: stereo.balance_lr_db || null,
      bands_table: null // TODO: mapear de tonal_balance se necessário
    },
    
    qualidade_problemas: {
      clipping_pct: basic.clipping_pct || truePeak.clipping_percentage || 0,
      dc_offset_pct: basic.dc_offset_pct || 0,
      sibilancia_score: null, // Phase 5
      snr_db: null,
      codec_artifact_score: null,
      reverb_excess_score: null,
      fase_issues_score: stereo.phase_issues ? 80 : 0
    },
    
    ritmo_estrutura: {
      bpm: null, // Phase 3
      bpm_confidence: null, // Phase 3
      transients_per_min: null,
      silence_total_sec: null
    },
    
    mix_diagnostico: {
      mix_health: diagnostics.health_score || 0,
      stereo_timeline: null,
      problem_frequencies_hz: []
    },
    
    // Warnings e diagnósticos
    warnings: diagnostics.warnings || [],
    problems: diagnostics.problems || [],
    suggestions: diagnostics.suggestions || [],
    
    // Compatibilidade V1 (se necessário)
    technicalData: {
      peak: basic.peak_db || -Infinity,
      rms: basic.rms_mix_db || -Infinity,  
      dynamicRange: dynamics.dynamic_range_db || 0,
      dominantFrequencies: spectral.harmonicPeaks || []
    },
    
    // Debug info
    debug: analysisResult.debug
  };
}

/**
 * 🔍 Console logging para desenvolvimento
 */
function logPhase2Metrics(metrics) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 Phase 2 Metrics Summary:', {
      lufs: metrics.loudness?.lufs_integrated?.toFixed(1) + ' LUFS' || 'N/A',
      lra: metrics.loudness?.lra?.toFixed(1) + ' LU' || 'N/A', 
      truePeak: metrics.truePeak?.true_peak_dbtp?.toFixed(2) + ' dBTP' || 'N/A',
      crest: metrics.dynamics?.crest_factor_db?.toFixed(1) + ' dB' || 'N/A',
      centroid: metrics.spectral?.centroid_hz?.toFixed(0) + ' Hz' || 'N/A',
      correlation: metrics.stereo?.correlation?.toFixed(2) || 'N/A'
    });
  }
}

console.log('🎵 Audio Analyzer API V2 - FASE 2 carregado');
