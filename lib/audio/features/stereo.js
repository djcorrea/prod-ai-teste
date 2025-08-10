// 🎵 STEREO ANALYSIS - FASE 2
// Correlação estéreo, balance L/R, análise de fase

import { AUDIO_CONFIG } from '../config.js';

/**
 * Calcula correlação entre canais L/R
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @returns {number} Correlação -1 a +1
 */
function calculateStereoCorrelation(leftChannel, rightChannel) {
  if (leftChannel.length !== rightChannel.length || leftChannel.length === 0) {
    return 0;
  }
  
  // Calcular médias
  let leftSum = 0, rightSum = 0;
  for (let i = 0; i < leftChannel.length; i++) {
    leftSum += leftChannel[i];
    rightSum += rightChannel[i];
  }
  const leftMean = leftSum / leftChannel.length;
  const rightMean = rightSum / rightChannel.length;
  
  // Calcular covariância e variâncias
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    const leftDiff = leftChannel[i] - leftMean;
    const rightDiff = rightChannel[i] - rightMean;
    
    covariance += leftDiff * rightDiff;
    leftVariance += leftDiff * leftDiff;
    rightVariance += rightDiff * rightDiff;
  }
  
  const denominator = Math.sqrt(leftVariance * rightVariance);
  
  if (denominator === 0) return 0;
  
  return covariance / denominator;
}

/**
 * Calcula largura estéreo
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @returns {number} Largura 0-2 (0=mono, 1=normal, 2=muito largo)
 */
function calculateStereoWidth(leftChannel, rightChannel) {
  // Calcular sinais Mid/Side
  const midChannel = new Float32Array(leftChannel.length);
  const sideChannel = new Float32Array(leftChannel.length);
  
  for (let i = 0; i < leftChannel.length; i++) {
    midChannel[i] = (leftChannel[i] + rightChannel[i]) / 2;
    sideChannel[i] = (leftChannel[i] - rightChannel[i]) / 2;
  }
  
  // Calcular energia Mid/Side
  let midEnergy = 0, sideEnergy = 0;
  for (let i = 0; i < midChannel.length; i++) {
    midEnergy += midChannel[i] * midChannel[i];
    sideEnergy += sideChannel[i] * sideChannel[i];
  }
  
  if (midEnergy === 0) return 0;
  
  // Largura baseada na relação Side/Mid
  const widthRatio = Math.sqrt(sideEnergy / midEnergy);
  
  // Mapear para escala 0-2
  return Math.min(2.0, widthRatio);
}

/**
 * Calcula balance L/R
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @returns {number} Balance em dB (-inf a +inf, 0 = balanceado)
 */
function calculateStereoBalance(leftChannel, rightChannel) {
  // Calcular RMS de cada canal
  let leftRMS = 0, rightRMS = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    leftRMS += leftChannel[i] * leftChannel[i];
    rightRMS += rightChannel[i] * rightChannel[i];
  }
  
  leftRMS = Math.sqrt(leftRMS / leftChannel.length);
  rightRMS = Math.sqrt(rightRMS / rightChannel.length);
  
  if (leftRMS === 0 && rightRMS === 0) return 0;
  if (rightRMS === 0) return Infinity;
  if (leftRMS === 0) return -Infinity;
  
  // Balance em dB (positivo = L mais alto, negativo = R mais alto)
  return 20 * Math.log10(leftRMS / rightRMS);
}

/**
 * Detecta problemas de fase
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @returns {Object}
 */
function detectPhaseIssues(leftChannel, rightChannel) {
  const correlation = calculateStereoCorrelation(leftChannel, rightChannel);
  
  // Calcular correlação em janelas menores para detectar problemas locais
  const windowSize = Math.floor(leftChannel.length / 20); // 5% do áudio
  const localCorrelations = [];
  
  for (let start = 0; start < leftChannel.length - windowSize; start += windowSize) {
    const leftWindow = leftChannel.slice(start, start + windowSize);
    const rightWindow = rightChannel.slice(start, start + windowSize);
    const localCorr = calculateStereoCorrelation(leftWindow, rightWindow);
    localCorrelations.push(localCorr);
  }
  
  // Análise dos problemas
  const lowCorrelationWindows = localCorrelations.filter(corr => corr < 0.5).length;
  const negativeCorrelationWindows = localCorrelations.filter(corr => corr < 0).length;
  
  const phaseIssues = {
    global_correlation: correlation,
    has_phase_problems: correlation < AUDIO_CONFIG.THRESHOLDS.CORRELATION_MIN,
    severe_phase_problems: correlation < 0,
    local_issues_count: lowCorrelationWindows,
    negative_correlation_regions: negativeCorrelationWindows,
    mono_compatibility: assessMonoCompatibility(correlation),
    phase_coherence_score: calculatePhaseCoherence(localCorrelations)
  };
  
  return phaseIssues;
}

/**
 * Avalia compatibilidade mono
 * @param {number} correlation 
 * @returns {string}
 */
function assessMonoCompatibility(correlation) {
  if (correlation > 0.95) return 'excellent';
  if (correlation > 0.8) return 'good';
  if (correlation > 0.5) return 'fair';
  return 'poor';
}

/**
 * Calcula score de coerência de fase
 * @param {number[]} correlations 
 * @returns {number} Score 0-1
 */
function calculatePhaseCoherence(correlations) {
  if (correlations.length === 0) return 0;
  
  const meanCorr = correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length;
  const variance = correlations.reduce((sum, corr) => sum + Math.pow(corr - meanCorr, 2), 0) / correlations.length;
  
  // Score baseado na correlação média e consistência
  const coherence = Math.max(0, meanCorr) * (1 - Math.sqrt(variance));
  
  return Math.max(0, Math.min(1, coherence));
}

/**
 * Análise por bandas de frequência
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @param {number} sampleRate 
 * @param {AudioContext} audioContext 
 * @returns {Promise<Object>}
 */
async function analyzeStereoByBands(leftChannel, rightChannel, sampleRate, audioContext) {
  const bands = {
    sub: AUDIO_CONFIG.FREQUENCY_BANDS.SUB,
    low: AUDIO_CONFIG.FREQUENCY_BANDS.LOW,
    mid: AUDIO_CONFIG.FREQUENCY_BANDS.MID,
    high: AUDIO_CONFIG.FREQUENCY_BANDS.HIGH
  };
  
  const bandResults = {};
  
  for (const [bandName, bandRange] of Object.entries(bands)) {
    try {
      // Filtrar banda (simplificado usando windowing)
      const leftBand = await extractFrequencyBand(leftChannel, bandRange, sampleRate, audioContext);
      const rightBand = await extractFrequencyBand(rightChannel, bandRange, sampleRate, audioContext);
      
      // Analisar banda
      const correlation = calculateStereoCorrelation(leftBand, rightBand);
      const balance = calculateStereoBalance(leftBand, rightBand);
      const width = calculateStereoWidth(leftBand, rightBand);
      
      bandResults[bandName] = {
        correlation,
        balance_db: balance,
        width,
        rms_left_db: calculateBandRMS(leftBand),
        rms_right_db: calculateBandRMS(rightBand)
      };
    } catch (error) {
      console.warn(`⚠️  Erro na análise da banda ${bandName}:`, error.message);
      bandResults[bandName] = null;
    }
  }
  
  return bandResults;
}

/**
 * Extrai banda de frequência (simplificado)
 * @param {Float32Array} samples 
 * @param {Object} bandRange 
 * @param {number} sampleRate 
 * @param {AudioContext} audioContext 
 * @returns {Promise<Float32Array>}
 */
async function extractFrequencyBand(samples, bandRange, sampleRate, audioContext) {
  try {
    // Criar filtro passa-banda
    const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    
    const offlineContext = new OfflineAudioContext(1, samples.length, sampleRate);
    const source = offlineContext.createBufferSource();
    const lowpass = offlineContext.createBiquadFilter();
    const highpass = offlineContext.createBiquadFilter();
    
    source.buffer = buffer;
    
    // Configurar filtros
    highpass.type = 'highpass';
    highpass.frequency.value = bandRange.min;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = bandRange.max;
    
    // Conectar filtros
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(offlineContext.destination);
    
    source.start();
    const filteredBuffer = await offlineContext.startRendering();
    
    return filteredBuffer.getChannelData(0);
  } catch (error) {
    // Fallback: retornar samples originais
    console.warn('⚠️  Filtragem de banda falhou, usando dados originais');
    return samples;
  }
}

/**
 * Calcula RMS de uma banda
 * @param {Float32Array} samples 
 * @returns {number} RMS em dB
 */
function calculateBandRMS(samples) {
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/**
 * Análise completa estéreo
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @param {number} sampleRate 
 * @param {AudioContext} audioContext 
 * @returns {Promise<Object>}
 */
export async function analyzeStereo(leftChannel, rightChannel, sampleRate, audioContext) {
  console.log('🎧 Analisando imagem estéreo...');
  
  try {
    // Métricas básicas
    const correlation = calculateStereoCorrelation(leftChannel, rightChannel);
    const width = calculateStereoWidth(leftChannel, rightChannel);
    const balance = calculateStereoBalance(leftChannel, rightChannel);
    
    // Análise de fase
    const phaseAnalysis = detectPhaseIssues(leftChannel, rightChannel);
    
    // Análise por bandas
    const bandAnalysis = await analyzeStereoByBands(leftChannel, rightChannel, sampleRate, audioContext);
    
    const result = {
      // Métricas principais
      correlation: correlation,
      width: width,
      balance_db: balance,
      
      // Análise de fase
      phase_coherence: phaseAnalysis.phase_coherence_score,
      mono_compatibility: phaseAnalysis.mono_compatibility,
      has_phase_issues: phaseAnalysis.has_phase_problems,
      
      // Por bandas
      bands: bandAnalysis,
      
      // Descritores
      stereo_descriptor: describeStereoImage(correlation, width),
      balance_descriptor: describeBalance(balance),
      
      // Flags
      is_mono: width < 0.1 && Math.abs(balance) < 1.0,
      is_too_wide: width > 1.5,
      is_unbalanced: Math.abs(balance) > 3.0,
      
      // Informações técnicas
      analysis_length_sec: leftChannel.length / sampleRate
    };
    
    console.log('✅ Imagem estéreo analisada:', {
      'Correlação': result.correlation.toFixed(3),
      'Largura': result.width.toFixed(2),
      'Balance': `${result.balance_db.toFixed(1)} dB`,
      'Mono Compat.': result.mono_compatibility
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro na análise estéreo:', error);
    throw error;
  }
}

/**
 * Descreve imagem estéreo
 * @param {number} correlation 
 * @param {number} width 
 * @returns {string}
 */
function describeStereoImage(correlation, width) {
  if (width < 0.2) return 'mono';
  if (width < 0.6) return 'estreito';
  if (width < 1.2) return 'normal';
  if (width < 1.8) return 'amplo';
  return 'muito amplo';
}

/**
 * Descreve balance
 * @param {number} balanceDb 
 * @returns {string}
 */
function describeBalance(balanceDb) {
  const abs = Math.abs(balanceDb);
  if (abs < 0.5) return 'centrado';
  if (abs < 1.5) return 'ligeiramente desbalanceado';
  if (abs < 3.0) return 'desbalanceado';
  return 'muito desbalanceado';
}
