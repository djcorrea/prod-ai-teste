// 🎵 TONAL BALANCE ANALYSIS - FASE 2
// RMS por banda (Sub/Low/Mid/High) segundo AUDIO_CONFIG.FREQUENCY_BANDS

import { AUDIO_CONFIG } from '../config.js';

/**
 * Extrai energia RMS de uma banda de frequência
 * @param {Float32Array} samples 
 * @param {Object} bandRange {min, max} em Hz
 * @param {number} sampleRate 
 * @param {AudioContext} audioContext 
 * @returns {Promise<number>} RMS em dB
 */
async function extractBandRMS(samples, bandRange, sampleRate, audioContext) {
  try {
    // Criar buffer de áudio
    const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    
    // Criar contexto offline para filtragem
    const offlineContext = new OfflineAudioContext(1, samples.length, sampleRate);
    const source = offlineContext.createBufferSource();
    
    // Filtros passa-banda
    const highpass = offlineContext.createBiquadFilter();
    const lowpass = offlineContext.createBiquadFilter();
    
    source.buffer = buffer;
    
    // Configurar filtros
    highpass.type = 'highpass';
    highpass.frequency.value = Math.max(1, bandRange.min); // Evitar 0 Hz
    highpass.Q.value = 0.7071;
    
    lowpass.type = 'lowpass';  
    lowpass.frequency.value = Math.min(sampleRate / 2, bandRange.max); // Evitar Nyquist
    lowpass.Q.value = 0.7071;
    
    // Conectar: source → highpass → lowpass → destination
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(offlineContext.destination);
    
    source.start();
    const filteredBuffer = await offlineContext.startRendering();
    const filteredData = filteredBuffer.getChannelData(0);
    
    // Calcular RMS da banda filtrada
    let sumSquares = 0;
    for (let i = 0; i < filteredData.length; i++) {
      sumSquares += filteredData[i] * filteredData[i];
    }
    
    const rms = Math.sqrt(sumSquares / filteredData.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    
  } catch (error) {
    console.warn(`⚠️  Filtragem da banda ${bandRange.min}-${bandRange.max}Hz falhou`);
    return -Infinity;
  }
}

/**
 * Extrai pico de uma banda de frequência
 * @param {Float32Array} samples 
 * @param {Object} bandRange 
 * @param {number} sampleRate 
 * @param {AudioContext} audioContext 
 * @returns {Promise<number>} Pico em dB
 */
async function extractBandPeak(samples, bandRange, sampleRate, audioContext) {
  try {
    // Mesmo processo de filtragem do RMS
    const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    
    const offlineContext = new OfflineAudioContext(1, samples.length, sampleRate);
    const source = offlineContext.createBufferSource();
    const highpass = offlineContext.createBiquadFilter();
    const lowpass = offlineContext.createBiquadFilter();
    
    source.buffer = buffer;
    
    highpass.type = 'highpass';
    highpass.frequency.value = Math.max(1, bandRange.min);
    highpass.Q.value = 0.7071;
    
    lowpass.type = 'lowpass';
    lowpass.frequency.value = Math.min(sampleRate / 2, bandRange.max);
    lowpass.Q.value = 0.7071;
    
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(offlineContext.destination);
    
    source.start();
    const filteredBuffer = await offlineContext.startRendering();
    const filteredData = filteredBuffer.getChannelData(0);
    
    // Encontrar pico máximo
    let peak = 0;
    for (let i = 0; i < filteredData.length; i++) {
      peak = Math.max(peak, Math.abs(filteredData[i]));
    }
    
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    
  } catch (error) {
    console.warn(`⚠️  Análise de pico da banda ${bandRange.min}-${bandRange.max}Hz falhou`);
    return -Infinity;
  }
}

/**
 * Análise simplificada usando espectro (fallback)
 * @param {Float32Array} samples 
 * @param {Object} bandRange 
 * @param {number} sampleRate 
 * @returns {Promise<{rms_db: number, peak_db: number}>}
 */
async function analyzeBandSpectral(samples, bandRange, sampleRate) {
  try {
    // DFT simples para análise espectral
    const fftSize = Math.min(4096, Math.pow(2, Math.floor(Math.log2(samples.length))));
    const spectrum = await computeSimpleSpectrum(samples.slice(0, fftSize));
    
    // Converter range de frequência para bins
    const minBin = Math.floor((bandRange.min * fftSize) / sampleRate);
    const maxBin = Math.ceil((bandRange.max * fftSize) / sampleRate);
    
    let bandEnergy = 0;
    let bandPeak = 0;
    let binCount = 0;
    
    for (let bin = minBin; bin <= maxBin && bin < spectrum.length; bin++) {
      const magnitude = spectrum[bin];
      bandEnergy += magnitude * magnitude;
      bandPeak = Math.max(bandPeak, magnitude);
      binCount++;
    }
    
    if (binCount === 0) {
      return { rms_db: -Infinity, peak_db: -Infinity };
    }
    
    const rms = Math.sqrt(bandEnergy / binCount);
    
    return {
      rms_db: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
      peak_db: bandPeak > 0 ? 20 * Math.log10(bandPeak) : -Infinity
    };
    
  } catch (error) {
    console.warn('⚠️  Análise espectral falhou');
    return { rms_db: -Infinity, peak_db: -Infinity };
  }
}

/**
 * Computa espectro simples usando DFT
 * @param {Float32Array} samples 
 * @returns {Float32Array}
 */
async function computeSimpleSpectrum(samples) {
  const N = samples.length;
  const spectrum = new Float32Array(Math.floor(N / 2));
  
  for (let k = 0; k < spectrum.length; k++) {
    let realPart = 0;
    let imagPart = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      realPart += samples[n] * Math.cos(angle);
      imagPart += samples[n] * Math.sin(angle);
    }
    
    spectrum[k] = Math.sqrt(realPart * realPart + imagPart * imagPart) / N;
  }
  
  return spectrum;
}

/**
 * Calcula frequência dominante no espectro
 * @param {Float32Array} samples 
 * @param {number} sampleRate 
 * @returns {Promise<number>} Frequência em Hz
 */
async function findDominantFrequency(samples, sampleRate) {
  try {
    const spectrum = await computeSimpleSpectrum(samples);
    
    let maxMagnitude = 0;
    let maxBin = 0;
    
    // Ignorar primeiros bins (DC e muito baixa freq)
    for (let bin = 5; bin < spectrum.length; bin++) {
      if (spectrum[bin] > maxMagnitude) {
        maxMagnitude = spectrum[bin];
        maxBin = bin;
      }
    }
    
    // Converter bin para frequência
    const frequency = (maxBin * sampleRate) / (spectrum.length * 2);
    
    return Math.round(frequency);
    
  } catch (error) {
    console.warn('⚠️  Detecção de freq. dominante falhou');
    return 1000; // Fallback
  }
}

/**
 * Análise completa de tonal balance
 * @param {Float32Array} leftChannel 
 * @param {Float32Array} rightChannel 
 * @param {number} sampleRate 
 * @param {AudioContext} audioContext 
 * @returns {Promise<Object>}
 */
export async function analyzeTonalBalance(leftChannel, rightChannel, sampleRate, audioContext) {
  console.log('🎛️  Analisando tonal balance...');
  
  try {
    // Criar mix mono para análise
    const monoMix = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoMix[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    const bands = AUDIO_CONFIG.FREQUENCY_BANDS;
    const bandResults = {};
    
    // Analisar cada banda
    for (const [bandName, bandRange] of Object.entries(bands)) {
      console.log(`🔧 Analisando banda ${bandName} (${bandRange.min}-${bandRange.max}Hz)...`);
      
      let bandData;
      
      if (audioContext && typeof audioContext.createBiquadFilter === 'function') {
        // Método preferido com filtros Web Audio
        try {
          const rms_db = await extractBandRMS(monoMix, bandRange, sampleRate, audioContext);
          const peak_db = await extractBandPeak(monoMix, bandRange, sampleRate, audioContext);
          
          bandData = { rms_db, peak_db };
        } catch (error) {
          console.warn(`⚠️  Filtragem falhou para ${bandName}, usando método espectral`);
          bandData = await analyzeBandSpectral(monoMix, bandRange, sampleRate);
        }
      } else {
        // Fallback espectral
        bandData = await analyzeBandSpectral(monoMix, bandRange, sampleRate);
      }
      
      bandResults[bandName] = bandData;
    }
    
    // Encontrar frequência dominante
    const dominantFreq = await findDominantFrequency(monoMix, sampleRate);
    
    // Calcular balance relativo entre bandas
    const balance = calculateTonalBalanceRatios(bandResults);
    
    const result = {
      // Por banda (compatível com frontend)
      sub: bandResults.SUB,
      low: bandResults.LOW,
      mid: bandResults.MID,
      high: bandResults.HIGH,
      
      // Frequência dominante global
      dominant_frequency_hz: dominantFreq,
      
      // Ratios e balance
      balance_ratios: balance,
      
      // Descritores
      tonal_descriptor: describeTonalCharacter(bandResults),
      balance_descriptor: describeBalance(balance),
      
      // Flags de problema
      is_muddy: bandResults.LOW.rms_db > bandResults.MID.rms_db + 3,
      is_bright: bandResults.HIGH.rms_db > bandResults.MID.rms_db + 6,
      is_thin: bandResults.LOW.rms_db < bandResults.MID.rms_db - 6,
      is_harsh: bandResults.HIGH.rms_db > -10, // Muito alto em alta freq
      
      // Informações técnicas
      analysis_method: audioContext ? 'filtered' : 'spectral',
      sample_rate: sampleRate
    };
    
    console.log('✅ Tonal balance analisado:', {
      'Sub': `${result.sub.rms_db.toFixed(1)}dB`,
      'Low': `${result.low.rms_db.toFixed(1)}dB`, 
      'Mid': `${result.mid.rms_db.toFixed(1)}dB`,
      'High': `${result.high.rms_db.toFixed(1)}dB`,
      'Dominante': `${result.dominant_frequency_hz}Hz`
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro na análise de tonal balance:', error);
    throw error;
  }
}

/**
 * Calcula ratios entre bandas
 * @param {Object} bandResults 
 * @returns {Object}
 */
function calculateTonalBalanceRatios(bandResults) {
  const { SUB, LOW, MID, HIGH } = bandResults;
  
  return {
    low_mid_ratio: LOW.rms_db - MID.rms_db,
    mid_high_ratio: MID.rms_db - HIGH.rms_db,
    sub_low_ratio: SUB.rms_db - LOW.rms_db,
    bass_treble_ratio: ((SUB.rms_db + LOW.rms_db) / 2) - ((MID.rms_db + HIGH.rms_db) / 2),
    
    // Slopes (inclinação espectral)
    low_slope: MID.rms_db - LOW.rms_db,
    high_slope: HIGH.rms_db - MID.rms_db
  };
}

/**
 * Descreve caráter tonal
 * @param {Object} bandResults 
 * @returns {string}
 */
function describeTonalCharacter(bandResults) {
  const { SUB, LOW, MID, HIGH } = bandResults;
  
  // Encontrar banda dominante
  const levels = [
    { name: 'sub', level: SUB.rms_db },
    { name: 'low', level: LOW.rms_db },
    { name: 'mid', level: MID.rms_db },
    { name: 'high', level: HIGH.rms_db }
  ];
  
  levels.sort((a, b) => b.level - a.level);
  
  const dominant = levels[0].name;
  const difference = levels[0].level - levels[1].level;
  
  if (difference < 2) return 'balanceado';
  if (dominant === 'sub') return 'muito grave';
  if (dominant === 'low') return 'encorpado';
  if (dominant === 'mid') return 'vocal/presença';
  if (dominant === 'high') return 'brilhante';
  
  return 'neutro';
}

/**
 * Descreve balance geral
 * @param {Object} balance 
 * @returns {string}
 */
function describeBalance(balance) {
  const bassTreeble = Math.abs(balance.bass_treble_ratio);
  
  if (bassTreeble < 2) return 'bem balanceado';
  if (balance.bass_treble_ratio > 2) return 'graves dominantes';
  if (balance.bass_treble_ratio < -2) return 'agudos dominantes';
  
  return 'ligeiramente desbalanceado';
}
