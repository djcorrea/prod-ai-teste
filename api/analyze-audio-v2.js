// 🎵 AUDIO ANALYZER API V2
// Endpoint para análise avançada de áudio com métricas profissionais

import { auth, db } from './firebaseAdmin.js';
import { AudioAnalysisResponseSchema, AudioAnalysisRequestSchema, validateAnalysisResponse, ANALYSIS_CONSTANTS } from '../schemas/audio-analysis.js';
import cors from 'cors';
import Meyda from 'meyda';

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
    
    // Construir resposta completa
    const response = {
      success: true,
      version: '2.0',
      timestamp: new Date().toISOString(),
      processingTime,
      ...analysisResult
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

// 🔬 ANÁLISE PRINCIPAL
async function performAdvancedAnalysis(audioBuffer, config) {
  const analysisStart = Date.now();
  const steps = [];
  const warnings = [];
  const performance = {};

  try {
    // 1. DECODIFICAÇÃO E METADADOS
    steps.push('audio_decode');
    const decodeStart = Date.now();
    
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)({ sampleRate: 44100 });
    const decodedBuffer = await audioContext.decodeAudioData(audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength));
    
    performance.decode_time = Date.now() - decodeStart;
    steps.push('metadata_extract');

    const metadata = {
      duration: decodedBuffer.duration,
      sampleRate: decodedBuffer.sampleRate,
      channels: decodedBuffer.numberOfChannels,
      fileSize: audioBuffer.length,
      format: detectAudioFormat(audioBuffer),
      bitDepth: estimateBitDepth(decodedBuffer)
    };

    // Validações básicas
    if (metadata.duration > ANALYSIS_CONSTANTS.MAX_DURATION) {
      warnings.push(`Duração muito longa: ${metadata.duration}s (max: ${ANALYSIS_CONSTANTS.MAX_DURATION}s)`);
    }

    // 2. ANÁLISE CORE (sempre executada)
    steps.push('core_analysis');
    const coreStart = Date.now();
    
    const leftChannel = decodedBuffer.getChannelData(0);
    const rightChannel = decodedBuffer.numberOfChannels > 1 ? decodedBuffer.getChannelData(1) : null;
    
    const coreMetrics = await analyzeCoreMetrics(leftChannel, rightChannel, decodedBuffer.sampleRate);
    performance.core_analysis = Date.now() - coreStart;

    // 3. ANÁLISE ESPECTRAL (se solicitada)
    let spectralData = null;
    if (config.features?.includes('spectral') || config.features?.includes('core')) {
      steps.push('spectral_analysis');
      const spectralStart = Date.now();
      spectralData = await analyzeSpectralFeatures(leftChannel, decodedBuffer.sampleRate, config.quality);
      performance.spectral_analysis = Date.now() - spectralStart;
    }

    // 4. ANÁLISE ESTÉREO (se houver 2 canais)
    let stereoMetrics = null;
    if (rightChannel && (config.features?.includes('stereo') || config.features?.includes('core'))) {
      steps.push('stereo_analysis');
      const stereoStart = Date.now();
      stereoMetrics = analyzeStereoMetrics(leftChannel, rightChannel);
      performance.stereo_analysis = Date.now() - stereoStart;
    }

    // 5. ANÁLISE DE QUALIDADE E SCORES
    steps.push('quality_scoring');
    const qualityStart = Date.now();
    const qualityScores = calculateQualityScores(coreMetrics, spectralData, stereoMetrics, metadata);
    performance.quality_scoring = Date.now() - qualityStart;

    // 6. DIAGNÓSTICO E SUGESTÕES
    steps.push('diagnostics');
    const diagnosticsStart = Date.now();
    const diagnostics = generateDiagnosticsAndSuggestions(coreMetrics, spectralData, stereoMetrics, metadata);
    performance.diagnostics = Date.now() - diagnosticsStart;

    // 7. MÉTRICAS AVANÇADAS (se habilitadas)
    let advancedMetrics = {};
    if (config.enableAdvanced) {
      steps.push('advanced_analysis');
      const advancedStart = Date.now();
      // TODO: Implementar métricas avançadas (LUFS, BPM, etc.) em fases futuras
      performance.advanced_analysis = Date.now() - advancedStart;
    }

    await audioContext.close();

    return {
      metadata,
      config: {
        features: config.features || ['core'],
        quality: config.quality || 'balanced',
        advancedMetrics: config.enableAdvanced || false
      },
      metrics: {
        core: {
          ...coreMetrics,
          ...spectralData // Merge spectral data com core
        },
        ...(stereoMetrics && { stereo: stereoMetrics }),
        quality: qualityScores,
        ...advancedMetrics
      },
      diagnostics,
      debug: {
        analysisSteps: steps,
        warnings,
        performance: {
          ...performance,
          total_time: Date.now() - analysisStart
        }
      }
    };

  } catch (error) {
    console.error('❌ Erro na análise:', error);
    throw new Error(`Falha na análise: ${error.message}`);
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

console.log('🎵 Audio Analyzer API V2 carregado');
