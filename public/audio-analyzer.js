// 🎵 AUDIO ANALYZER - Sistema de Análise de Áudio Gratuito
// Implementação usando Web Audio API (100% gratuito)

class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyzer = null;
    this.dataArray = null;
    this.isAnalyzing = false;
  this._v2Loaded = false;
  this._v2LoadingPromise = null;
  }

  // 🎤 Inicializar análise de áudio
  async initializeAnalyzer() {
    try {
      // Criar contexto de áudio
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyzer = this.audioContext.createAnalyser();
      
      // Configurações de análise
      this.analyzer.fftSize = 2048;
      this.analyzer.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyzer.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
  if (window.DEBUG_ANALYZER === true) console.log('🎵 Analisador de áudio inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar analisador:', error);
      return false;
    }
  }

  // 📁 Analisar arquivo de áudio
  async analyzeAudioFile(file) {
    const tsStart = new Date().toISOString();
  if (window.DEBUG_ANALYZER === true) console.log('🛰️ [Telemetry] Front antes do fetch (modo local, sem fetch):', {
      route: '(client-only) audio-analyzer.js',
      method: 'N/A',
      file: file?.name,
      sizeBytes: file?.size,
      startedAt: tsStart
    });
  if (window.DEBUG_ANALYZER === true) console.log(`🎵 Iniciando análise de: ${file.name}`);
    
    if (!this.audioContext) {
      await this.initializeAnalyzer();
    }

    return new Promise((resolve, reject) => {
      // Timeout de 30 segundos
      const timeout = setTimeout(() => {
        reject(new Error('Timeout na análise do áudio (30s)'));
      }, 30000);

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          if (window.DEBUG_ANALYZER === true) console.log('� Decodificando áudio...');
          const audioData = e.target.result;
          const audioBuffer = await this.audioContext.decodeAudioData(audioData);
          
          if (window.DEBUG_ANALYZER === true) console.log('🔬 Realizando análise completa...');
          // Análise completa do áudio (V1)
          let analysis = this.performFullAnalysis(audioBuffer);

          // Enriquecimento Fase 2 (sem alterar UI): tenta carregar V2 e mapear novas métricas
          try {
            analysis = await this._enrichWithPhase2Metrics(audioBuffer, analysis, file);
          } catch (enrichErr) {
            console.warn('⚠️ Falha ao enriquecer com métricas Fase 2:', enrichErr?.message || enrichErr);
          }
          
          clearTimeout(timeout);
          if (window.DEBUG_ANALYZER === true) console.log('✅ Análise concluída com sucesso!');
          // Telemetria pós-json: chaves de 1º nível
          try {
            const topKeys = analysis ? Object.keys(analysis) : [];
            const techKeys = analysis?.technicalData ? Object.keys(analysis.technicalData) : [];
            if (window.DEBUG_ANALYZER === true) console.log('🛰️ [Telemetry] Front após "json" (obj pronto):', { topLevelKeys: topKeys, technicalKeys: techKeys });
          } catch {}
          resolve(analysis);
        } catch (error) {
          clearTimeout(timeout);
          console.error('❌ Erro na decodificação:', error);
          reject(new Error(`Erro ao decodificar áudio: ${error.message}`));
        }
      };
      
      reader.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ Erro ao ler arquivo:', error);
        reject(new Error('Erro ao ler arquivo de áudio'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  // 🔌 Enriquecer com métricas da Fase 2 usando motor V2 (carregado dinamicamente)
  async _enrichWithPhase2Metrics(audioBuffer, baseAnalysis, fileRef) {
    // Carregar V2 dinamicamente a partir de um único caminho confiável (reduz 404); seguir silencioso se indisponível
    const __DEBUG_ANALYZER__ = (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true);
    if (!this._v2Loaded && typeof window.AudioAnalyzerV2 === 'undefined') {
      if (!this._v2LoadingPromise) {
        this._v2LoadingPromise = new Promise((resolve) => {
          const url = 'audio-analyzer-v2.js?v=20250810';
          const s = document.createElement('script');
          s.src = url;
          s.async = true;
          s.onload = () => { this._v2Loaded = true; if (__DEBUG_ANALYZER__) console.log('✅ V2 carregado de', url); resolve(); };
          s.onerror = () => { if (__DEBUG_ANALYZER__) console.warn('⚠️ V2 não disponível em', url); resolve(); };
          document.head.appendChild(s);
        });
      }
      try { await this._v2LoadingPromise; } catch (e) { /* segue silencioso */ }
    }

    if (typeof window.AudioAnalyzerV2 !== 'function') {
      // Mantém apenas métricas básicas quando V2 não disponível
      return baseAnalysis;
    }

  // Executar análise V2 de forma leve usando diretamente o AudioBuffer (evita re-decodificação)
  const v2 = new window.AudioAnalyzerV2();
  await v2.initialize?.();
  if (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true) {
    console.log('🛰️ [Telemetry] V2: performFullAnalysis com audioBuffer.');
  }
  const v2res = await v2.performFullAnalysis(audioBuffer, { quality: 'fast', features: ['core','spectral','stereo','quality'] });
  const metrics = v2res?.metrics || {};
  // Disponibilizar diagnósticos V2 para a UI (sem alterar o que já existe do V1)
  if (v2res?.diagnostics) {
    baseAnalysis.v2Diagnostics = v2res.diagnostics;
  }
    const loud = metrics.loudness || {};
    const tp = metrics.truePeak || {};
    const core = metrics.core || {};
    const stereo = metrics.stereo || {};
    const tonal = metrics.tonalBalance || {};

    // Adapter: mapear para o formato já consumido pelo front (technicalData)
    baseAnalysis.technicalData = baseAnalysis.technicalData || {};
    const td = baseAnalysis.technicalData;

    // Não remover chaves existentes; adicionar novas como opcionais
    td.lufsIntegrated = isFinite(loud.lufs_integrated) ? loud.lufs_integrated : null;
  // Novas métricas de loudness (V2)
  td.lufsShortTerm = isFinite(loud.lufs_short_term) ? loud.lufs_short_term : null;
  td.lufsMomentary = isFinite(loud.lufs_momentary) ? loud.lufs_momentary : null;
  td.headroomDb = isFinite(loud.headroom_db) ? loud.headroom_db : null;
    td.lra = isFinite(loud.lra) ? loud.lra : (loud.lra === 0 ? 0 : null);
    td.truePeakDbtp = isFinite(tp.true_peak_dbtp) ? tp.true_peak_dbtp : null;
  // Picos por canal (aprox)
  td.samplePeakLeftDb = isFinite(tp.sample_peak_left_db) ? tp.sample_peak_left_db : null;
  td.samplePeakRightDb = isFinite(tp.sample_peak_right_db) ? tp.sample_peak_right_db : null;
    td.spectralCentroid = isFinite(core.spectralCentroid) ? core.spectralCentroid : null;
    td.spectralRolloff85 = isFinite(core.spectralRolloff) ? core.spectralRolloff : null;
    td.spectralFlux = isFinite(core.spectralFlux) ? core.spectralFlux : null;
    td.stereoCorrelation = isFinite(stereo.correlation) ? stereo.correlation : null;
    td.balanceLR = isFinite(stereo.balance) ? stereo.balance : null;
    td.tonalBalance = tonal && typeof tonal === 'object' ? tonal : null;
  // Extras para visual completo
  td.crestFactor = isFinite(core.crestFactor) ? core.crestFactor : null;
  td.stereoWidth = isFinite(stereo.width) ? stereo.width : null;
  td.monoCompatibility = typeof stereo.monoCompatibility === 'string' ? stereo.monoCompatibility : null;
  td.spectralFlatness = isFinite(core.spectralFlatness) ? core.spectralFlatness : null;
  td.dcOffset = isFinite(core.dcOffset) ? core.dcOffset : null;
  td.clippingSamples = Number.isFinite(core.clippingEvents) ? core.clippingEvents : null;
  td.clippingPct = isFinite(core.clippingPercentage) ? core.clippingPercentage : null;

  // Scores de qualidade e tempo total de processamento
  baseAnalysis.qualityOverall = isFinite(metrics?.quality?.overall) ? metrics.quality.overall : null;
  baseAnalysis.qualityBreakdown = metrics?.quality?.breakdown || null;
  baseAnalysis.processingMs = Number.isFinite(v2res?.processingTime) ? v2res.processingTime : null;

    // Frequências dominantes: manter existentes; se vazio, usar do V2
    if ((!Array.isArray(td.dominantFrequencies) || td.dominantFrequencies.length === 0) && metrics?.spectral?.dominantFrequencies) {
      td.dominantFrequencies = metrics.spectral.dominantFrequencies;
    }

    // Telemetria: chaves novas adicionadas
  const added = ['lufsIntegrated','lufsShortTerm','lufsMomentary','headroomDb','lra','truePeakDbtp','samplePeakLeftDb','samplePeakRightDb','spectralCentroid','spectralRolloff85','spectralFlux','stereoCorrelation','balanceLR','tonalBalance','crestFactor','stereoWidth','monoCompatibility','spectralFlatness','dcOffset','clippingSamples','clippingPct','qualityOverall','processingMs'];
  if (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true) {
    console.log('🛰️ [Telemetry] Adapter Fase2 aplicado (novas chaves):', added.filter(k => k in td));
    console.log('🛰️ [Telemetry] Valores mapeados:', {
      lufsIntegrated: td.lufsIntegrated,
      lra: td.lra,
      truePeakDbtp: td.truePeakDbtp,
      spectralCentroid: td.spectralCentroid,
      spectralRolloff85: td.spectralRolloff85,
      spectralFlux: td.spectralFlux,
      stereoCorrelation: td.stereoCorrelation,
      balanceLR: td.balanceLR,
      tonalBalance: td.tonalBalance ? {
        sub: td.tonalBalance.sub?.rms_db,
        low: td.tonalBalance.low?.rms_db,
        mid: td.tonalBalance.mid?.rms_db,
        high: td.tonalBalance.high?.rms_db,
      } : null
    });
  }

    return baseAnalysis;
  }

  // (remoção do conversor WAV — não é mais necessário)

  // 🔬 Realizar análise completa
  performFullAnalysis(audioBuffer) {
    const analysis = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      problems: [],
      suggestions: [],
      technicalData: {}
    };

    // Obter dados dos canais
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

    // 📊 Análise de Volume e Dinâmica
    analysis.technicalData.peak = this.findPeakLevel(leftChannel);
    analysis.technicalData.rms = this.calculateRMS(leftChannel);
    analysis.technicalData.dynamicRange = this.calculateDynamicRange(leftChannel);

    // ⚙️ Métricas técnicas básicas extras (fallback quando V2 não estiver disponível)
    try {
      let dcSum = 0;
      let clipped = 0;
      const len = leftChannel.length;
      const clipThreshold = 0.95; // igual ao V2
      for (let i = 0; i < len; i++) {
        const s = leftChannel[i];
        dcSum += s;
        if (Math.abs(s) >= clipThreshold) clipped++;
      }
      const dcOffset = dcSum / Math.max(1, len);
      const clippingPct = (clipped / Math.max(1, len)) * 100;
      if (!Number.isFinite(analysis.technicalData.dcOffset)) {
        analysis.technicalData.dcOffset = dcOffset;
      }
      if (!Number.isFinite(analysis.technicalData.clippingSamples)) {
        analysis.technicalData.clippingSamples = clipped;
      }
      if (!Number.isFinite(analysis.technicalData.clippingPct)) {
        analysis.technicalData.clippingPct = clippingPct;
      }
    } catch {}

    // 🎯 Análise de Frequências Dominantes
    analysis.technicalData.dominantFrequencies = this.findDominantFrequencies(leftChannel, audioBuffer.sampleRate);

    // 🔍 Detectar Problemas Comuns
    this.detectCommonProblems(analysis);

    // 💡 Gerar Sugestões Técnicas
    this.generateTechnicalSuggestions(analysis);

    return analysis;
  }

  // 📈 Encontrar nível de pico
  findPeakLevel(channelData) {
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      if (sample > peak) {
        peak = sample;
      }
    }
    // Evitar log de zero
    if (peak === 0) peak = 0.000001;
    return 20 * Math.log10(peak); // Converter para dB
  }

  // 📊 Calcular RMS (Volume médio)
  calculateRMS(channelData) {
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);
    // Evitar log de zero
    if (rms === 0) return -Infinity;
    return 20 * Math.log10(rms); // Converter para dB
  }

  // 🎚️ Calcular range dinâmico
  calculateDynamicRange(channelData) {
    const peak = this.findPeakLevel(channelData);
    const rms = this.calculateRMS(channelData);
    
    // Verificar valores válidos
    if (rms === -Infinity || isNaN(peak) || isNaN(rms)) {
      return 0;
    }
    
    return Math.abs(peak - rms);
  }

  // 🎵 Encontrar frequências dominantes
  findDominantFrequencies(channelData, sampleRate) {
  if (window.DEBUG_ANALYZER === true) console.log('🎯 Iniciando análise de frequências...');
    
    // Implementação simplificada e mais rápida
    const fftSize = 256; // Reduzido para melhor performance
    const frequencies = [];
    const maxSections = 20; // Limitar número de seções
    
    const stepSize = Math.max(fftSize * 4, Math.floor(channelData.length / maxSections));
    
    // Analisar diferentes seções do áudio
    for (let i = 0; i < channelData.length - fftSize && frequencies.length < maxSections; i += stepSize) {
      try {
        const section = channelData.slice(i, i + fftSize);
        const spectrum = this.simpleFFT(section);
        
        // Encontrar frequência dominante nesta seção
        let maxMagnitude = 0;
        let dominantBin = 0;
        
        for (let j = 1; j < spectrum.length / 2; j++) { // Começar do bin 1
          const magnitude = spectrum[j];
          if (magnitude > maxMagnitude) {
            maxMagnitude = magnitude;
            dominantBin = j;
          }
        }
        
        const dominantFreq = (dominantBin * sampleRate) / fftSize;
        if (dominantFreq > 20 && dominantFreq < 20000) { // Faixa audível
          frequencies.push(dominantFreq);
        }
      } catch (error) {
        console.warn('Erro na análise de seção:', error);
        continue;
      }
    }

  if (window.DEBUG_ANALYZER === true) console.log(`🎯 Frequências encontradas: ${frequencies.length}`);

    // Encontrar as frequências mais comuns
    const freqGroups = this.groupFrequencies(frequencies);
    return freqGroups.slice(0, 5); // Top 5 frequências
  }

  // 🔍 FFT Simples (para análise básica de frequências)
  simpleFFT(samples) {
    // Implementação básica para detectar frequências dominantes
    const N = samples.length;
    const spectrum = new Array(N);
    
    // Limitar N para evitar travamento
    const maxN = Math.min(N, 512);
    
    for (let k = 0; k < maxN; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < maxN; n++) {
        const angle = -2 * Math.PI * k * n / maxN;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    // Preencher o resto com zeros
    for (let k = maxN; k < N; k++) {
      spectrum[k] = 0;
    }
    
    return spectrum;
  }

  // 📊 Agrupar frequências similares
  groupFrequencies(frequencies) {
    const groups = {};
    const tolerance = 50; // Hz
    
    frequencies.forEach(freq => {
      const rounded = Math.round(freq / tolerance) * tolerance;
      groups[rounded] = (groups[rounded] || 0) + 1;
    });
    
    return Object.entries(groups)
      .sort(([,a], [,b]) => b - a)
      .map(([freq, count]) => ({ frequency: parseFloat(freq), occurrences: count }));
  }

  // 🚨 Detectar problemas comuns
  detectCommonProblems(analysis) {
    const { peak, rms, dynamicRange } = analysis.technicalData;

    // Problema: Clipping
    if (peak > -0.5) {
      analysis.problems.push({
        type: 'clipping',
        severity: 'high',
        message: 'Áudio com clipping detectado',
        solution: 'Reduza o volume geral ou use limitador'
      });
    }

    // Problema: Volume muito baixo
    if (rms < -30) {
      analysis.problems.push({
        type: 'low_volume',
        severity: 'medium',
        message: 'Volume RMS muito baixo',
        solution: 'Aumente o volume ou use compressão'
      });
    }

    // Problema: Falta de dinâmica
    if (dynamicRange < 6) {
      analysis.problems.push({
        type: 'over_compressed',
        severity: 'medium',
        message: 'Áudio muito comprimido',
        solution: 'Reduza compressão ou use compressão multibanda'
      });
    }

    // Problema: Frequências dominantes problemáticas
    analysis.technicalData.dominantFrequencies.forEach(freq => {
      if (freq.frequency > 300 && freq.frequency < 600 && freq.occurrences > 10) {
        analysis.problems.push({
          type: 'muddy_mids',
          severity: 'medium',
          message: `Frequência problemática em ${Math.round(freq.frequency)}Hz`,
          solution: `Corte em ${Math.round(freq.frequency)}Hz com Q de 2-4`
        });
      }
    });
  }

  // 💡 Gerar sugestões técnicas
  generateTechnicalSuggestions(analysis) {
    const { peak, rms, dominantFrequencies } = analysis.technicalData;

    // Sugestões baseadas no RMS
    if (rms > -14 && rms < -8) {
      analysis.suggestions.push({
        type: 'mastering',
        message: 'Nível ideal para streaming (-14 LUFS)',
        action: 'Seu áudio está no volume ideal para plataformas digitais'
      });
    }

    // Sugestões baseadas nas frequências
    const bassFreqs = dominantFrequencies.filter(f => f.frequency < 250);
    if (bassFreqs.length < 2) {
      analysis.suggestions.push({
        type: 'bass_enhancement',
        message: 'Pouca presença de graves',
        action: 'Considere boost em 60-80Hz ou adicione sub-bass'
      });
    }

    const highFreqs = dominantFrequencies.filter(f => f.frequency > 8000);
    if (highFreqs.length < 1) {
      analysis.suggestions.push({
        type: 'brightness',
        message: 'Falta de brilho nos agudos',
        action: 'Adicione shelf em 10kHz ou excitador de harmônicos'
      });
    }

    // Sugestão específica para funk
    const funkKickRange = dominantFrequencies.filter(f => f.frequency >= 50 && f.frequency <= 100);
    if (funkKickRange.length > 0) {
      analysis.suggestions.push({
        type: 'funk_specific',
        message: 'Frequência de kick detectada - típica do funk',
        action: `Optimize a faixa ${Math.round(funkKickRange[0].frequency)}Hz para mais punch`
      });
    }
  }

  // 🎯 Gerar prompt personalizado para IA
  generateAIPrompt(analysis) {
    let prompt = `🎵 ANÁLISE TÉCNICA DE ÁUDIO DETECTADA:\n\n`;
    
    prompt += `📊 DADOS TÉCNICOS:\n`;
    prompt += `• Peak: ${analysis.technicalData.peak.toFixed(1)}dB\n`;
    prompt += `• RMS: ${analysis.technicalData.rms.toFixed(1)}dB\n`;
    prompt += `• Dinâmica: ${analysis.technicalData.dynamicRange.toFixed(1)}dB\n`;
    prompt += `• Duração: ${analysis.duration.toFixed(1)}s\n`;
    prompt += `• Sample Rate: ${analysis.sampleRate}Hz\n`;
    prompt += `• Canais: ${analysis.channels}\n\n`;

    if (analysis.technicalData.dominantFrequencies.length > 0) {
      prompt += `🎯 FREQUÊNCIAS DOMINANTES:\n`;
      analysis.technicalData.dominantFrequencies.slice(0, 5).forEach(freq => {
        prompt += `• ${Math.round(freq.frequency)}Hz (${freq.occurrences}x detectada)\n`;
      });
      prompt += `\n`;
    }

    if (analysis.problems.length > 0) {
      prompt += `🚨 PROBLEMAS DETECTADOS:\n`;
      analysis.problems.forEach(problem => {
        prompt += `• ${problem.message}\n`;
        prompt += `  Solução: ${problem.solution}\n`;
      });
      prompt += `\n`;
    }

    if (analysis.suggestions.length > 0) {
      prompt += `💡 SUGESTÕES AUTOMÁTICAS:\n`;
      analysis.suggestions.forEach(suggestion => {
        prompt += `• ${suggestion.message}\n`;
        prompt += `  Ação: ${suggestion.action}\n`;
      });
      prompt += `\n`;
    }

    prompt += `🎯 CONTEXTO: Sou um produtor musical que precisa de ajuda específica para melhorar meu áudio. `;
    prompt += `Com base nesta análise técnica REAL do meu arquivo, me forneça conselhos práticos e específicos `;
    prompt += `incluindo valores exatos de EQ, compressão, limitação e outros processamentos. `;
    prompt += `Se detectou frequências problemáticas, me diga exatamente onde cortar/realçar e com qual Q. `;
    prompt += `Se o volume está inadequado, me diga os valores exatos de compressão e limitação para corrigir.`;

  // ⚠️ Regra obrigatória para reforçar uso dos dados do JSON na resposta da IA
  prompt += `\n\n⚠️ REGRA OBRIGATÓRIA: Use obrigatoriamente todos os valores de Peak, RMS, Dinâmica e Frequências Dominantes fornecidos no JSON para criar recomendações técnicas reais e específicas de EQ, compressão, limitação, saturação e outros processamentos. Sempre inclua valores exatos nas recomendações.`;

    return prompt;
  }
}

// 🌟 Interface simplificada para uso
window.audioAnalyzer = new AudioAnalyzer();

// 🎤 Função para analisar arquivo e enviar para chat
async function analyzeAndChat(file) {
  try {
    console.log('🎵 Iniciando análise de áudio...');
    
    const analysis = await window.audioAnalyzer.analyzeAudioFile(file);
    const aiPrompt = window.audioAnalyzer.generateAIPrompt(analysis);
    
    console.log('✅ Análise concluída:', analysis);
    
    // Enviar prompt personalizado para o chat
    await sendAudioAnalysisToChat(aiPrompt, analysis);
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
    alert('Erro ao analisar áudio. Verifique se é um arquivo válido.');
  }
}

// 📤 Enviar análise para chat
async function sendAudioAnalysisToChat(prompt, analysis) {
  // Simular envio de mensagem do usuário
  const message = `[ANÁLISE DE ÁUDIO] Analisei meu áudio e preciso de ajuda para melhorar. Aqui estão os dados técnicos:\n\n${prompt}`;
  
  // Enviar para o sistema de chat existente
  if (window.sendMessage) {
    window.sendMessage(message);
  } else {
    console.log('Prompt gerado:', message);
  }
}

console.log('🎵 Audio Analyzer carregado com sucesso!');
