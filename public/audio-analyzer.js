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
      
      console.log('🎵 Analisador de áudio inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar analisador:', error);
      return false;
    }
  }

  // 📁 Analisar arquivo de áudio
  async analyzeAudioFile(file) {
    const tsStart = new Date().toISOString();
    console.log('🛰️ [Telemetry] Front antes do fetch (modo local, sem fetch):', {
      route: '(client-only) audio-analyzer.js',
      method: 'N/A',
      file: file?.name,
      sizeBytes: file?.size,
      startedAt: tsStart
    });
    console.log(`🎵 Iniciando análise de: ${file.name}`);
    
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
          console.log('📊 Decodificando áudio...');
          const audioData = e.target.result;
          const audioBuffer = await this.audioContext.decodeAudioData(audioData);
          
          console.log('🔬 Realizando análise completa...');
          // Análise completa do áudio (V1)
          let analysis = this.performFullAnalysis(audioBuffer);

          // Enriquecimento Fase 2 (sem alterar UI): tenta carregar V2 e mapear novas métricas
          try {
            analysis = await this._enrichWithPhase2Metrics(audioBuffer, analysis, file);
          } catch (enrichErr) {
            console.warn('⚠️ Falha ao enriquecer com métricas Fase 2:', enrichErr?.message || enrichErr);
          }
          
          clearTimeout(timeout);
          console.log('✅ Análise concluída com sucesso!');
          // Telemetria pós-json: chaves de 1º nível
          try {
            const topKeys = analysis ? Object.keys(analysis) : [];
            const techKeys = analysis?.technicalData ? Object.keys(analysis.technicalData) : [];
            console.log('🛰️ [Telemetry] Front após "json" (obj pronto):', { topLevelKeys: topKeys, technicalKeys: techKeys });
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
    // Carregar V2 dinamicamente se disponível no projeto (sem alterar HTML)
    if (!this._v2Loaded && typeof window.AudioAnalyzerV2 === 'undefined') {
      if (!this._v2LoadingPromise) {
        this._v2LoadingPromise = new Promise((resolve, reject) => {
          const pagePath = (typeof location !== 'undefined') ? location.pathname : '/';
          // Candidatos robustos, mantendo paths relativos ao index atual
          const candidates = [];
          // 1) relativo ao documento atual
          candidates.push('audio-analyzer-v2.js');
          candidates.push('./audio-analyzer-v2.js');
          // 2) se a página estiver em /public/, tente raiz e /public/
          if (pagePath.includes('/public/')) {
            candidates.push('/public/audio-analyzer-v2.js');
          } else {
            candidates.push('public/audio-analyzer-v2.js');
            candidates.push('/public/audio-analyzer-v2.js');
          }

          console.log('🛰️ [Telemetry] Tentando carregar V2 a partir de:', candidates);

          let idx = 0;
          const tryNext = () => {
            if (idx >= candidates.length) {
              reject(new Error('Falha ao carregar audio-analyzer-v2.js de todos os caminhos candidatos'));
              return;
            }
            const url = candidates[idx++];
            const s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = () => { this._v2Loaded = true; console.log('✅ V2 carregado de', url); resolve(); };
            s.onerror = () => { console.warn('⚠️ Falha ao carregar V2 em', url); tryNext(); };
            document.head.appendChild(s);
          };
          tryNext();
        });
      }
      try { await this._v2LoadingPromise; } catch (e) { console.warn('⚠️ V2 indisponível:', e.message); }
    }

    if (typeof window.AudioAnalyzerV2 !== 'function') {
      console.log('ℹ️ Motor V2 não disponível. Mantendo apenas métricas básicas.');
      return baseAnalysis;
    }

  // Executar análise V2 de forma leve usando diretamente o AudioBuffer (evita re-decodificação)
  const v2 = new window.AudioAnalyzerV2();
  await v2.initialize?.();
  console.log('🛰️ [Telemetry] V2: performFullAnalysis com audioBuffer.');
  const v2res = await v2.performFullAnalysis(audioBuffer, { quality: 'fast', features: ['core','spectral','stereo','quality'] });
  const metrics = v2res?.metrics || {};
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
    td.lra = isFinite(loud.lra) ? loud.lra : (loud.lra === 0 ? 0 : null);
    td.truePeakDbtp = isFinite(tp.true_peak_dbtp) ? tp.true_peak_dbtp : null;
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
  const added = ['lufsIntegrated','lra','truePeakDbtp','spectralCentroid','spectralRolloff85','spectralFlux','stereoCorrelation','balanceLR','tonalBalance','crestFactor','stereoWidth','monoCompatibility','spectralFlatness','dcOffset','clippingSamples','clippingPct','qualityOverall','processingMs'];
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
    console.log('🎯 Iniciando análise de frequências...');
    
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

    console.log(`🎯 Frequências encontradas: ${frequencies.length}`);

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
