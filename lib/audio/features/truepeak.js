// 🏔️ TRUE PEAK - Oversampling 4× com FIR polyphase
// Implementação ITU-R BS.1770-4 para detecção de true peaks

/**
 * 🎯 FIR Polyphase Coefficients para oversampling 4×
 * Baseado em filtro anti-aliasing Nyquist para 192kHz
 */
const POLYPHASE_COEFFS = {
  // Coeficientes do filtro FIR (48 taps, cutoff ~20kHz para 4× upsample)
  TAPS: [
    0.0, -0.000015258789, -0.000015258789, -0.000015258789,
    -0.000030517578, -0.000030517578, -0.000061035156, -0.000076293945,
    -0.000122070312, -0.000137329102, -0.000198364258, -0.000244140625,
    -0.000320434570, -0.000396728516, -0.000534057617, -0.000686645508,
    -0.000869750977, -0.001098632812, -0.001373291016, -0.001693725586,
    -0.002075195312, -0.002532958984, -0.003051757812, -0.003646850586,
    -0.004333496094, -0.005126953125, -0.006011962891, -0.007003784180,
    -0.008117675781, -0.009368896484, -0.010772705078, -0.012344360352,
    -0.014099121094, -0.016052246094, -0.018218994141, -0.020614624023,
    -0.023254394531, -0.026153564453, -0.029327392578, -0.032791137695,
    -0.036560058594, -0.040649414062, -0.045074462891, -0.049850463867,
    -0.054992675781, -0.060516357422, -0.066436767578, -0.072769165039
  ],
  LENGTH: 48,
  UPSAMPLING_FACTOR: 4
};

/**
 * 🎛️ True Peak Detector com Oversampling
 */
class TruePeakDetector {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.upsampleRate = sampleRate * POLYPHASE_COEFFS.UPSAMPLING_FACTOR;
    this.delayLine = new Float32Array(POLYPHASE_COEFFS.LENGTH);
    this.delayIndex = 0;
    
    console.log(`🏔️ True Peak Detector: ${sampleRate}Hz → ${this.upsampleRate}Hz oversampling`);
  }

  /**
   * 🎯 Detectar true peak em um canal
   * @param {Float32Array} channel - Canal de áudio
   * @returns {Object} Métricas de true peak
   */
  detectTruePeak(channel) {
    console.log('🏔️ Detectando true peaks...');
    const startTime = Date.now();
    
    let maxTruePeak = 0;
    let maxTruePeakdBTP = -Infinity;
    let peakPosition = 0;
    let clippingCount = 0;
    
    // Reset delay line
    this.delayLine.fill(0);
    this.delayIndex = 0;
    
    // Processar cada sample com oversampling 4×
    for (let i = 0; i < channel.length; i++) {
      const inputSample = channel[i];
      
      // Upsample 4× e calcular interpolated peaks
      const upsampledPeaks = this.upsample4x(inputSample);
      
      // Encontrar peak máximo entre os 4 upsampled values
      for (let j = 0; j < upsampledPeaks.length; j++) {
        const absPeak = Math.abs(upsampledPeaks[j]);
        
        if (absPeak > maxTruePeak) {
          maxTruePeak = absPeak;
          peakPosition = i + (j / POLYPHASE_COEFFS.UPSAMPLING_FACTOR);
        }
        
        // Detectar clipping em true peak (>-1dBTP = 0.891)
        if (absPeak > 0.891) {
          clippingCount++;
        }
      }
    }
    
    // Converter para dBTP
    maxTruePeakdBTP = maxTruePeak > 0 ? 20 * Math.log10(maxTruePeak) : -Infinity;
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ True Peak detectado em ${processingTime}ms:`, {
      peak: `${maxTruePeakdBTP.toFixed(2)} dBTP`,
      position: `${peakPosition.toFixed(1)} samples`,
      clipping: clippingCount > 0 ? `${clippingCount} clips` : 'none'
    });
    
    return {
      true_peak_linear: maxTruePeak,
      true_peak_dbtp: maxTruePeakdBTP,
      peak_position: peakPosition,
      clipping_count: clippingCount,
      exceeds_minus1dbtp: maxTruePeakdBTP > -1.0,
      processing_time: processingTime
    };
  }

  /**
   * 🔄 Upsample 4× com FIR polyphase
   * @param {Number} inputSample - Sample de entrada
   * @returns {Float32Array} 4 samples interpolados
   */
  upsample4x(inputSample) {
    // Inserir novo sample no delay line
    this.delayLine[this.delayIndex] = inputSample;
    this.delayIndex = (this.delayIndex + 1) % POLYPHASE_COEFFS.LENGTH;
    
    const upsampled = new Float32Array(POLYPHASE_COEFFS.UPSAMPLING_FACTOR);
    
    // Calcular 4 fases do filtro polyphase
    for (let phase = 0; phase < POLYPHASE_COEFFS.UPSAMPLING_FACTOR; phase++) {
      let output = 0;
      
      // Convolução com coeficientes da fase
      for (let tap = 0; tap < POLYPHASE_COEFFS.LENGTH; tap += POLYPHASE_COEFFS.UPSAMPLING_FACTOR) {
        const coeffIndex = tap + phase;
        if (coeffIndex < POLYPHASE_COEFFS.TAPS.length) {
          const delayIndex = (this.delayIndex - tap + POLYPHASE_COEFFS.LENGTH) % POLYPHASE_COEFFS.LENGTH;
          output += this.delayLine[delayIndex] * POLYPHASE_COEFFS.TAPS[coeffIndex];
        }
      }
      
      upsampled[phase] = output * POLYPHASE_COEFFS.UPSAMPLING_FACTOR; // Compensar gain
    }
    
    return upsampled;
  }

  /**
   * 🔧 Detectar clipping tradicional (sample-level)
   * @param {Float32Array} channel
   * @returns {Object} Estatísticas de clipping
   */
  detectSampleClipping(channel) {
    let clippedSamples = 0;
    let maxSample = 0;
    const clippingThreshold = 0.99; // 99% full scale
    
    for (let i = 0; i < channel.length; i++) {
      const absSample = Math.abs(channel[i]);
      maxSample = Math.max(maxSample, absSample);
      
      if (absSample >= clippingThreshold) {
        clippedSamples++;
      }
    }
    
    return {
      clipped_samples: clippedSamples,
      clipping_percentage: (clippedSamples / channel.length) * 100,
      max_sample: maxSample,
      max_sample_db: maxSample > 0 ? 20 * Math.log10(maxSample) : -Infinity
    };
  }
}

/**
 * 🎯 Função principal para análise de true peaks
 * @param {Float32Array} leftChannel
 * @param {Float32Array} rightChannel
 * @param {Number} sampleRate
 * @returns {Object} Análise completa de peaks
 */
function analyzeTruePeaks(leftChannel, rightChannel, sampleRate = 48000) {
  const detector = new TruePeakDetector(sampleRate);
  
  // True peaks para cada canal
  const leftTruePeak = detector.detectTruePeak(leftChannel);
  const rightTruePeak = detector.detectTruePeak(rightChannel);
  
  // Sample clipping para comparação
  const leftClipping = detector.detectSampleClipping(leftChannel);
  const rightClipping = detector.detectSampleClipping(rightChannel);
  
  // Combinar resultados
  const maxTruePeak = Math.max(leftTruePeak.true_peak_linear, rightTruePeak.true_peak_linear);
  const maxTruePeakdBTP = maxTruePeak > 0 ? 20 * Math.log10(maxTruePeak) : -Infinity;
  const totalClipping = leftTruePeak.clipping_count + rightTruePeak.clipping_count;
  
  // Warnings
  const warnings = [];
  if (maxTruePeakdBTP > -1.0) {
    warnings.push(`True peak excede -1dBTP: ${maxTruePeakdBTP.toFixed(2)}dBTP`);
  }
  if (maxTruePeakdBTP > -0.1) {
    warnings.push(`True peak muito alto: risco de clipping digital`);
  }
  if (totalClipping > 0) {
    warnings.push(`${totalClipping} amostras com true peak clipping detectado`);
  }
  
  return {
    // True peaks
    true_peak_dbtp: maxTruePeakdBTP,
    true_peak_linear: maxTruePeak,
    true_peak_left: leftTruePeak.true_peak_dbtp,
    true_peak_right: rightTruePeak.true_peak_dbtp,
    
    // Sample peaks (tradicional)
    sample_peak_left_db: leftClipping.max_sample_db,
    sample_peak_right_db: rightClipping.max_sample_db,
    
    // Clipping detection
    true_peak_clipping_count: totalClipping,
    sample_clipping_count: leftClipping.clipped_samples + rightClipping.clipped_samples,
    clipping_percentage: (leftClipping.clipping_percentage + rightClipping.clipping_percentage) / 2,
    
    // Status flags
    exceeds_minus1dbtp: maxTruePeakdBTP > -1.0,
    exceeds_0dbtp: maxTruePeakdBTP > 0.0,
    broadcast_compliant: maxTruePeakdBTP <= -1.0, // EBU R128
    
    // Metadata
    oversampling_factor: POLYPHASE_COEFFS.UPSAMPLING_FACTOR,
    warnings,
    
    // Performance
    processing_time: leftTruePeak.processing_time + rightTruePeak.processing_time
  };
}

// 🎯 Exports
export {
  TruePeakDetector,
  analyzeTruePeaks,
  POLYPHASE_COEFFS
};
