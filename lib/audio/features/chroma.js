// 🎵 KEY & CHROMA ANALYSIS - FASE 2
// Detecção de tonalidade usando perfil cromático e templates major/minor

import { AUDIO_CONFIG } from '../config.js';

// Templates de perfis tonais (Krumhansl-Schmuckler)
const KEY_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
};

// Nomes das notas
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMA_FREQUENCIES = [
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
  369.99, 392.00, 415.30, 440.00, 466.16, 493.88
]; // C4 a B4

/**
 * Calcula chroma vector (12 dimensões para as 12 notas)
 * @param {Float32Array} samples 
 * @param {number} sampleRate 
 * @returns {Promise<Float32Array>} Vetor chroma normalizado
 */
async function calculateChromaVector(samples, sampleRate) {
  // Calcular espectro usando DFT
  const spectrum = await computeSpectrum(samples, sampleRate);
  const chroma = new Float32Array(12);
  
  const fftSize = samples.length;
  const frequencyResolution = sampleRate / fftSize;
  
  // Para cada classe de altura (C, C#, D, etc.)
  for (let chromaClass = 0; chromaClass < 12; chromaClass++) {
    let chromaEnergy = 0;
    
    // Somar energia de todas as oitavas desta classe
    for (let octave = 1; octave <= 7; octave++) { // C1 a C8
      const frequency = CHROMA_FREQUENCIES[chromaClass] * Math.pow(2, octave - 4); // Relativo a C4
      
      if (frequency > sampleRate / 2) break; // Não passar de Nyquist
      
      // Encontrar bin correspondente
      const binIndex = Math.round(frequency / frequencyResolution);
      
      if (binIndex < spectrum.length) {
        // Somar energia em uma janela ao redor da frequência fundamental
        const windowSize = 3;
        for (let i = Math.max(0, binIndex - windowSize); 
             i <= Math.min(spectrum.length - 1, binIndex + windowSize); i++) {
          const weight = 1.0 - Math.abs(i - binIndex) / windowSize; // Janela triangular
          chromaEnergy += spectrum[i] * weight;
        }
      }
    }
    
    chroma[chromaClass] = chromaEnergy;
  }
  
  // Normalizar chroma vector
  const totalEnergy = chroma.reduce((sum, val) => sum + val, 0);
  if (totalEnergy > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= totalEnergy;
    }
  }
  
  return chroma;
}

/**
 * Computa espectro usando DFT simples
 * @param {Float32Array} samples 
 * @param {number} sampleRate 
 * @returns {Promise<Float32Array>}
 */
async function computeSpectrum(samples, sampleRate) {
  // Aplicar janela de Hann
  const windowed = applyHannWindow(samples);
  
  const N = windowed.length;
  const spectrum = new Float32Array(Math.floor(N / 2));
  
  // DFT
  for (let k = 0; k < spectrum.length; k++) {
    let realPart = 0;
    let imagPart = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      realPart += windowed[n] * Math.cos(angle);
      imagPart += windowed[n] * Math.sin(angle);
    }
    
    spectrum[k] = Math.sqrt(realPart * realPart + imagPart * imagPart);
  }
  
  return spectrum;
}

/**
 * Aplica janela de Hann
 * @param {Float32Array} samples 
 * @returns {Float32Array}
 */
function applyHannWindow(samples) {
  const windowed = new Float32Array(samples.length);
  const N = samples.length;
  
  for (let i = 0; i < N; i++) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    windowed[i] = samples[i] * window;
  }
  
  return windowed;
}

/**
 * Detecta tonalidade usando correlação com templates
 * @param {Float32Array} chromaVector 
 * @returns {Object}
 */
function detectKey(chromaVector) {
  let bestKey = 'C';
  let bestScale = 'major';
  let maxCorrelation = -1;
  let allCorrelations = [];
  
  // Testar todas as 24 tonalidades (12 major + 12 minor)
  for (let root = 0; root < 12; root++) {
    for (const scale of ['major', 'minor']) {
      const correlation = calculateKeyCorrelation(chromaVector, KEY_PROFILES[scale], root);
      
      allCorrelations.push({
        root: NOTE_NAMES[root],
        scale: scale,
        correlation: correlation
      });
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestKey = NOTE_NAMES[root];
        bestScale = scale;
      }
    }
  }
  
  // Ordenar por correlação
  allCorrelations.sort((a, b) => b.correlation - a.correlation);
  
  // Calcular confiança
  const confidence = calculateKeyConfidence(maxCorrelation, allCorrelations);
  
  return {
    key: bestKey,
    scale: bestScale,
    confidence: confidence,
    correlation: maxCorrelation,
    alternatives: allCorrelations.slice(0, 5), // Top 5 candidatos
    chroma_vector: Array.from(chromaVector)
  };
}

/**
 * Calcula correlação entre chroma e template de tonalidade
 * @param {Float32Array} chromaVector 
 * @param {Array} keyProfile 
 * @param {number} rootOffset 
 * @returns {number}
 */
function calculateKeyCorrelation(chromaVector, keyProfile, rootOffset) {
  // Rotacionar template para a tonalidade desejada
  const rotatedProfile = new Array(12);
  for (let i = 0; i < 12; i++) {
    rotatedProfile[i] = keyProfile[(i - rootOffset + 12) % 12];
  }
  
  // Calcular correlação de Pearson
  const chromaMean = chromaVector.reduce((sum, val) => sum + val, 0) / 12;
  const profileMean = rotatedProfile.reduce((sum, val) => sum + val, 0) / 12;
  
  let numerator = 0;
  let chromaVar = 0;
  let profileVar = 0;
  
  for (let i = 0; i < 12; i++) {
    const chromaDiff = chromaVector[i] - chromaMean;
    const profileDiff = rotatedProfile[i] - profileMean;
    
    numerator += chromaDiff * profileDiff;
    chromaVar += chromaDiff * chromaDiff;
    profileVar += profileDiff * profileDiff;
  }
  
  const denominator = Math.sqrt(chromaVar * profileVar);
  
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Calcula confiança na detecção de tonalidade
 * @param {number} maxCorrelation 
 * @param {Array} allCorrelations 
 * @returns {number}
 */
function calculateKeyConfidence(maxCorrelation, allCorrelations) {
  if (allCorrelations.length < 2) return 0;
  
  const secondBest = allCorrelations[1].correlation;
  
  // Confiança baseada na diferença entre 1º e 2º
  const gap = maxCorrelation - secondBest;
  let confidence = Math.min(1, gap * 2); // Amplificar diferenças
  
  // Bonus se correlação absoluta é alta
  if (maxCorrelation > 0.7) confidence *= 1.2;
  if (maxCorrelation > 0.5) confidence *= 1.1;
  
  // Penalizar se correlação é muito baixa
  if (maxCorrelation < 0.3) confidence *= 0.5;
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Analisa progressão harmônica em segmentos
 * @param {Float32Array} samples 
 * @param {number} sampleRate 
 * @returns {Promise<Object>}
 */
async function analyzeHarmonicProgression(samples, sampleRate) {
  // Dividir áudio em segmentos de ~8 segundos
  const segmentDuration = 8; // segundos
  const segmentSamples = segmentDuration * sampleRate;
  const segments = [];
  
  for (let start = 0; start < samples.length - segmentSamples; start += segmentSamples) {
    const segment = samples.slice(start, start + segmentSamples);
    segments.push(segment);
    
    if (segments.length >= 8) break; // Máx 8 segmentos para performance
  }
  
  // Analisar cada segmento
  const segmentAnalyses = [];
  for (const segment of segments) {
    try {
      const chroma = await calculateChromaVector(segment, sampleRate);
      const keyAnalysis = detectKey(chroma);
      segmentAnalyses.push(keyAnalysis);
    } catch (error) {
      console.warn('⚠️  Segmento ignorado na análise harmônica');
    }
  }
  
  if (segmentAnalyses.length === 0) {
    return { stability: 0, modulations: [], dominant_key: null };
  }
  
  // Analisar estabilidade tonal
  const keys = segmentAnalyses.map(seg => `${seg.key}_${seg.scale}`);
  const keyChanges = countKeyChanges(keys);
  const stability = Math.max(0, 1 - (keyChanges / keys.length));
  
  // Encontrar tonalidade dominante
  const keyFreq = {};
  keys.forEach(key => keyFreq[key] = (keyFreq[key] || 0) + 1);
  const dominantKey = Object.keys(keyFreq).reduce((a, b) => keyFreq[a] > keyFreq[b] ? a : b);
  
  return {
    stability: stability,
    modulations: keyChanges,
    dominant_key: dominantKey.replace('_', ' '),
    segment_keys: keys,
    key_distribution: keyFreq
  };
}

/**
 * Conta mudanças de tonalidade
 * @param {Array} keys 
 * @returns {number}
 */
function countKeyChanges(keys) {
  let changes = 0;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] !== keys[i - 1]) {
      changes++;
    }
  }
  return changes;
}

/**
 * Análise completa de tonalidade
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @param {number} sampleRate 
 * @returns {Promise<Object>}
 */
export async function analyzeKey(leftChannel, rightChannel, sampleRate) {
  console.log('🎼 Analisando tonalidade...');
  
  try {
    // Criar mix mono
    const monoMix = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoMix[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    // Análise global da tonalidade
    const globalChroma = await calculateChromaVector(monoMix, sampleRate);
    const keyDetection = detectKey(globalChroma);
    
    // Análise da progressão harmônica
    const harmonicProgression = await analyzeHarmonicProgression(monoMix, sampleRate);
    
    // Analisar modalidade (maior/menor)
    const modality = analyzeModality(globalChroma);
    
    const result = {
      // Tonalidade principal
      key: keyDetection.key,
      scale: keyDetection.scale,
      key_confidence: keyDetection.confidence,
      
      // Tonalidades alternativas
      alternative_keys: keyDetection.alternatives.map(alt => ({
        key: alt.root,
        scale: alt.scale,
        confidence: alt.correlation
      })),
      
      // Análise harmônica
      tonal_stability: harmonicProgression.stability,
      modulation_count: harmonicProgression.modulations,
      dominant_key: harmonicProgression.dominant_key,
      
      // Modalidade
      modality_score: modality.score,
      modality_descriptor: modality.descriptor,
      
      // Chroma features
      chroma_vector: keyDetection.chroma_vector,
      chroma_clarity: calculateChromaClarity(globalChroma),
      
      // Flags
      is_tonal: keyDetection.confidence > 0.4,
      is_stable: harmonicProgression.stability > 0.7,
      is_major: keyDetection.scale === 'major',
      has_modulations: harmonicProgression.modulations > 1,
      
      // Informações técnicas
      analysis_method: 'krumhansl_schmuckler',
      segments_analyzed: harmonicProgression.segment_keys?.length || 0
    };
    
    console.log('✅ Tonalidade analisada:', {
      'Key': `${result.key} ${result.scale}`,
      'Confiança': `${(result.key_confidence * 100).toFixed(0)}%`,
      'Estabilidade': `${(result.tonal_stability * 100).toFixed(0)}%`,
      'Modalidade': result.modality_descriptor
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro na análise de tonalidade:', error);
    throw error;
  }
}

/**
 * Analisa modalidade (major/minor characteristics)
 * @param {Float32Array} chromaVector 
 * @returns {Object}
 */
function analyzeModality(chromaVector) {
  // Calcular "brightness" baseado em intervalos
  // Terças maiores vs menores, quintas, etc.
  
  const majorIntervals = [0, 4, 7]; // C, E, G
  const minorIntervals = [0, 3, 7]; // C, Eb, G
  
  let majorScore = 0;
  let minorScore = 0;
  
  for (let root = 0; root < 12; root++) {
    // Score para tríade maior
    const majorTriadScore = majorIntervals.reduce((sum, interval) => {
      return sum + chromaVector[(root + interval) % 12];
    }, 0);
    
    // Score para tríade menor
    const minorTriadScore = minorIntervals.reduce((sum, interval) => {
      return sum + chromaVector[(root + interval) % 12];
    }, 0);
    
    majorScore += majorTriadScore;
    minorScore += minorTriadScore;
  }
  
  const totalScore = majorScore + minorScore;
  const modalityScore = totalScore > 0 ? (majorScore - minorScore) / totalScore : 0;
  
  let descriptor;
  if (modalityScore > 0.2) descriptor = 'bright/major';
  else if (modalityScore < -0.2) descriptor = 'dark/minor';
  else descriptor = 'modal/ambiguous';
  
  return {
    score: modalityScore,
    descriptor: descriptor,
    major_score: majorScore,
    minor_score: minorScore
  };
}

/**
 * Calcula claridade do chroma (concentração de energia)
 * @param {Float32Array} chromaVector 
 * @returns {number}
 */
function calculateChromaClarity(chromaVector) {
  // Calcular entropia do chroma
  const totalEnergy = chromaVector.reduce((sum, val) => sum + val, 0);
  
  if (totalEnergy === 0) return 0;
  
  let entropy = 0;
  for (let i = 0; i < 12; i++) {
    const probability = chromaVector[i] / totalEnergy;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  }
  
  // Claridade = 1 - (entropia normalizada)
  const maxEntropy = Math.log2(12); // Máxima entropia para 12 classes
  const clarity = 1 - (entropy / maxEntropy);
  
  return Math.max(0, Math.min(1, clarity));
}
