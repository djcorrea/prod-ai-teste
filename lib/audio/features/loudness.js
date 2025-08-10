// 🔊 LOUDNESS & LRA - ITU-R BS.1770-4 / EBU R128
// Implementação completa do padrão LUFS com K-weighting e gating

/**
 * 📊 K-weighting Filter Coefficients (48kHz)
 * Pre-filter + RLB filter conforme ITU-R BS.1770-4
 */
const K_WEIGHTING_COEFFS = {
  // Pre-filter (shelving filter ~1.5kHz)
  PRE_FILTER: {
    b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
    a: [1.0, -1.69065929318241, 0.73248077421585]
  },
  // RLB filter (high-pass ~38Hz) 
  RLB_FILTER: {
    b: [1.0, -2.0, 1.0],
    a: [1.0, -1.99004745483398, 0.99007225036621]
  }
};

/**
 * 🎛️ LUFS Constants
 */
const LUFS_CONSTANTS = {
  ABSOLUTE_THRESHOLD: -70.0,    // LUFS absoluto
  RELATIVE_THRESHOLD: -10.0,    // LU relativo ao gated loudness
  BLOCK_DURATION: 0.4,          // 400ms blocks (M)
  SHORT_TERM_DURATION: 3.0,     // 3s short-term (S)
  INTEGRATED_OVERLAP: 0.75,     // 75% overlap entre blocks
  REFERENCE_LEVEL: -23.0        // EBU R128 reference
};

/**
 * 🔧 Biquad Filter Implementation
 */
class BiquadFilter {
  constructor(coeffs) {
    this.b = coeffs.b;
    this.a = coeffs.a;
    this.reset();
  }

  reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  process(input) {
    const output = this.b[0] * input + this.b[1] * this.x1 + this.b[2] * this.x2
                   - this.a[1] * this.y1 - this.a[2] * this.y2;
    
    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;
    
    return output;
  }

  processBuffer(inputBuffer, outputBuffer) {
    for (let i = 0; i < inputBuffer.length; i++) {
      outputBuffer[i] = this.process(inputBuffer[i]);
    }
  }
}

/**
 * 🎚️ K-weighting Filter Chain
 */
class KWeightingFilter {
  constructor() {
    this.preFilter = new BiquadFilter(K_WEIGHTING_COEFFS.PRE_FILTER);
    this.rlbFilter = new BiquadFilter(K_WEIGHTING_COEFFS.RLB_FILTER);
  }

  reset() {
    this.preFilter.reset();
    this.rlbFilter.reset();
  }

  processChannel(inputChannel) {
    const temp = new Float32Array(inputChannel.length);
    const output = new Float32Array(inputChannel.length);
    
    // Stage 1: Pre-filter
    this.preFilter.processBuffer(inputChannel, temp);
    
    // Stage 2: RLB filter  
    this.rlbFilter.processBuffer(temp, output);
    
    return output;
  }
}

/**
 * 🎯 LUFS Loudness Meter (ITU-R BS.1770-4)
 */
class LUFSMeter {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.blockSize = Math.round(sampleRate * LUFS_CONSTANTS.BLOCK_DURATION);
    this.shortTermSize = Math.round(sampleRate * LUFS_CONSTANTS.SHORT_TERM_DURATION);
    this.hopSize = Math.round(this.blockSize * (1 - LUFS_CONSTANTS.INTEGRATED_OVERLAP));
    
    this.kWeightingL = new KWeightingFilter();
    this.kWeightingR = new KWeightingFilter();
    
    console.log(`📊 LUFS Meter configurado: block=${this.blockSize}, hop=${this.hopSize}, ST=${this.shortTermSize}`);
  }

  /**
   * 🎛️ Calcular LUFS Integrado + LRA
   * @param {Float32Array} leftChannel
   * @param {Float32Array} rightChannel  
   * @returns {Object} Métricas LUFS
   */
  calculateLUFS(leftChannel, rightChannel) {
    console.log('🎛️ Calculando LUFS integrado...');
    const startTime = Date.now();
    
    // K-weighting nos canais
    const leftFiltered = this.kWeightingL.processChannel(leftChannel);
    const rightFiltered = this.kWeightingR.processChannel(rightChannel);
    
    // Calcular loudness de cada block (M = 400ms)
    const blockLoudness = this.calculateBlockLoudness(leftFiltered, rightFiltered);
    const shortTermLoudness = this.calculateShortTermLoudness(blockLoudness);
    
    // Gating para LUFS integrado
    const { integratedLoudness, gatedBlocks } = this.applyGating(blockLoudness);
    
    // LRA (Loudness Range)
    const lra = this.calculateLRA(shortTermLoudness);
    
    // Momentary peaks
    const momentaryPeaks = this.findMomentaryPeaks(blockLoudness);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ LUFS calculado em ${processingTime}ms:`, {
      integrated: `${integratedLoudness.toFixed(1)} LUFS`,
      lra: `${lra.toFixed(1)} LU`,
      gatedBlocks: `${gatedBlocks}/${blockLoudness.length}`
    });
    
    return {
      lufs_integrated: integratedLoudness,
      lufs_momentary: momentaryPeaks.max,
      lufs_short_term: shortTermLoudness.length > 0 ? shortTermLoudness[shortTermLoudness.length - 1] : integratedLoudness,
      lra: lra,
      gating_stats: {
        total_blocks: blockLoudness.length,
        gated_blocks: gatedBlocks,
        gating_efficiency: gatedBlocks / blockLoudness.length
      },
      processing_time: processingTime
    };
  }

  /**
   * 📊 Calcular loudness por block (M = 400ms)
   */
  calculateBlockLoudness(leftFiltered, rightFiltered) {
    const blocks = [];
    const numBlocks = Math.floor((leftFiltered.length - this.blockSize) / this.hopSize) + 1;
    
    for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
      const startSample = blockIdx * this.hopSize;
      const endSample = Math.min(startSample + this.blockSize, leftFiltered.length);
      
      let sumL = 0;
      let sumR = 0;
      const blockLength = endSample - startSample;
      
      for (let i = startSample; i < endSample; i++) {
        sumL += leftFiltered[i] * leftFiltered[i];
        sumR += rightFiltered[i] * rightFiltered[i];
      }
      
      // Mean square + channel weighting (L=1.0, R=1.0 para stereo)
      const meanSquareL = sumL / blockLength;
      const meanSquareR = sumR / blockLength;
      const totalMeanSquare = meanSquareL + meanSquareR;
      
      // Convert to LUFS (-0.691 offset para referência)
      const loudness = totalMeanSquare > 0 ? 
        -0.691 + 10 * Math.log10(totalMeanSquare) : 
        -Infinity;
      
      blocks.push({
        loudness,
        timestamp: startSample / this.sampleRate,
        meanSquareL,
        meanSquareR
      });
    }
    
    return blocks;
  }

  /**
   * ⏱️ Calcular Short-Term loudness (S = 3s)
   */
  calculateShortTermLoudness(blockLoudness) {
    const shortTerm = [];
    const blocksPerShortTerm = Math.ceil(LUFS_CONSTANTS.SHORT_TERM_DURATION / LUFS_CONSTANTS.BLOCK_DURATION);
    
    for (let i = 0; i <= blockLoudness.length - blocksPerShortTerm; i++) {
      let totalMeanSquare = 0;
      let validBlocks = 0;
      
      for (let j = i; j < i + blocksPerShortTerm; j++) {
        if (blockLoudness[j].loudness > -Infinity) {
          const block = blockLoudness[j];
          const blockMeanSquare = block.meanSquareL + block.meanSquareR;
          totalMeanSquare += blockMeanSquare;
          validBlocks++;
        }
      }
      
      if (validBlocks > 0) {
        const avgMeanSquare = totalMeanSquare / validBlocks;
        const stLoudness = avgMeanSquare > 0 ? 
          -0.691 + 10 * Math.log10(avgMeanSquare) : 
          -Infinity;
        shortTerm.push(stLoudness);
      }
    }
    
    return shortTerm;
  }

  /**
   * 🚪 Apply gating (absolute + relative)
   */
  applyGating(blockLoudness) {
    // Stage 1: Absolute threshold (-70 LUFS)
    const absoluteGated = blockLoudness.filter(block => 
      block.loudness >= LUFS_CONSTANTS.ABSOLUTE_THRESHOLD
    );
    
    if (absoluteGated.length === 0) {
      return { integratedLoudness: -Infinity, gatedBlocks: 0 };
    }
    
    // Calculate preliminary integrated loudness
    let totalMeanSquare = 0;
    for (const block of absoluteGated) {
      totalMeanSquare += block.meanSquareL + block.meanSquareR;
    }
    const preliminaryLoudness = -0.691 + 10 * Math.log10(totalMeanSquare / absoluteGated.length);
    
    // Stage 2: Relative threshold (preliminary - 10 LU)
    const relativeThreshold = preliminaryLoudness + LUFS_CONSTANTS.RELATIVE_THRESHOLD;
    const relativeGated = absoluteGated.filter(block => 
      block.loudness >= relativeThreshold
    );
    
    if (relativeGated.length === 0) {
      return { integratedLoudness: preliminaryLoudness, gatedBlocks: absoluteGated.length };
    }
    
    // Final integrated loudness
    let finalMeanSquare = 0;
    for (const block of relativeGated) {
      finalMeanSquare += block.meanSquareL + block.meanSquareR;
    }
    const integratedLoudness = -0.691 + 10 * Math.log10(finalMeanSquare / relativeGated.length);
    
    return { integratedLoudness, gatedBlocks: relativeGated.length };
  }

  /**
   * 📈 Calcular LRA (Loudness Range)
   */
  calculateLRA(shortTermLoudness) {
    if (shortTermLoudness.length === 0) return 0;
    
    // Filtrar valores válidos e ordenar
    const validValues = shortTermLoudness.filter(v => v > -Infinity).sort((a, b) => a - b);
    
    if (validValues.length < 2) return 0;
    
    // Percentis 10% e 95%
    const p10Index = Math.floor(validValues.length * 0.10);
    const p95Index = Math.floor(validValues.length * 0.95);
    
    const p10 = validValues[p10Index];
    const p95 = validValues[Math.min(p95Index, validValues.length - 1)];
    
    return p95 - p10; // LRA em LU
  }

  /**
   * 🏔️ Encontrar picos momentâneos
   */
  findMomentaryPeaks(blockLoudness) {
    const loudnessValues = blockLoudness
      .map(b => b.loudness)
      .filter(v => v > -Infinity);
    
    if (loudnessValues.length === 0) {
      return { max: -Infinity, min: -Infinity, avg: -Infinity };
    }
    
    return {
      max: Math.max(...loudnessValues),
      min: Math.min(...loudnessValues),  
      avg: loudnessValues.reduce((sum, v) => sum + v, 0) / loudnessValues.length
    };
  }
}

/**
 * 🎛️ Função principal para calcular LUFS/LRA
 * @param {Float32Array} leftChannel
 * @param {Float32Array} rightChannel
 * @param {Number} sampleRate
 * @returns {Object} Resultado LUFS completo
 */
function calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate = 48000) {
  const meter = new LUFSMeter(sampleRate);
  const result = meter.calculateLUFS(leftChannel, rightChannel);
  
  // Calcular headroom (em relação ao target -23 LUFS)
  const headroom = result.lufs_integrated > -Infinity ? 
    LUFS_CONSTANTS.REFERENCE_LEVEL - result.lufs_integrated : 
    Infinity;
  
  return {
    ...result,
    headroom_db: headroom,
    reference_level: LUFS_CONSTANTS.REFERENCE_LEVEL,
    meets_broadcast: result.lufs_integrated >= -24 && result.lufs_integrated <= -22
  };
}

// 🎯 Exports
export {
  LUFSMeter,
  KWeightingFilter,
  calculateLoudnessMetrics,
  LUFS_CONSTANTS,
  K_WEIGHTING_COEFFS
};
