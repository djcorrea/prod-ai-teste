// 🧪 TESTE FASE 2 - Validação das 12 métricas core
// Teste rápido sem UI para verificar se as funções funcionam

console.log('🧪 Iniciando teste Phase 2...');

// Simular dados de áudio para teste
function generateTestAudio(duration = 1.0, sampleRate = 48000) {
  const samples = Math.floor(duration * sampleRate);
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  // Gerar sinal de teste (senoide + ruído)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    
    // Tom de 440Hz (A4) com harmônicos
    const fundamental = 0.5 * Math.sin(2 * Math.PI * 440 * t);
    const harmonic2 = 0.2 * Math.sin(2 * Math.PI * 880 * t);
    const harmonic3 = 0.1 * Math.sin(2 * Math.PI * 1320 * t);
    
    // Adicionar um pouco de ruído
    const noise = 0.01 * (Math.random() - 0.5);
    
    const signal = fundamental + harmonic2 + harmonic3 + noise;
    
    leftChannel[i] = signal;
    rightChannel[i] = signal * 0.9; // Slightly different for stereo
  }
  
  return { leftChannel, rightChannel, sampleRate };
}

// Teste das funções básicas
function testPhase2Functions() {
  console.log('🎯 Testando funções Phase 2...');
  
  const testAudio = generateTestAudio(2.0); // 2 segundos
  
  // Teste 1: Métricas básicas
  try {
    const basic = calculateBasicMetrics(testAudio.leftChannel, testAudio.rightChannel, testAudio.sampleRate);
    console.log('✅ Métricas básicas:', {
      peak: basic.peak_db.toFixed(1) + ' dB',
      rms: basic.rms_mix_db.toFixed(1) + ' dB', 
      clipping: basic.clipping_pct.toFixed(2) + '%'
    });
  } catch (err) {
    console.error('❌ Erro métricas básicas:', err.message);
  }
  
  // Teste 2: Dinâmica
  try {
    const dynamics = calculateDynamicsMetrics(testAudio.leftChannel, testAudio.rightChannel);
    console.log('✅ Dinâmica:', {
      crest: dynamics.crest_factor_db.toFixed(1) + ' dB',
      dr: dynamics.dynamic_range_db.toFixed(1) + ' dB'
    });
  } catch (err) {
    console.error('❌ Erro dinâmica:', err.message);
  }
  
  // Teste 3: Correlação estéreo
  try {
    const stereo = analyzeStereoCorrelation(testAudio.leftChannel, testAudio.rightChannel);
    console.log('✅ Estéreo:', {
      correlation: stereo.correlation.toFixed(3),
      balance: stereo.balance_lr_db.toFixed(1) + ' dB'
    });
  } catch (err) {
    console.error('❌ Erro estéreo:', err.message);
  }
  
  // Teste 4: Tonal Balance
  try {
    const tonal = calculateTonalBalance(testAudio.leftChannel, testAudio.rightChannel, testAudio.sampleRate);
    console.log('✅ Tonal Balance:', {
      sub: tonal.sub.rms_db.toFixed(1) + ' dB',
      low: tonal.low.rms_db.toFixed(1) + ' dB',
      mid: tonal.mid.rms_db.toFixed(1) + ' dB',
      high: tonal.high.rms_db.toFixed(1) + ' dB'
    });
  } catch (err) {
    console.error('❌ Erro tonal balance:', err.message);
  }
  
  console.log('🎯 Teste concluído!');
}

// Teste do mapeamento de compatibilidade
function testCompatibilityMapping() {
  console.log('🔄 Testando mapeamento de compatibilidade...');
  
  const mockAnalysis = {
    metadata: {
      duration: 2.0,
      sampleRate: 48000,
      channels: 2,
      fileSize: 1024,
      format: 'test'
    },
    metrics: {
      core: {
        peak_db: -3.2,
        rms_mix_db: -18.5,
        clipping_pct: 0.1
      },
      dynamics: {
        crest_factor_db: 15.3,
        dynamic_range_db: 12.4
      },
      stereo: {
        correlation: 0.85,
        balance_lr_db: 0.5
      }
    },
    diagnostics: {
      problems: ['Teste problem'],
      suggestions: ['Teste suggestion'],
      warnings: [],
      health_score: 85
    }
  };
  
  try {
    const mapped = mapToCompatibleSchema(mockAnalysis);
    console.log('✅ Schema mapeado com sucesso:', {
      peak: mapped.resumo.peak_db,
      rms: mapped.resumo.rms_mix_db,
      crest: mapped.dinamica.crest_factor_db,
      correlation: mapped.stereo_fase.correlation
    });
  } catch (err) {
    console.error('❌ Erro no mapeamento:', err.message);
  }
}

// Feature flags test
function testFeatureFlags() {
  console.log('🚩 Testando feature flags...');
  
  const flags = {
    LOUDNESS: true,
    TRUEPEAK: true,
    CREST_FACTOR: true,
    DYNAMIC_RANGE: true,
    CENTROID: true,
    ROLLOFF: true,
    FLUX: true,
    BPM: false,
    KEY_SCALE: false,
    STEREO_CORRELATION: true,
    TONAL_BALANCE: true
  };
  
  console.log('🚩 Feature flags ativas:', 
    Object.entries(flags).filter(([k, v]) => v).map(([k]) => k).join(', ')
  );
}

// Executar testes se executado diretamente
if (typeof module !== 'undefined' && require.main === module) {
  testFeatureFlags();
  testPhase2Functions();
  testCompatibilityMapping();
  
  console.log('🎉 Todos os testes Phase 2 concluídos!');
}

// Export para uso externo
if (typeof module !== 'undefined') {
  module.exports = {
    generateTestAudio,
    testPhase2Functions,
    testCompatibilityMapping,
    testFeatureFlags
  };
}
