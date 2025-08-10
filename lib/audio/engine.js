// 🎵 AUDIO ANALYSIS ENGINE - FASE 2
// Engine principal que integra todas as features core

import { AUDIO_CONFIG, isFeatureEnabled, validateEnvironment } from './config.js';
import { decodeAudioBuffer, prepareAudioData, validateAudioData } from './decode.js';
import { decodeAudioSimple, prepareAudioSimple, validateAudioSimple } from './simple-decode.js';
import { analyzeLoudness } from './features/loudness.js';
import { analyzeTruePeak } from './features/truepeak.js';
import { analyzeSpectralFeatures } from './features/spectrum.js';
import { analyzeDynamics } from './features/level.js';
import { analyzeStereo } from './features/stereo.js';
import { analyzeTonalBalance } from './features/tonalbalance.js';
import { analyzeRhythm } from './features/rhythm.js';
import { analyzeKey } from './features/chroma.js';

/**
 * Engine principal de análise de áudio - Fase 2
 */
export class AudioAnalysisEngine {
  constructor() {
    this.config = AUDIO_CONFIG;
    this.warnings = [];
    this.analysisStartTime = null;
  }

  /**
   * Inicializar engine
   */
  async initialize() {
    console.log('🎵 Inicializando Audio Analysis Engine (Fase 2)...');
    
    // Validar ambiente
    const envWarnings = validateEnvironment();
    this.warnings.push(...envWarnings);
    
    // Verificar features habilitadas
    const enabledFeatures = Object.keys(this.config.FEATURES)
      .filter(feature => this.config.FEATURES[feature]);
    
    console.log('✅ Engine inicializado:', {
      features: enabledFeatures,
      timeout: `${this.config.PROCESSING.TIMEOUT_MS / 1000}s`,
      maxFileSize: `${this.config.PROCESSING.MAX_FILE_SIZE / (1024 * 1024)}MB`
    });

    return true;
  }

  /**
   * Detecta se está rodando no Node.js
   */
  isNodeJS() {
    return typeof globalThis.AudioContext === 'undefined' && 
           typeof globalThis.webkitAudioContext === 'undefined';
  }

  /**
   * Análise completa de áudio
   * @param {ArrayBuffer} audioBuffer - Buffer do arquivo de áudio
   * @returns {Promise<Object>} Resultado da análise
   */
  async analyzeAudio(audioBuffer) {
    this.analysisStartTime = Date.now();
    
    try {
      console.log('🔬 Iniciando análise completa...');

      // Validar tamanho
      if (audioBuffer.byteLength > this.config.PROCESSING.MAX_FILE_SIZE) {
        throw new Error(`Arquivo muito grande: ${(audioBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB (máx: ${this.config.PROCESSING.MAX_FILE_SIZE / (1024 * 1024)}MB)`);
      }

      // Detectar ambiente e usar decoder apropriado
      let decodedBuffer, audioData;
      
      if (this.isNodeJS()) {
        console.log('🖥️ Detectado Node.js - usando decoder simples');
        decodedBuffer = decodeAudioSimple(audioBuffer);
        audioData = prepareAudioSimple(decodedBuffer);
        validateAudioSimple(audioData);
      } else {
        console.log('🌐 Detectado Browser - usando Web Audio API');
        const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        decodedBuffer = await decodeAudioBuffer(audioBuffer, audioContext);
        audioData = await prepareAudioData(decodedBuffer, audioContext);
        validateAudioData(audioData);
        await audioContext.close();
      }

      // 2. Executar análises em paralelo (features core)
      const analysisPromises = [];

      // Loudness & LRA
      if (isFeatureEnabled('LOUDNESS')) {
        analysisPromises.push(
          this.executeFeature('loudness', () =>
            analyzeLoudness(audioData.left, audioData.right, audioData.sampleRate)
          )
        );
      }

      // True Peak
      if (isFeatureEnabled('TRUEPEAK')) {
        analysisPromises.push(
          this.executeFeature('truepeak', () =>
            analyzeTruePeak(audioData.left, audioData.right, audioContext)
          )
        );
      }

      // Spectral Features
      if (isFeatureEnabled('CENTROID') || isFeatureEnabled('ROLLOFF') || isFeatureEnabled('FLUX')) {
        analysisPromises.push(
          this.executeFeature('spectral', () =>
            analyzeSpectralFeatures(audioData.left, audioData.right, audioData.sampleRate, audioContext)
          )
        );
      }

      // Dynamics
      if (isFeatureEnabled('CREST') || isFeatureEnabled('DR')) {
        analysisPromises.push(
          this.executeFeature('dynamics', () =>
            analyzeDynamics(audioData.left, audioData.right)
          )
        );
      }

      // Stereo
      if (isFeatureEnabled('STEREO')) {
        analysisPromises.push(
          this.executeFeature('stereo', () =>
            analyzeStereo(audioData.left, audioData.right, audioData.sampleRate, audioContext)
          )
        );
      }

      // Tonal Balance
      if (isFeatureEnabled('TONALBALANCE')) {
        analysisPromises.push(
          this.executeFeature('tonalbalance', () =>
            analyzeTonalBalance(audioData.left, audioData.right, audioData.sampleRate, audioContext)
          )
        );
      }

      // BPM & Rhythm
      if (isFeatureEnabled('BPM')) {
        analysisPromises.push(
          this.executeFeature('rhythm', () =>
            analyzeRhythm(audioData.left, audioData.right, audioData.sampleRate)
          )
        );
      }

      // Key & Chroma
      if (isFeatureEnabled('KEY')) {
        analysisPromises.push(
          this.executeFeature('key', () =>
            analyzeKey(audioData.left, audioData.right, audioData.sampleRate)
          )
        );
      }

      // Aguardar todas as análises
      const analysisResults = await Promise.allSettled(analysisPromises);

      // 3. Compilar resultado final
      const result = await this.compileResults(audioData, analysisResults);

      // Cleanup
      audioContext.close();
      
      const processingTime = Date.now() - this.analysisStartTime;
      console.log(`✅ Análise completa em ${processingTime}ms`);

      return result;

    } catch (error) {
      console.error('❌ Erro na análise:', error);
      throw error;
    }
  }

  /**
   * Executa uma feature com timeout e error handling
   * @param {string} featureName 
   * @param {Function} featureFunc 
   * @returns {Promise<Object>}
   */
  async executeFeature(featureName, featureFunc) {
    const timeout = this.config.PROCESSING.TIMEOUT_MS / 4; // 1/4 do timeout total por feature

    try {
      const result = await Promise.race([
        featureFunc(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout: ${featureName}`)), timeout)
        )
      ]);

      return { feature: featureName, status: 'success', result };

    } catch (error) {
      console.warn(`⚠️  Feature ${featureName} falhou:`, error.message);
      this.warnings.push(`${featureName}: ${error.message}`);
      
      return { feature: featureName, status: 'failed', error: error.message };
    }
  }

  /**
   * Compila resultados de todas as features no schema final
   * @param {Object} audioData 
   * @param {Array} analysisResults 
   * @returns {Promise<Object>}
   */
  async compileResults(audioData, analysisResults) {
    // Inicializar resultado base
    const result = {
      ok: true,
      duration_sec: audioData.duration,
      sampleRate: audioData.sampleRate,
      channels: 2,
      
      // Schema compatível com frontend
      resumo: {
        peak_db: null,
        true_peak_dbtp: null,
        rms_mix_db: null,
        lufs_integrated: null,
        duration_sec: audioData.duration,
        dominant_freq_hz: null
      },

      loudness_headroom: {
        lufs_m: null,
        lufs_st: null,
        lufs_i: null,
        lra: null,
        headroom_db: null,
        stereo_width: null
      },

      tonal_balance: {
        sub: { rms_db: null, peak_db: null },
        low: { rms_db: null, peak_db: null },
        mid: { rms_db: null, peak_db: null },
        high: { rms_db: null, peak_db: null }
      },

      dinamica: {
        crest_factor_db: null,
        dynamic_range_db: null,
        lra: null
      },

      frequencia_timbre: {
        centroid_hz: null,
        rolloff85_hz: null,
        flux: null,
        harmonics_score: null,
        key: null,
        scale: null,
        key_confidence: null,
        spectrum_avg: null
      },

      masking_kick_bass: {
        indice_pct: null,
        overlap_db: null,
        sidechain_strength: null,
        times_sec: null,
        suggestion: null
      },

      stereo_fase: {
        correlation: null,
        balance_lr_db: null,
        bands_table: null
      },

      qualidade_problemas: {
        clipping_pct: null,
        dc_offset_pct: null,
        sibilancia_score: null,
        snr_db: null,
        codec_artifact_score: null,
        reverb_excess_score: null,
        fase_issues_score: null
      },

      ritmo_estrutura: {
        bpm: null,
        bpm_confidence: null,
        transients_per_min: null,
        silence_total_sec: null
      },

      mix_diagnostico: {
        mix_health: null,
        stereo_timeline: null,
        problem_frequencies_hz: null
      },

      warnings: this.warnings
    };

    // Processar resultados de cada feature
    for (const analysisResult of analysisResults) {
      if (analysisResult.status === 'fulfilled' && analysisResult.value.status === 'success') {
        const { feature, result: featureResult } = analysisResult.value;
        
        try {
          this.mapFeatureResult(result, feature, featureResult);
        } catch (error) {
          console.warn(`⚠️  Erro ao mapear resultado de ${feature}:`, error.message);
        }
      }
    }

    // Calcular métricas derivadas
    this.calculateDerivedMetrics(result);

    return result;
  }

  /**
   * Mapeia resultado de uma feature para o schema final
   * @param {Object} result 
   * @param {string} feature 
   * @param {Object} featureResult 
   */
  mapFeatureResult(result, feature, featureResult) {
    switch (feature) {
      case 'loudness':
        result.loudness_headroom.lufs_i = featureResult.lufs_integrated;
        result.loudness_headroom.lufs_m = featureResult.lufs_momentary;
        result.loudness_headroom.lufs_st = featureResult.lufs_short_term;
        result.loudness_headroom.lra = featureResult.lra;
        result.resumo.lufs_integrated = featureResult.lufs_integrated;
        result.dinamica.lra = featureResult.lra;
        break;

      case 'truepeak':
        result.resumo.true_peak_dbtp = featureResult.true_peak_dbtp;
        result.loudness_headroom.headroom_db = featureResult.headroom_db;
        break;

      case 'spectral':
        result.frequencia_timbre.centroid_hz = featureResult.centroid_hz;
        result.frequencia_timbre.rolloff85_hz = featureResult.rolloff85_hz;
        result.frequencia_timbre.flux = featureResult.flux;
        result.frequencia_timbre.spectrum_avg = featureResult.spectrum_avg;
        break;

      case 'dynamics':
        result.resumo.peak_db = featureResult.peak_db;
        result.resumo.rms_mix_db = featureResult.rms_db;
        result.dinamica.crest_factor_db = featureResult.crest_factor_db;
        result.dinamica.dynamic_range_db = featureResult.dynamic_range_db;
        result.qualidade_problemas.clipping_pct = featureResult.clipping_pct;
        result.qualidade_problemas.dc_offset_pct = featureResult.dc_offset_pct;
        result.qualidade_problemas.snr_db = featureResult.snr_db;
        break;

      case 'stereo':
        result.stereo_fase.correlation = featureResult.correlation;
        result.stereo_fase.balance_lr_db = featureResult.balance_db;
        result.loudness_headroom.stereo_width = featureResult.width;
        result.qualidade_problemas.fase_issues_score = featureResult.has_phase_issues ? 1 : 0;
        break;

      case 'tonalbalance':
        result.tonal_balance.sub = featureResult.sub;
        result.tonal_balance.low = featureResult.low;
        result.tonal_balance.mid = featureResult.mid;
        result.tonal_balance.high = featureResult.high;
        result.resumo.dominant_freq_hz = featureResult.dominant_frequency_hz;
        break;

      case 'rhythm':
        result.ritmo_estrutura.bpm = featureResult.bpm;
        result.ritmo_estrutura.bpm_confidence = featureResult.bpm_confidence;
        result.ritmo_estrutura.transients_per_min = featureResult.transients_per_min;
        break;

      case 'key':
        result.frequencia_timbre.key = featureResult.key;
        result.frequencia_timbre.scale = featureResult.scale;
        result.frequencia_timbre.key_confidence = featureResult.key_confidence;
        break;
    }
  }

  /**
   * Calcula métricas derivadas e scores
   * @param {Object} result 
   */
  calculateDerivedMetrics(result) {
    // Mix Health Score (0-100)
    let healthScore = 100;
    
    // Penalizar clipping
    if (result.qualidade_problemas.clipping_pct > 0.1) {
      healthScore -= Math.min(30, result.qualidade_problemas.clipping_pct * 10);
    }
    
    // Penalizar problemas de fase
    if (result.stereo_fase.correlation !== null && result.stereo_fase.correlation < 0.5) {
      healthScore -= 20;
    }
    
    // Penalizar dynamic range muito baixo
    if (result.dinamica.dynamic_range_db !== null && result.dinamica.dynamic_range_db < 5) {
      healthScore -= 15;
    }
    
    // Penalizar DC offset excessivo
    if (result.qualidade_problemas.dc_offset_pct > 1.0) {
      healthScore -= 10;
    }
    
    result.mix_diagnostico.mix_health = Math.max(0, Math.min(100, Math.round(healthScore)));

    // Calcular silence total (aproximação)
    result.ritmo_estrutura.silence_total_sec = this.estimateSilenceTime(result);
    
    // Frequency problems (lista de frequências problemáticas)
    result.mix_diagnostico.problem_frequencies_hz = this.identifyProblemFrequencies(result);
  }

  /**
   * Estima tempo total de silêncio
   * @param {Object} result 
   * @returns {number}
   */
  estimateSilenceTime(result) {
    // Estimativa baseada em dinâmica e transientes
    const duration = result.duration_sec;
    const transientsPerMin = result.ritmo_estrutura.transients_per_min || 60;
    
    // Menos transientes = mais silêncio potencial
    const silenceRatio = Math.max(0, 1 - (transientsPerMin / 120));
    return duration * silenceRatio * 0.1; // Máx 10% de silêncio
  }

  /**
   * Identifica frequências problemáticas
   * @param {Object} result 
   * @returns {number[]}
   */
  identifyProblemFrequencies(result) {
    const problems = [];
    
    // Verificar bandas de tonal balance
    const tb = result.tonal_balance;
    
    if (tb.low && tb.mid && tb.low.rms_db > tb.mid.rms_db + 6) {
      problems.push(120); // Muddy bass
    }
    
    if (tb.high && tb.mid && tb.high.rms_db > tb.mid.rms_db + 6) {
      problems.push(5000); // Harsh highs
    }
    
    if (tb.sub && tb.sub.rms_db > -20) {
      problems.push(40); // Excessive sub
    }
    
    return problems;
  }
}

// Export default instance
export const audioAnalysisEngine = new AudioAnalysisEngine();
