// 🎵 RHYTHM & BPM ANALYSIS - FASE 2
// BPM detection via onset envelope + autocorrelation

import { AUDIO_CONFIG } from '../config.js';

/**
 * Calcula envelope de onsets para detecção de BPM
 * @param {Float32Array} samples 
 * @param {number} sampleRate 
 * @returns {Float32Array} Envelope de energia
 */
function calculateOnsetEnvelope(samples, sampleRate) {
  // High-pass filter para enfatizar transientes (>150Hz)
  const filteredSamples = applyHighPassFilter(samples, 150, sampleRate);
  
  // Rectificação (valor absoluto)
  const rectified = new Float32Array(filteredSamples.length);
  for (let i = 0; i < filteredSamples.length; i++) {
    rectified[i] = Math.abs(filteredSamples[i]);
  }
  
  // Smoothing com média móvel
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms window
  const smoothed = new Float32Array(rectified.length);
  
  for (let i = 0; i < rectified.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - windowSize); j <= Math.min(rectified.length - 1, i + windowSize); j++) {
      sum += rectified[j];
      count++;
    }
    
    smoothed[i] = sum / count;
  }
  
  return smoothed;
}

/**
 * Aplica filtro high-pass simples
 * @param {Float32Array} samples 
 * @param {number} cutoffHz 
 * @param {number} sampleRate 
 * @returns {Float32Array}
 */
function applyHighPassFilter(samples, cutoffHz, sampleRate) {
  // Filtro IIR de primeira ordem simples
  const alpha = Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
  const filtered = new Float32Array(samples.length);
  
  let prevInput = 0;
  let prevOutput = 0;
  
  for (let i = 0; i < samples.length; i++) {
    filtered[i] = alpha * (prevOutput + samples[i] - prevInput);
    prevInput = samples[i];
    prevOutput = filtered[i];
  }
  
  return filtered;
}

/**
 * Calcula autocorrelação para detecção de periodicidade
 * @param {Float32Array} envelope 
 * @param {number} sampleRate 
 * @param {number} minBPM 
 * @param {number} maxBPM 
 * @returns {Object} {bpm, confidence, correlationPeaks}
 */
function calculateBPMAutocorrelation(envelope, sampleRate, minBPM = 60, maxBPM = 180) {
  const minPeriodSamples = Math.floor((60 / maxBPM) * sampleRate); // Período mínimo
  const maxPeriodSamples = Math.floor((60 / minBPM) * sampleRate); // Período máximo
  
  const autocorrelation = [];
  const bpmCandidates = [];
  
  // Calcular autocorrelação para diferentes lags (períodos)
  for (let lag = minPeriodSamples; lag <= maxPeriodSamples && lag < envelope.length / 2; lag++) {
    let correlation = 0;
    let count = 0;
    
    for (let i = 0; i < envelope.length - lag; i++) {
      correlation += envelope[i] * envelope[i + lag];
      count++;
    }
    
    if (count > 0) {
      correlation /= count;
      
      // Normalizar pela energia
      let energy1 = 0, energy2 = 0;
      for (let i = 0; i < count; i++) {
        energy1 += envelope[i] * envelope[i];
        energy2 += envelope[i + lag] * envelope[i + lag];
      }
      
      const normalizedCorr = count > 0 ? correlation / Math.sqrt((energy1 * energy2) / (count * count)) : 0;
      
      autocorrelation.push({
        lag: lag,
        correlation: normalizedCorr,
        bpm: (60 * sampleRate) / lag
      });
    }
  }
  
  if (autocorrelation.length === 0) {
    return { bpm: 120, confidence: 0, correlationPeaks: [] };
  }
  
  // Encontrar picos na autocorrelação
  const peaks = findAutocorrelationPeaks(autocorrelation);
  
  // Selecionar melhor candidato
  let bestCandidate = peaks[0];
  let maxScore = 0;
  
  for (const peak of peaks.slice(0, 5)) { // Top 5 candidatos
    // Score combinando correlação com proximidade a BPMs típicos
    const bpmScore = calculateBPMScore(peak.bpm);
    const totalScore = peak.correlation * 0.7 + bpmScore * 0.3;
    
    if (totalScore > maxScore) {
      maxScore = totalScore;
      bestCandidate = peak;
    }
  }
  
  // Calcular confiança baseada na força do pico e consistência
  const confidence = calculateBPMConfidence(bestCandidate, peaks);
  
  return {
    bpm: Math.round(bestCandidate.bpm),
    confidence: confidence,
    correlationPeaks: peaks.slice(0, 3),
    autocorrelationData: autocorrelation.length < 100 ? autocorrelation : [] // Só retornar se pequeno
  };
}

/**
 * Encontra picos na autocorrelação
 * @param {Array} autocorrelation 
 * @returns {Array} Picos ordenados por correlação
 */
function findAutocorrelationPeaks(autocorrelation) {
  const peaks = [];
  
  for (let i = 1; i < autocorrelation.length - 1; i++) {
    const prev = autocorrelation[i - 1].correlation;
    const curr = autocorrelation[i].correlation;
    const next = autocorrelation[i + 1].correlation;
    
    // É um pico local?
    if (curr > prev && curr > next && curr > 0.1) { // Threshold mínimo
      peaks.push(autocorrelation[i]);
    }
  }
  
  // Ordenar por correlação (descendente)
  peaks.sort((a, b) => b.correlation - a.correlation);
  
  return peaks;
}

/**
 * Calcula score de BPM baseado em valores típicos
 * @param {number} bpm 
 * @returns {number} Score 0-1
 */
function calculateBPMScore(bpm) {
  // BPMs mais comuns na música
  const commonBPMs = [120, 128, 140, 100, 110, 90, 160, 80];
  
  let bestScore = 0;
  
  for (const commonBPM of commonBPMs) {
    // Score baseado na proximidade
    const distance = Math.abs(bpm - commonBPM);
    const score = Math.max(0, 1 - distance / 40); // Tolerância de ±40 BPM
    bestScore = Math.max(bestScore, score);
    
    // Também verificar múltiplos/submúltiplos
    const double = Math.abs(bpm - commonBPM * 2);
    const half = Math.abs(bpm - commonBPM / 2);
    
    bestScore = Math.max(bestScore, Math.max(0, 1 - double / 40) * 0.8);
    bestScore = Math.max(bestScore, Math.max(0, 1 - half / 40) * 0.8);
  }
  
  return bestScore;
}

/**
 * Calcula confiança na detecção de BPM
 * @param {Object} bestPeak 
 * @param {Array} allPeaks 
 * @returns {number} Confiança 0-1
 */
function calculateBPMConfidence(bestPeak, allPeaks) {
  if (!bestPeak || allPeaks.length === 0) return 0;
  
  const primaryCorr = bestPeak.correlation;
  
  // Confiança baseada na força absoluta do pico
  let confidence = Math.min(1, primaryCorr * 2);
  
  // Penalizar se há muitos picos similares (ambiguidade)
  const similarPeaks = allPeaks.filter(peak => peak.correlation > primaryCorr * 0.8).length;
  if (similarPeaks > 2) {
    confidence *= 0.7;
  }
  
  // Bonus se BPM está em range típico
  if (bestPeak.bpm >= 80 && bestPeak.bpm <= 140) {
    confidence *= 1.1;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Detecta transientes (onsets) no áudio
 * @param {Float32Array} samples 
 * @param {number} sampleRate 
 * @returns {Object}
 */
function detectTransients(samples, sampleRate) {
  const envelope = calculateOnsetEnvelope(samples, sampleRate);
  
  // Detectar picos de energia (transientes)
  const transients = [];
  const threshold = calculateDynamicThreshold(envelope);
  
  let lastTransient = 0;
  const minInterval = Math.floor(sampleRate * 0.05); // Mín 50ms entre transientes
  
  for (let i = 1; i < envelope.length - 1; i++) {
    const prev = envelope[i - 1];
    const curr = envelope[i];
    const next = envelope[i + 1];
    
    // É um pico e está acima do threshold?
    if (curr > prev && curr > next && curr > threshold && (i - lastTransient) > minInterval) {
      transients.push({
        sample: i,
        time_sec: i / sampleRate,
        strength: curr
      });
      lastTransient = i;
    }
  }
  
  // Calcular estatísticas
  const duration_sec = samples.length / sampleRate;
  const transients_per_min = (transients.length / duration_sec) * 60;
  
  return {
    transients: transients.slice(0, 100), // Limitar quantidade
    count: transients.length,
    transients_per_min: transients_per_min,
    avg_interval_sec: transients.length > 1 ? duration_sec / transients.length : 0
  };
}

/**
 * Calcula threshold dinâmico baseado no envelope
 * @param {Float32Array} envelope 
 * @returns {number}
 */
function calculateDynamicThreshold(envelope) {
  // Usar percentil 70% como threshold
  const sorted = Array.from(envelope).sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.7);
  return sorted[index];
}

/**
 * Análise completa de ritmo e BPM
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @param {number} sampleRate 
 * @returns {Promise<Object>}
 */
export async function analyzeRhythm(leftChannel, rightChannel, sampleRate) {
  console.log('🥁 Analisando ritmo e BPM...');
  
  try {
    // Criar mix mono
    const monoMix = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoMix[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    // Detectar BPM
    const bpmAnalysis = calculateBPMAutocorrelation(
      calculateOnsetEnvelope(monoMix, sampleRate),
      sampleRate,
      AUDIO_CONFIG.THRESHOLDS.BPM_MIN,
      AUDIO_CONFIG.THRESHOLDS.BPM_MAX
    );
    
    // Detectar transientes
    const transientAnalysis = detectTransients(monoMix, sampleRate);
    
    // Analisar regularidade do ritmo
    const rhythmRegularity = analyzeRhythmRegularity(transientAnalysis.transients);
    
    const result = {
      // BPM principal
      bpm: bpmAnalysis.bpm,
      bpm_confidence: bpmAnalysis.confidence,
      
      // Candidatos alternativos
      alternative_bpms: bpmAnalysis.correlationPeaks.map(peak => ({
        bpm: Math.round(peak.bpm),
        confidence: peak.correlation
      })),
      
      // Transientes
      transients_per_min: transientAnalysis.transients_per_min,
      transient_count: transientAnalysis.count,
      avg_transient_interval_sec: transientAnalysis.avg_interval_sec,
      
      // Regularidade
      rhythm_regularity: rhythmRegularity.regularity,
      rhythm_descriptor: rhythmRegularity.descriptor,
      
      // Classificação de gênero (aproximada)
      genre_hints: classifyGenreByBPM(bpmAnalysis.bpm, transientAnalysis.transients_per_min),
      
      // Flags
      is_rhythmic: bpmAnalysis.confidence > 0.5,
      is_regular: rhythmRegularity.regularity > 0.7,
      has_strong_beat: transientAnalysis.transients_per_min > 60,
      
      // Informações técnicas
      analysis_length_sec: leftChannel.length / sampleRate,
      detection_method: 'autocorrelation'
    };
    
    console.log('✅ Ritmo analisado:', {
      'BPM': `${result.bpm} (conf: ${(result.bpm_confidence * 100).toFixed(0)}%)`,
      'Transientes': `${result.transients_per_min.toFixed(0)}/min`,
      'Regularidade': result.rhythm_descriptor
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro na análise de ritmo:', error);
    throw error;
  }
}

/**
 * Analisa regularidade do ritmo
 * @param {Array} transients 
 * @returns {Object}
 */
function analyzeRhythmRegularity(transients) {
  if (transients.length < 4) {
    return { regularity: 0, descriptor: 'irregular' };
  }
  
  // Calcular intervalos entre transientes
  const intervals = [];
  for (let i = 1; i < transients.length; i++) {
    intervals.push(transients[i].time_sec - transients[i - 1].time_sec);
  }
  
  // Calcular variabilidade dos intervalos
  const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - meanInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  
  // Regularidade = 1 - (desvio relativo)
  const regularity = Math.max(0, Math.min(1, 1 - (stdDev / meanInterval)));
  
  let descriptor;
  if (regularity > 0.8) descriptor = 'muito regular';
  else if (regularity > 0.6) descriptor = 'regular';
  else if (regularity > 0.4) descriptor = 'moderadamente regular';
  else descriptor = 'irregular';
  
  return { regularity, descriptor, meanInterval, variance: stdDev };
}

/**
 * Classifica gênero aproximado por BPM
 * @param {number} bpm 
 * @param {number} transientsPerMin 
 * @returns {Array}
 */
function classifyGenreByBPM(bpm, transientsPerMin) {
  const hints = [];
  
  if (bpm >= 120 && bpm <= 130) hints.push('house', 'techno');
  if (bpm >= 140 && bpm <= 150) hints.push('trance', 'drum_and_bass');
  if (bpm >= 160 && bpm <= 180) hints.push('drum_and_bass', 'hardcore');
  if (bpm >= 80 && bpm <= 100) hints.push('hip_hop', 'trap', 'dubstep');
  if (bpm >= 100 && bpm <= 120) hints.push('pop', 'rock');
  if (bpm >= 60 && bpm <= 80) hints.push('ballad', 'ambient');
  
  if (transientsPerMin > 200) hints.push('electronic', 'percussion_heavy');
  if (transientsPerMin < 60) hints.push('ambient', 'slow');
  
  return [...new Set(hints)]; // Remove duplicatas
}
