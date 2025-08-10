// 🎵 DYNAMICS ANALYSIS - FASE 2
// Crest Factor, Dynamic Range, RMS/Peak levels

import { AUDIO_CONFIG } from '../config.js';

/**
 * Calcula RMS de um sinal
 * @param {Float32Array} samples 
 * @returns {number} RMS linear
 */
function calculateRMS(samples) {
  if (samples.length === 0) return 0;
  
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Calcula pico absoluto
 * @param {Float32Array} samples 
 * @returns {number} Pico linear
 */
function calculatePeak(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return peak;
}

/**
 * Calcula Crest Factor
 * @param {Float32Array} samples 
 * @returns {number} Crest Factor em dB
 */
function calculateCrestFactor(samples) {
  const rms = calculateRMS(samples);
  const peak = calculatePeak(samples);
  
  if (rms === 0 || peak === 0) return 0;
  
  const crestFactorLinear = peak / rms;
  return 20 * Math.log10(crestFactorLinear);
}

/**
 * Calcula Dynamic Range aproximado usando percentis
 * @param {Float32Array} samples 
 * @returns {number} Dynamic Range em dB
 */
function calculateDynamicRange(samples) {
  if (samples.length === 0) return 0;
  
  // Calcular RMS em janelas pequenas para capturar variações
  const windowSize = Math.floor(samples.length / 100); // 1% do áudio
  const rmsValues = [];
  
  for (let i = 0; i < samples.length - windowSize; i += windowSize) {
    const window = samples.slice(i, i + windowSize);
    const rms = calculateRMS(window);
    if (rms > 0) {
      rmsValues.push(20 * Math.log10(rms)); // Converter para dB
    }
  }
  
  if (rmsValues.length < 2) return 0;
  
  // Ordenar valores
  rmsValues.sort((a, b) => a - b);
  
  // Usar percentis 10% e 90% para estimar range dinâmico
  const lowIndex = Math.floor(rmsValues.length * 0.1);
  const highIndex = Math.floor(rmsValues.length * 0.9);
  
  const low = rmsValues[lowIndex];
  const high = rmsValues[highIndex];
  
  return Math.max(0, high - low);
}

/**
 * Detecta clipping
 * @param {Float32Array} samples 
 * @param {number} threshold 
 * @returns {Object}
 */
function detectClipping(samples, threshold = 0.99) {
  let clippedSamples = 0;
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const absSample = Math.abs(samples[i]);
    
    if (absSample >= threshold) {
      clippedSamples++;
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }
  
  const clippingPercentage = (clippedSamples / samples.length) * 100;
  
  return {
    clipped_samples: clippedSamples,
    clipping_percentage: clippingPercentage,
    max_consecutive: maxConsecutive,
    severe: clippingPercentage > 1.0 || maxConsecutive > 10
  };
}

/**
 * Calcula DC offset
 * @param {Float32Array} samples 
 * @returns {number} DC offset absoluto
 */
function calculateDCOffset(samples) {
  if (samples.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  
  return Math.abs(sum / samples.length);
}

/**
 * Análise completa de dinâmica e níveis
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @returns {Object}
 */
export function analyzeDynamics(leftChannel, rightChannel) {
  console.log('📊 Analisando dinâmica e níveis...');
  
  try {
    // Criar mix mono para análise global
    const monoMix = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoMix[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    // Calcular métricas por canal
    const leftMetrics = {
      rms: calculateRMS(leftChannel),
      peak: calculatePeak(leftChannel),
      crest_factor: calculateCrestFactor(leftChannel),
      dc_offset: calculateDCOffset(leftChannel),
      clipping: detectClipping(leftChannel)
    };
    
    const rightMetrics = {
      rms: calculateRMS(rightChannel),
      peak: calculatePeak(rightChannel),
      crest_factor: calculateCrestFactor(rightChannel),
      dc_offset: calculateDCOffset(rightChannel),
      clipping: detectClipping(rightChannel)
    };
    
    // Métricas globais (mix)
    const mixRMS = calculateRMS(monoMix);
    const mixPeak = calculatePeak(monoMix);
    const crestFactorDb = calculateCrestFactor(monoMix);
    const dynamicRangeDb = calculateDynamicRange(monoMix);
    
    // Detectar clipping global
    const globalClipping = detectClipping(monoMix);
    
    // Calcular SNR aproximado (Signal-to-Noise Ratio)
    const snrDb = estimateSNR(monoMix);
    
    const result = {
      // Níveis principais
      peak_db: mixPeak > 0 ? 20 * Math.log10(mixPeak) : -Infinity,
      rms_db: mixRMS > 0 ? 20 * Math.log10(mixRMS) : -Infinity,
      
      // Dinâmica
      crest_factor_db: crestFactorDb,
      dynamic_range_db: dynamicRangeDb,
      
      // Qualidade
      dc_offset_pct: (calculateDCOffset(monoMix) * 100),
      clipping_pct: globalClipping.clipping_percentage,
      snr_db: snrDb,
      
      // Por canal
      left_channel: {
        rms_db: leftMetrics.rms > 0 ? 20 * Math.log10(leftMetrics.rms) : -Infinity,
        peak_db: leftMetrics.peak > 0 ? 20 * Math.log10(leftMetrics.peak) : -Infinity,
        crest_factor_db: leftMetrics.crest_factor,
        dc_offset_pct: leftMetrics.dc_offset * 100,
        clipping_pct: leftMetrics.clipping.clipping_percentage
      },
      
      right_channel: {
        rms_db: rightMetrics.rms > 0 ? 20 * Math.log10(rightMetrics.rms) : -Infinity,
        peak_db: rightMetrics.peak > 0 ? 20 * Math.log10(rightMetrics.peak) : -Infinity,
        crest_factor_db: rightMetrics.crest_factor,
        dc_offset_pct: rightMetrics.dc_offset * 100,
        clipping_pct: rightMetrics.clipping.clipping_percentage
      },
      
      // Flags de problema
      has_clipping: globalClipping.clipping_percentage > 0.1,
      has_dc_issues: calculateDCOffset(monoMix) > AUDIO_CONFIG.THRESHOLDS.DC_OFFSET_MAX,
      is_over_compressed: crestFactorDb < 3.0, // Muito comprimido se CF < 3dB
      
      // Descritores
      dynamic_descriptor: describeDynamics(crestFactorDb, dynamicRangeDb),
      quality_descriptor: describeQuality(globalClipping.clipping_percentage, snrDb)
    };
    
    console.log('✅ Dinâmica analisada:', {
      'Peak': `${result.peak_db.toFixed(1)} dB`,
      'RMS': `${result.rms_db.toFixed(1)} dB`,
      'Crest Factor': `${result.crest_factor_db.toFixed(1)} dB`,
      'Dynamic Range': `${result.dynamic_range_db.toFixed(1)} dB`
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro na análise de dinâmica:', error);
    throw error;
  }
}

/**
 * Estima Signal-to-Noise Ratio
 * @param {Float32Array} samples 
 * @returns {number} SNR em dB
 */
function estimateSNR(samples) {
  // Método simplificado: comparar energia alta vs baixa
  const sortedSamples = Array.from(samples).map(Math.abs).sort((a, b) => b - a);
  
  const signalLevel = calculateRMS(new Float32Array(sortedSamples.slice(0, Math.floor(sortedSamples.length * 0.1))));
  const noiseLevel = calculateRMS(new Float32Array(sortedSamples.slice(Math.floor(sortedSamples.length * 0.9))));
  
  if (noiseLevel === 0 || signalLevel === 0) return Infinity;
  
  return 20 * Math.log10(signalLevel / noiseLevel);
}

/**
 * Descreve dinâmica baseado nas métricas
 * @param {number} crestFactor 
 * @param {number} dynamicRange 
 * @returns {string}
 */
function describeDynamics(crestFactor, dynamicRange) {
  if (crestFactor < 3 || dynamicRange < 5) return 'muito comprimido';
  if (crestFactor < 6 || dynamicRange < 12) return 'comprimido';
  if (crestFactor < 12 || dynamicRange < 20) return 'moderado';
  return 'dinâmico';
}

/**
 * Descreve qualidade baseado em clipping e SNR
 * @param {number} clippingPct 
 * @param {number} snrDb 
 * @returns {string}
 */
function describeQuality(clippingPct, snrDb) {
  if (clippingPct > 1.0) return 'problemático';
  if (clippingPct > 0.1 || snrDb < 40) return 'degradado';
  if (snrDb > 60) return 'excelente';
  return 'bom';
}
