// 🎵 AUDIO ANALYZER API - FASE 2 INTEGRATION
// Integra o engine Fase 2 com o endpoint existente

import { audioAnalysisEngine } from '../lib/audio/engine.js';
import { AUDIO_CONFIG } from '../lib/audio/config.js';

/**
 * Adapter entre endpoint V2 e engine Fase 2
 * Mantém compatibilidade com frontend existente
 */
export async function performFase2Analysis(audioBuffer, config = {}) {
  try {
    console.log('🚀 Executando análise Fase 2...');
    
    // Inicializar engine se necessário
    if (!audioAnalysisEngine.initialized) {
      await audioAnalysisEngine.initialize();
      audioAnalysisEngine.initialized = true;
    }

    // Executar análise com engine Fase 2
    const fase2Result = await audioAnalysisEngine.analyzeAudio(audioBuffer);

    // Adaptar resultado para formato esperado pelo endpoint V2
    const adaptedResult = adaptFase2ResultToV2Format(fase2Result, config);

    console.log('✅ Análise Fase 2 concluída com sucesso');
    return adaptedResult;

  } catch (error) {
    console.error('❌ Erro na análise Fase 2:', error);
    
    // Fallback gracioso para análise básica se Fase 2 falhar
    console.log('🔄 Tentando fallback para análise básica...');
    return createBasicFallbackResult(audioBuffer, error);
  }
}

/**
 * Adapta resultado da Fase 2 para formato V2
 * @param {Object} fase2Result 
 * @param {Object} config 
 * @returns {Object}
 */
function adaptFase2ResultToV2Format(fase2Result, config) {
  return {
    // Manter estrutura V2 existente
    metrics: {
      // Dados básicos
      duration: fase2Result.duration_sec,
      sampleRate: fase2Result.sampleRate,
      channels: fase2Result.channels,

      // Níveis e dinâmica
      levels: {
        peak: fase2Result.resumo.peak_db,
        truePeak: fase2Result.resumo.true_peak_dbtp,
        rms: fase2Result.resumo.rms_mix_db,
        lufs: fase2Result.resumo.lufs_integrated,
        crestFactor: fase2Result.dinamica.crest_factor_db,
        dynamicRange: fase2Result.dinamica.dynamic_range_db
      },

      // Loudness (Fase 2)
      loudness: {
        integrated: fase2Result.loudness_headroom.lufs_i,
        momentary: fase2Result.loudness_headroom.lufs_m,
        shortTerm: fase2Result.loudness_headroom.lufs_st,
        lra: fase2Result.loudness_headroom.lra,
        headroom: fase2Result.loudness_headroom.headroom_db
      },

      // Espectral (Fase 2)
      spectral: {
        centroid: fase2Result.frequencia_timbre.centroid_hz,
        rolloff: fase2Result.frequencia_timbre.rolloff85_hz,
        flux: fase2Result.frequencia_timbre.flux,
        dominantFreq: fase2Result.resumo.dominant_freq_hz,
        spectrum: fase2Result.frequencia_timbre.spectrum_avg
      },

      // Estéreo (Fase 2)
      stereo: {
        correlation: fase2Result.stereo_fase.correlation,
        width: fase2Result.loudness_headroom.stereo_width,
        balance: fase2Result.stereo_fase.balance_lr_db,
        monoCompatible: fase2Result.stereo_fase.correlation > 0.7
      },

      // Tonal Balance (Fase 2)
      tonalBalance: {
        sub: fase2Result.tonal_balance.sub,
        low: fase2Result.tonal_balance.low,
        mid: fase2Result.tonal_balance.mid,
        high: fase2Result.tonal_balance.high
      },

      // Ritmo (Fase 2)
      rhythm: {
        bpm: fase2Result.ritmo_estrutura.bpm,
        confidence: fase2Result.ritmo_estrutura.bpm_confidence,
        transientsPerMin: fase2Result.ritmo_estrutura.transients_per_min
      },

      // Tonalidade (Fase 2)  
      key: {
        detected: fase2Result.frequencia_timbre.key,
        scale: fase2Result.frequencia_timbre.scale,
        confidence: fase2Result.frequencia_timbre.key_confidence
      },

      // Qualidade
      quality: {
        overall: fase2Result.mix_diagnostico.mix_health,
        clipping: fase2Result.qualidade_problemas.clipping_pct,
        dcOffset: fase2Result.qualidade_problemas.dc_offset_pct,
        snr: fase2Result.qualidade_problemas.snr_db,
        phaseIssues: fase2Result.qualidade_problemas.fase_issues_score > 0
      }
    },

    // Diagnósticos e problemas
    diagnostics: {
      mixHealth: fase2Result.mix_diagnostico.mix_health,
      problems: extractProblemsFromFase2(fase2Result),
      suggestions: generateSuggestionsFromFase2(fase2Result),
      warnings: fase2Result.warnings || []
    },

    // Metadados
    metadata: {
      version: 'fase2',
      featuresUsed: Object.keys(AUDIO_CONFIG.FEATURES).filter(f => AUDIO_CONFIG.FEATURES[f]),
      analysisEngine: 'fase2-core-12-metrics'
    }
  };
}

/**
 * Extrai problemas identificados na Fase 2
 * @param {Object} fase2Result 
 * @returns {Array}
 */
function extractProblemsFromFase2(fase2Result) {
  const problems = [];

  // Clipping
  if (fase2Result.qualidade_problemas.clipping_pct > 0.1) {
    problems.push({
      type: 'clipping',
      severity: fase2Result.qualidade_problemas.clipping_pct > 1 ? 'critical' : 'medium',
      message: `Clipping detectado em ${fase2Result.qualidade_problemas.clipping_pct.toFixed(1)}% do áudio`,
      solution: 'Reduzir níveis de entrada ou aplicar limitador'
    });
  }

  // True Peak
  if (fase2Result.resumo.true_peak_dbtp > -0.5) {
    problems.push({
      type: 'true_peak_high',
      severity: fase2Result.resumo.true_peak_dbtp > 0 ? 'critical' : 'high',
      message: `True Peak muito alto: ${fase2Result.resumo.true_peak_dbtp.toFixed(2)} dBTP`,
      solution: 'Aplicar limitador com ceiling em -0.1 dBTP'
    });
  }

  // Problemas de fase
  if (fase2Result.stereo_fase.correlation < 0.3) {
    problems.push({
      type: 'phase_issues',
      severity: fase2Result.stereo_fase.correlation < 0 ? 'critical' : 'high',
      message: 'Problemas de fase detectados - má compatibilidade mono',
      solution: 'Verificar polaridade e alinhamento temporal'
    });
  }

  // Dynamic Range muito baixo
  if (fase2Result.dinamica.dynamic_range_db < 3) {
    problems.push({
      type: 'over_compressed',
      severity: 'medium',
      message: `Range dinâmico muito baixo: ${fase2Result.dinamica.dynamic_range_db.toFixed(1)} dB`,
      solution: 'Reduzir compressão ou usar compressão multibanda'
    });
  }

  // Frequências problemáticas
  if (fase2Result.mix_diagnostico.problem_frequencies_hz?.length > 0) {
    problems.push({
      type: 'frequency_issues',
      severity: 'medium',
      message: 'Frequências problemáticas detectadas',
      solution: 'Aplicar EQ corretivo nas frequências identificadas',
      frequencies: fase2Result.mix_diagnostico.problem_frequencies_hz
    });
  }

  return problems;
}

/**
 * Gera sugestões baseadas no resultado da Fase 2
 * @param {Object} fase2Result 
 * @returns {Array}
 */
function generateSuggestionsFromFase2(fase2Result) {
  const suggestions = [];

  // Sugestões de mastering baseadas no LUFS
  if (fase2Result.resumo.lufs_integrated < -23) {
    suggestions.push({
      type: 'mastering',
      priority: 'medium',
      message: 'Áudio pode ser masterizado com mais volume',
      action: `Atual: ${fase2Result.resumo.lufs_integrated.toFixed(1)} LUFS - Considere -14 LUFS para streaming`
    });
  }

  // Sugestões de EQ baseadas no tonal balance
  const tb = fase2Result.tonal_balance;
  if (tb.low && tb.mid && tb.low.rms_db > tb.mid.rms_db + 6) {
    suggestions.push({
      type: 'eq',
      priority: 'high',
      message: 'Excesso de graves pode deixar o mix "enlameado"',
      action: 'Aplicar high-pass filter em ~80Hz ou reduzir graves em 120-250Hz'
    });
  }

  if (tb.high && tb.mid && tb.high.rms_db > tb.mid.rms_db + 8) {
    suggestions.push({
      type: 'eq',
      priority: 'high',
      message: 'Excesso de agudos pode soar agressivo',
      action: 'Suavizar região 3-8kHz ou aplicar de-esser'
    });
  }

  // Sugestões de compressão
  if (fase2Result.dinamica.crest_factor_db > 15) {
    suggestions.push({
      type: 'compression',
      priority: 'medium',
      message: 'Áudio tem muita dinâmica - pode beneficiar de compressão suave',
      action: 'Aplicar compressor com ratio 2:1 e attack/release médios'
    });
  }

  // Sugestões de correção estéreo
  if (Math.abs(fase2Result.stereo_fase.balance_lr_db) > 2) {
    suggestions.push({
      type: 'stereo_enhancement',
      priority: 'medium',
      message: 'Desbalanceamento L/R detectado',
      action: `Corrigir balance: ${fase2Result.stereo_fase.balance_lr_db.toFixed(1)}dB ${fase2Result.stereo_fase.balance_lr_db > 0 ? '(L mais alto)' : '(R mais alto)'}`
    });
  }

  return suggestions;
}

/**
 * Cria resultado de fallback em caso de erro na Fase 2
 * @param {ArrayBuffer} audioBuffer 
 * @param {Error} error 
 * @returns {Object}
 */
function createBasicFallbackResult(audioBuffer, error) {
  return {
    metrics: {
      duration: 0,
      sampleRate: 44100,
      channels: 2,
      levels: {
        peak: null,
        truePeak: null, 
        rms: null,
        lufs: null,
        crestFactor: null,
        dynamicRange: null
      },
      quality: {
        overall: 0
      }
    },
    diagnostics: {
      mixHealth: 0,
      problems: [{
        type: 'analysis_error',
        severity: 'critical',
        message: 'Erro na análise avançada - usando dados básicos',
        solution: 'Verifique se o arquivo está corrompido ou tente novamente'
      }],
      suggestions: [],
      warnings: [`Análise Fase 2 falhou: ${error.message}`]
    },
    metadata: {
      version: 'fallback',
      error: error.message,
      analysisEngine: 'basic-fallback'
    }
  };
}

console.log('🔧 Fase 2 Adapter carregado');
