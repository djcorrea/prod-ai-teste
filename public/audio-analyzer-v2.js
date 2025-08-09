// 🎵 AUDIO ANALYZER V2 - Motor de Análise Frontend
// Sistema avançado de análise de áudio com Web Audio API + bibliotecas especializadas

// Meyda e Zod são carregados via CDN como variáveis globais
// const Meyda = window.Meyda;
// const { z } = window.Zod;

class AudioAnalyzerV2 {
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;
    this.config = {
      version: '2.0',
      enableAdvanced: false,
      quality: 'balanced', // fast, balanced, accurate
      maxFileSize: 25 * 1024 * 1024, // 25MB
      timeout: 45000 // 45 segundos
    };
    
    console.log('🎵 Audio Analyzer V2 initialized');
  }

  // 🎤 Inicializar contexto de áudio
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Configurar Meyda
      if (typeof Meyda !== 'undefined') {
        Meyda.audioContext = this.audioContext;
        console.log('✅ Meyda configurado com sucesso');
      } else {
        console.warn('⚠️ Meyda não disponível - análise espectral limitada');
      }
      
      this.isInitialized = true;
      console.log('🎵 Audio Analyzer V2 inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Audio Analyzer V2:', error);
      return false;
    }
  }

  // 📁 Analisar arquivo de áudio (método principal)
  async analyzeFile(file, options = {}) {
    console.log(`🎵 Iniciando análise V2 de: ${file.name} (${this.formatFileSize(file.size)})`);
    
    // Validações iniciais
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    const config = {
      ...this.config,
      ...options,
      features: options.features || ['core', 'spectral', 'stereo'],
      enableAdvanced: options.enableAdvanced || false
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout na análise (${config.timeout}ms)`));
      }, config.timeout);

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          clearTimeout(timeout);
          const arrayBuffer = e.target.result;
          
          // Decodificar áudio
          console.log('🔬 Decodificando áudio...');
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          
          // Realizar análise completa
          console.log('📊 Realizando análise completa V2...');
          const analysis = await this.performFullAnalysis(audioBuffer, config);
          
          console.log('✅ Análise V2 concluída!', {
            duration: `${audioBuffer.duration.toFixed(1)}s`,
            features: Object.keys(analysis.metrics).length,
            problems: analysis.diagnostics.problems.length,
            score: analysis.metrics.quality?.overall || 'N/A'
          });
          
          resolve(analysis);
        } catch (error) {
          clearTimeout(timeout);
          console.error('❌ Erro na análise V2:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Erro ao ler arquivo'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  // 🔬 Análise completa (core do sistema)
  async performFullAnalysis(audioBuffer, config) {
    const startTime = performance.now();
    const steps = [];
    const warnings = [];
    const analysisPerformance = {};

    try {
      // Metadados básicos
      steps.push('metadata');
      const metadata = {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        estimatedFileSize: Math.round(audioBuffer.duration * audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2)
      };

      // Preparar canais
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

      // 1. ANÁLISE CORE (sempre executada)
      if (config.features.includes('core')) {
        steps.push('core_analysis');
        const coreStart = performance.now();
        
        const coreMetrics = await this.analyzeCoreMetrics(leftChannel, rightChannel);
        analysisPerformance.core = performance.now() - coreStart;
        
        var metrics = { core: coreMetrics };
      }

      // 2. ANÁLISE ESPECTRAL
      if (config.features.includes('spectral')) {
        steps.push('spectral_analysis');
        const spectralStart = performance.now();
        
        const spectralMetrics = await this.analyzeSpectralFeatures(leftChannel, audioBuffer.sampleRate, config.quality);
        analysisPerformance.spectral = performance.now() - spectralStart;
        
        // Merge com core metrics
        metrics.core = { ...metrics.core, ...spectralMetrics };
      }

      // 3. ANÁLISE ESTÉREO
      if (config.features.includes('stereo') && rightChannel) {
        steps.push('stereo_analysis');
        const stereoStart = performance.now();
        
        metrics.stereo = this.analyzeStereoMetrics(leftChannel, rightChannel);
        analysisPerformance.stereo = performance.now() - stereoStart;
      }

      // 4. SCORES DE QUALIDADE
      if (config.features.includes('quality') || config.features.includes('core')) {
        steps.push('quality_scoring');
        const qualityStart = performance.now();
        
        metrics.quality = this.calculateQualityScores(metrics);
        analysisPerformance.quality = performance.now() - qualityStart;
      }

      // 5. DIAGNÓSTICO
      steps.push('diagnostics');
      const diagnosticsStart = performance.now();
      
      const diagnostics = this.generateDiagnostics(metrics, metadata);
      analysisPerformance.diagnostics = performance.now() - diagnosticsStart;

      // 6. MÉTRICAS AVANÇADAS (futuro)
      if (config.enableAdvanced) {
        steps.push('advanced_metrics');
        warnings.push('Métricas avançadas ainda não implementadas no frontend');
      }

      const totalTime = performance.now() - startTime;
      
      return {
        version: '2.0',
        timestamp: new Date().toISOString(),
        processingTime: Math.round(totalTime),
        metadata,
        config,
        metrics,
        diagnostics,
        debug: {
          analysisSteps: steps,
          warnings,
          performance: {
            ...analysisPerformance,
            total: Math.round(totalTime)
          }
        }
      };

    } catch (error) {
      console.error('❌ Erro na análise completa:', error);
      throw new Error(`Falha na análise: ${error.message}`);
    }
  }

  // 🎯 ANÁLISE CORE METRICS
  async analyzeCoreMetrics(leftChannel, rightChannel) {
    console.log('🔬 Analisando métricas core...');
    
    // Variáveis de acumulação
    let peak = 0;
    let sumSquared = 0;
    let dcSum = 0;
    let clippedSamples = 0;
    const length = leftChannel.length;

    // Análise sample por sample
    for (let i = 0; i < length; i++) {
      const sample = leftChannel[i];
      const absSample = Math.abs(sample);
      
      // Peak detection
      if (absSample > peak) peak = absSample;
      
      // RMS calculation
      sumSquared += sample * sample;
      
      // DC offset
      dcSum += sample;
      
      // Clipping detection (threshold: 95%)
      if (absSample >= 0.95) clippedSamples++;
    }
    
    // Calcular métricas
    const rms = Math.sqrt(sumSquared / length);
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const dynamicRange = isFinite(peakDb) && isFinite(rmsDb) ? Math.max(0, peakDb - rmsDb) : 0;
    const crestFactor = peak / (rms + 1e-10);
    const dcOffset = dcSum / length;
    const clippingPercentage = (clippedSamples / length) * 100;

    console.log(`📊 Core metrics: Peak=${peakDb.toFixed(1)}dB, RMS=${rmsDb.toFixed(1)}dB, DR=${dynamicRange.toFixed(1)}dB`);

    return {
      peak: peakDb,
      rms: rmsDb,
      dynamicRange,
      crestFactor,
      dcOffset,
      clippingEvents: clippedSamples,
      clippingPercentage,
      // dominantFrequencies será preenchido na análise espectral
      dominantFrequencies: []
    };
  }

  // 🌈 ANÁLISE ESPECTRAL COM MEYDA
  async analyzeSpectralFeatures(channelData, sampleRate, quality = 'balanced') {
    console.log('🎯 Analisando características espectrais...');
    
    try {
      // Configurações baseadas na qualidade
      const configs = {
        fast: { frameSize: 512, hopSize: 256, maxFrames: 50 },
        balanced: { frameSize: 1024, hopSize: 512, maxFrames: 100 },
        accurate: { frameSize: 2048, hopSize: 1024, maxFrames: 200 }
      };
      
      const config = configs[quality] || configs.balanced;
      const { frameSize, hopSize, maxFrames } = config;

      // Coletar features de múltiplas janelas
      const features = [];
      const dominantFrequencies = [];
      let frameCount = 0;

      for (let i = 0; i < channelData.length - frameSize && frameCount < maxFrames; i += hopSize) {
        try {
          const frame = channelData.slice(i, i + frameSize);
          
          // Extrair features com Meyda
          let frameFeatures = null;
          if (typeof Meyda !== 'undefined') {
            frameFeatures = Meyda.extract([
              'spectralCentroid',
              'spectralRolloff', 
              'spectralFlux',
              'spectralFlatness'
            ], frame);
          }
          
          // Validar features
          if (frameFeatures && 
              !isNaN(frameFeatures.spectralCentroid) && 
              frameFeatures.spectralCentroid > 0) {
            features.push(frameFeatures);
          }
          
          // Análise de frequências dominantes (FFT própria)
          const spectrum = this.computeFFT(frame);
          const dominantFreq = this.findDominantFrequency(spectrum, sampleRate);
          
          if (dominantFreq > 20 && dominantFreq < 20000) {
            dominantFrequencies.push({
              frequency: dominantFreq,
              magnitude: this.getFrequencyMagnitude(spectrum, dominantFreq, sampleRate),
              frame: frameCount
            });
          }
          
          frameCount++;
        } catch (err) {
          // Ignorar frames problemáticos
          continue;
        }
      }

      console.log(`🎯 Analisadas ${frameCount} janelas espectrais`);

      // Se não conseguiu extrair features, usar fallback
      if (features.length === 0) {
        console.warn('⚠️ Meyda features indisponíveis, usando análise básica');
        return {
          spectralCentroid: null,
          spectralRolloff: null,
          spectralFlux: null,
          spectralFlatness: null,
          dominantFrequencies: this.groupDominantFrequencies(dominantFrequencies).slice(0, 8)
        };
      }

      // Calcular médias das features
      const avgCentroid = this.calculateAverage(features.map(f => f.spectralCentroid));
      const avgRolloff = this.calculateAverage(features.map(f => f.spectralRolloff));
      const avgFlux = this.calculateAverage(features.map(f => f.spectralFlux));
      const avgFlatness = this.calculateAverage(features.map(f => f.spectralFlatness));

      // Processar frequências dominantes
      const groupedFreqs = this.groupDominantFrequencies(dominantFrequencies);

      console.log(`🎯 Features espectrais: Centroid=${avgCentroid?.toFixed(0)}Hz, ${groupedFreqs.length} frequências dominantes`);

      return {
        spectralCentroid: avgCentroid,
        spectralRolloff: avgRolloff,
        spectralFlux: avgFlux,
        spectralFlatness: avgFlatness,
        dominantFrequencies: groupedFreqs.slice(0, 8)
      };

    } catch (error) {
      console.warn('⚠️ Erro na análise espectral:', error);
      return {
        spectralCentroid: null,
        spectralRolloff: null,
        spectralFlux: null,
        spectralFlatness: null,
        dominantFrequencies: []
      };
    }
  }

  // 🎵 ANÁLISE ESTÉREO
  analyzeStereoMetrics(leftChannel, rightChannel) {
    console.log('🔊 Analisando métricas estéreo...');
    
    let correlation = 0;
    let leftPower = 0;
    let rightPower = 0;
    let midPower = 0;
    let sidePower = 0;
    
    const length = Math.min(leftChannel.length, rightChannel.length);
    
    // Análise sample por sample
    for (let i = 0; i < length; i++) {
      const left = leftChannel[i];
      const right = rightChannel[i];
      
      // Correlação cruzada
      correlation += left * right;
      
      // Potência dos canais
      leftPower += left * left;
      rightPower += right * right;
      
      // Análise Mid/Side
      const mid = (left + right) / 2;
      const side = (left - right) / 2;
      midPower += mid * mid;
      sidePower += side * side;
    }
    
    // Normalização
    correlation /= length;
    leftPower /= length;
    rightPower /= length;
    midPower /= length;
    sidePower /= length;
    
    // Cálculos finais
    const totalPower = leftPower + rightPower;
    const balance = totalPower > 0 ? (rightPower - leftPower) / totalPower : 0;
    const width = midPower > 0 ? Math.sqrt(sidePower / midPower) : 0;
    
    // Compatibilidade mono
    let monoCompatibility = 'excellent';
    if (correlation < 0.5) monoCompatibility = 'poor';
    else if (correlation < 0.7) monoCompatibility = 'fair';
    else if (correlation < 0.9) monoCompatibility = 'good';
    
    const phaseIssues = correlation < 0.3;
    
    console.log(`🔊 Estéreo: Correlação=${correlation.toFixed(2)}, Width=${width.toFixed(2)}, Compatibilidade=${monoCompatibility}`);
    
    return {
      correlation: Math.max(-1, Math.min(1, correlation)),
      width: Math.max(0, Math.min(2, width)),
      balance: Math.max(-1, Math.min(1, balance)),
      monoCompatibility,
      phaseIssues
    };
  }

  // 📊 CÁLCULO DE SCORES
  calculateQualityScores(metrics) {
    console.log('🏆 Calculando scores de qualidade...');
    
    const core = metrics.core;
    const stereo = metrics.stereo;
    
    const scores = {
      dynamics: 50,
      frequency: 50,
      stereo: 50,
      loudness: 50,
      technical: 50
    };
    
    // Score de dinâmica
    if (core.dynamicRange >= 12) scores.dynamics = 95;
    else if (core.dynamicRange >= 9) scores.dynamics = 85;
    else if (core.dynamicRange >= 6) scores.dynamics = 70;
    else if (core.dynamicRange >= 4) scores.dynamics = 50;
    else scores.dynamics = 30;
    
    // Score de loudness
    if (core.rms >= -16 && core.rms <= -12) scores.loudness = 95;
    else if (core.rms >= -20 && core.rms <= -10) scores.loudness = 85;
    else if (core.rms >= -25 && core.rms <= -8) scores.loudness = 70;
    else scores.loudness = 50;
    
    // Score técnico
    scores.technical = 100;
    if (core.clippingPercentage > 0.1) scores.technical -= 25;
    if (core.clippingPercentage > 0.5) scores.technical -= 25;
    if (Math.abs(core.dcOffset) > 0.01) scores.technical -= 15;
    if (core.peak > -1) scores.technical -= 20;
    scores.technical = Math.max(0, scores.technical);
    
    // Score de frequência
    if (core.spectralCentroid) {
      const centroid = core.spectralCentroid;
      if (centroid >= 800 && centroid <= 3500) scores.frequency = 90;
      else if (centroid >= 400 && centroid <= 5000) scores.frequency = 75;
      else if (centroid >= 200 && centroid <= 8000) scores.frequency = 60;
      else scores.frequency = 45;
    }
    
    // Score estéreo
    if (stereo) {
      let stereoScore = 50;
      
      // Compatibilidade mono
      if (stereo.monoCompatibility === 'excellent') stereoScore = 90;
      else if (stereo.monoCompatibility === 'good') stereoScore = 75;
      else if (stereo.monoCompatibility === 'fair') stereoScore = 60;
      else stereoScore = 40;
      
      // Penalizar largura excessiva
      if (stereo.width > 1.8) stereoScore -= 10;
      
      // Penalizar desbalanceamento
      if (Math.abs(stereo.balance) > 0.2) stereoScore -= 15;
      
      scores.stereo = Math.max(0, stereoScore);
    }
    
    // Score geral (média ponderada)
    const weights = {
      dynamics: 0.25,
      frequency: 0.20,
      stereo: stereo ? 0.20 : 0,
      loudness: 0.20,
      technical: 0.15
    };
    
    // Ajustar pesos se não há estéreo
    if (!stereo) {
      weights.dynamics = 0.30;
      weights.frequency = 0.25;
      weights.loudness = 0.25;
      weights.technical = 0.20;
    }
    
    const overall = Math.round(
      scores.dynamics * weights.dynamics +
      scores.frequency * weights.frequency +
      scores.stereo * weights.stereo +
      scores.loudness * weights.loudness +
      scores.technical * weights.technical
    );
    
    console.log(`🏆 Score geral: ${overall}/100 (Dinâmica:${scores.dynamics}, Técnico:${scores.technical})`);
    
    return {
      overall: Math.max(0, Math.min(100, overall)),
      breakdown: scores
    };
  }

  // 🏥 DIAGNÓSTICO E SUGESTÕES
  generateDiagnostics(metrics, metadata) {
    console.log('🏥 Gerando diagnósticos...');
    
    const problems = [];
    const suggestions = [];
    const feedback = [];
    
    const core = metrics.core;
    const stereo = metrics.stereo;
    
    // DETECÇÃO DE PROBLEMAS
    
    // Clipping
    if (core.clippingPercentage > 0.05) {
      problems.push({
        type: 'clipping',
        severity: core.clippingPercentage > 1.0 ? 'high' : core.clippingPercentage > 0.2 ? 'medium' : 'low',
        message: `${core.clippingPercentage.toFixed(2)}% do áudio apresenta clipping`,
        solution: 'Reduza o volume geral em 3-6dB ou use um limitador brick-wall'
      });
    }
    
    // Volume baixo
    if (core.rms < -30) {
      problems.push({
        type: 'low_volume',
        severity: core.rms < -40 ? 'high' : 'medium',
        message: `Volume muito baixo (${core.rms.toFixed(1)}dB RMS)`,
        solution: 'Aumente o volume ou aplique normalização/compressão'
      });
    }
    
    // Sobre-compressão
    if (core.dynamicRange < 4) {
      problems.push({
        type: 'over_compressed',
        severity: core.dynamicRange < 2 ? 'high' : 'medium',
        message: `Falta de dinâmica (${core.dynamicRange.toFixed(1)}dB)`,
        solution: 'Reduza a compressão ou use compressão multibanda mais sutil'
      });
    }
    
    // DC Offset
    if (Math.abs(core.dcOffset) > 0.01) {
      problems.push({
        type: 'dc_offset',
        severity: 'low',
        message: 'DC offset detectado',
        solution: 'Aplique filtro high-pass em 5-20Hz'
      });
    }
    
    // Problemas estéreo
    if (stereo) {
      if (stereo.phaseIssues) {
        problems.push({
          type: 'phase_issues',
          severity: 'medium',
          message: 'Problemas de fase detectados',
          solution: 'Verifique polaridade dos canais ou use correção de fase'
        });
      }
      
      if (Math.abs(stereo.balance) > 0.3) {
        problems.push({
          type: 'balance_issues',
          severity: 'low',
          message: `Desbalanceamento L/R (${(stereo.balance * 100).toFixed(0)}%)`,
          solution: 'Ajuste o balance ou verifique posicionamento dos elementos'
        });
      }
    }
    
    // GERAÇÃO DE SUGESTÕES
    
    // Sugestões positivas
    if (core.rms >= -16 && core.rms <= -12 && core.dynamicRange >= 8) {
      suggestions.push({
        type: 'mastering',
        priority: 'high',
        message: 'Excelente balance entre volume e dinâmica',
        action: 'Nível ideal para streaming e preservação da dinâmica'
      });
      feedback.push('✅ Mastering profissional detectado');
    }
    
    // Sugestões de EQ
    if (core.spectralCentroid) {
      if (core.spectralCentroid < 500) {
        suggestions.push({
          type: 'eq',
          priority: 'medium',
          message: 'Som muito escuro',
          action: 'Considere boost suave em 3-5kHz para mais presença'
        });
      } else if (core.spectralCentroid > 5000) {
        suggestions.push({
          type: 'eq',
          priority: 'medium',
          message: 'Som muito brilhante',
          action: 'Considere corte suave em 6-10kHz para suavizar'
        });
      }
    }
    
    // Sugestões estéreo
    if (stereo) {
      if (stereo.width > 1.5) {
        suggestions.push({
          type: 'stereo_enhancement',
          priority: 'low',
          message: 'Imagem estéreo muito ampla',
          action: 'Teste compatibilidade mono - pode causar cancelamentos'
        });
      }
      
      if (stereo.monoCompatibility === 'excellent') {
        feedback.push('🔊 Excelente compatibilidade mono');
      }
    }
    
    // Feedback geral
    const overallScore = metrics.quality?.overall || 0;
    if (overallScore >= 90) {
      feedback.push('🏆 Qualidade profissional excelente');
    } else if (overallScore >= 75) {
      feedback.push('👍 Boa qualidade técnica');
    } else if (overallScore >= 60) {
      feedback.push('⚡ Qualidade adequada com espaço para melhorias');
    }
    
    if (problems.length === 0) {
      feedback.push('✨ Nenhum problema técnico detectado');
    }
    
    console.log(`🏥 Diagnóstico: ${problems.length} problemas, ${suggestions.length} sugestões`);
    
    return {
      problems: problems.slice(0, 8),
      suggestions: suggestions.slice(0, 8),
      feedback: feedback.slice(0, 4)
    };
  }

  // 🛠️ FUNÇÕES UTILITÁRIAS

  validateFile(file) {
    if (!file) return { valid: false, error: 'Nenhum arquivo fornecido' };
    
    if (file.size > this.config.maxFileSize) {
      return { 
        valid: false, 
        error: `Arquivo muito grande (${this.formatFileSize(file.size)}). Máximo: ${this.formatFileSize(this.config.maxFileSize)}` 
      };
    }
    
    const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i)) {
      return { valid: false, error: 'Formato de arquivo não suportado' };
    }
    
    return { valid: true };
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  calculateAverage(values) {
    const validValues = values.filter(v => isFinite(v) && !isNaN(v));
    return validValues.length > 0 ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length : null;
  }

  // FFT simples para análise de frequências
  computeFFT(samples) {
    const N = samples.length;
    const spectrum = new Array(Math.floor(N / 2));
    
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  findDominantFrequency(spectrum, sampleRate) {
    let maxMagnitude = 0;
    let dominantBin = 0;
    
    for (let i = 1; i < spectrum.length; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        dominantBin = i;
      }
    }
    
    return (dominantBin * sampleRate) / (spectrum.length * 2);
  }

  getFrequencyMagnitude(spectrum, frequency, sampleRate) {
    const bin = Math.round((frequency * spectrum.length * 2) / sampleRate);
    return bin < spectrum.length ? spectrum[bin] : 0;
  }

  groupDominantFrequencies(frequencies) {
    const groups = new Map();
    const tolerance = 50; // Hz
    
    frequencies.forEach(({ frequency, magnitude }) => {
      const rounded = Math.round(frequency / tolerance) * tolerance;
      if (!groups.has(rounded)) {
        groups.set(rounded, { frequency: rounded, magnitude: 0, occurrences: 0 });
      }
      groups.get(rounded).magnitude += magnitude;
      groups.get(rounded).occurrences += 1;
    });
    
    return Array.from(groups.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .map(group => ({
        frequency: group.frequency,
        magnitude: group.magnitude / group.occurrences,
        occurrences: group.occurrences
      }));
  }

  // 🎨 Gerar prompt para IA (compatibilidade com V1)
  generateAIPrompt(analysis) {
    const core = analysis.metrics.core;
    const stereo = analysis.metrics.stereo;
    const quality = analysis.metrics.quality;
    
    let prompt = `🎵 ANÁLISE TÉCNICA V2 DETECTADA:\n\n`;
    
    prompt += `📊 DADOS TÉCNICOS:\n`;
    prompt += `• Peak: ${core.peak.toFixed(1)}dB\n`;
    prompt += `• RMS: ${core.rms.toFixed(1)}dB\n`;
    prompt += `• Dinâmica: ${core.dynamicRange.toFixed(1)}dB\n`;
    prompt += `• Crest Factor: ${core.crestFactor.toFixed(1)}\n`;
    prompt += `• Duração: ${analysis.metadata.duration.toFixed(1)}s\n`;
    
    if (core.spectralCentroid) {
      prompt += `• Centroide Espectral: ${Math.round(core.spectralCentroid)}Hz\n`;
    }
    
    if (stereo) {
      prompt += `• Correlação Estéreo: ${stereo.correlation.toFixed(2)}\n`;
      prompt += `• Largura Estéreo: ${stereo.width.toFixed(2)}\n`;
      prompt += `• Compatibilidade Mono: ${stereo.monoCompatibility}\n`;
    }
    
    prompt += `\n🏆 SCORE DE QUALIDADE: ${quality.overall}/100\n`;
    prompt += `• Dinâmica: ${quality.breakdown.dynamics}/100\n`;
    prompt += `• Técnico: ${quality.breakdown.technical}/100\n`;
    prompt += `• Loudness: ${quality.breakdown.loudness}/100\n`;
    
    if (core.dominantFrequencies.length > 0) {
      prompt += `\n🎯 FREQUÊNCIAS DOMINANTES:\n`;
      core.dominantFrequencies.slice(0, 5).forEach((freq, i) => {
        prompt += `${i + 1}. ${Math.round(freq.frequency)}Hz (${freq.occurrences}x)\n`;
      });
    }
    
    if (analysis.diagnostics.problems.length > 0) {
      prompt += `\n🚨 PROBLEMAS DETECTADOS:\n`;
      analysis.diagnostics.problems.forEach((problem, i) => {
        prompt += `${i + 1}. ${problem.message}\n`;
        prompt += `   Solução: ${problem.solution}\n`;
      });
    }
    
    if (analysis.diagnostics.suggestions.length > 0) {
      prompt += `\n💡 SUGESTÕES:\n`;
      analysis.diagnostics.suggestions.forEach((suggestion, i) => {
        prompt += `${i + 1}. ${suggestion.message}\n`;
        prompt += `   Ação: ${suggestion.action}\n`;
      });
    }
    
    prompt += `\n🎯 CONTEXTO: Análise V2 com Web Audio API + Meyda. `;
    prompt += `Com base nesta análise técnica REAL, forneça conselhos específicos `;
    prompt += `com valores exatos de EQ, compressão e outros processamentos. `;
    
    if (quality.overall >= 85) {
      prompt += `O áudio já possui alta qualidade técnica - foque em detalhes finos. `;
    } else if (quality.overall >= 70) {
      prompt += `Qualidade boa com oportunidades de melhoria. `;
    } else {
      prompt += `Há problemas técnicos significativos que precisam ser corrigidos. `;
    }
    
    prompt += `\n\n⚠️ REGRA: Use todos os valores técnicos fornecidos para criar recomendações precisas e específicas.`;
    
    return prompt;
  }

  // 🎤 Método de compatibilidade com V1
  async analyzeAudioFile(file) {
    return this.analyzeFile(file);
  }

  // 🔄 Cleanup
  async dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.isInitialized = false;
    console.log('🎵 Audio Analyzer V2 disposed');
  }
}

// 🌟 Interface global
if (typeof window !== 'undefined') {
  window.AudioAnalyzerV2 = AudioAnalyzerV2;
  
  // Manter compatibilidade com V1
  if (!window.audioAnalyzer) {
    window.audioAnalyzer = new AudioAnalyzerV2();
  }
  
  console.log('🎵 Audio Analyzer V2 disponível globalmente');
}
