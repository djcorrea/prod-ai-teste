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
			maxFileSize: 60 * 1024 * 1024,
			defaultQuality: 'balanced'
		};
	}

	async initialize() {
		if (this.isInitialized) return;
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
		this.isInitialized = true;
		if (window.DEBUG_ANALYZER === true) console.log('� Audio Analyzer V2 inicializado');
	}

	async analyzeFile(file) {
		if (typeof this.validateFile === 'function') {
			const v = this.validateFile(file);
			if (!v.valid) throw new Error(v.error || 'Arquivo inválido');
		}
		await this.initialize();
		const arrayBuffer = await new Promise((resolve, reject) => {
			const fr = new FileReader();
			fr.onload = () => resolve(fr.result);
			fr.onerror = (e) => reject(e);
			fr.readAsArrayBuffer(file);
		});
		const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
		const config = { quality: this.config.defaultQuality, features: ['core','spectral','stereo','quality'] };
		return this.performFullAnalysis(audioBuffer, config);
	}

	// 📊 CÁLCULO DE SCORES (contínuo)
	calculateQualityScores(metrics) {
		if (window.DEBUG_ANALYZER === true) console.log('🏆 Calculando scores de qualidade (contínuo)...');

		const core = metrics.core || {};
		const stereo = metrics.stereo;

		// Helpers contínuos
		const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
		const lerp = (a, b, t) => a + (b - a) * t;
		const mapLin = (x, x1, x2, y1, y2) => {
			if (!isFinite(x)) return null;
			if (x1 === x2) return y1;
			const t = clamp((x - x1) / (x2 - x1), 0, 1);
			return lerp(y1, y2, t);
		};

		const scores = { dynamics: 50, frequency: 50, stereo: 50, loudness: 50, technical: 50 };

		// Dinâmica: DR 2→30 dB => 30→95
		if (isFinite(core.dynamicRange)) {
			const dr = clamp(core.dynamicRange, 2, 30);
			scores.dynamics = Math.round(mapLin(dr, 2, 30, 30, 95));
		}

		// Loudness: preferir LUFS integrado quando disponível; senão usar RMS como proxy
		const lufsInt = metrics.loudness?.lufs_integrated;
		if (isFinite(lufsInt)) {
			const l = clamp(lufsInt, -35, -8);
			const left = mapLin(l, -35, -14, 40, 95);
			const right = mapLin(l, -14, -8, 95, 60);
			scores.loudness = Math.round(l <= -14 ? left : right);
		} else if (isFinite(core.rms)) {
			const rms = clamp(core.rms, -35, -8);
			const left = mapLin(rms, -35, -14, 40, 95);
			const right = mapLin(rms, -14, -8, 95, 60);
			scores.loudness = Math.round(rms <= -14 ? left : right);
		}

		// Técnico: penalizações contínuas
		let technical = 100;
		if (isFinite(core.clippingPercentage)) {
			const clipPct = Math.max(0, core.clippingPercentage);
			// até 0.2% leve; cresce rápido acima de 1%
			if (clipPct > 1) technical -= 50; else if (clipPct > 0.2) technical -= 25; else if (clipPct > 0.05) technical -= 10;
		}
		// penalizar true peak acima de -1 dBTP
		if (metrics.truePeak?.exceeds_minus1dbtp) technical -= 20;
		if (isFinite(core.dcOffset)) {
			const dc = Math.abs(core.dcOffset);
			const dcLim = clamp(dc, 0, 0.05);
			technical -= Math.round(mapLin(dcLim, 0.005, 0.05, 0, 15));
		}
		if (isFinite(core.peak) && core.peak > -1) technical -= 20;
		scores.technical = clamp(Math.round(technical), 0, 100);

		// Frequência: centroid 200..8000 Hz com pico em 1500..3000 Hz
		if (isFinite(core.spectralCentroid)) {
			const c = clamp(core.spectralCentroid, 200, 8000);
			const left = mapLin(c, 200, 1500, 45, 85);
			const mid = mapLin(c, 1500, 3000, 85, 90);
			const right = mapLin(c, 3000, 8000, 90, 60);
			scores.frequency = Math.round(c <= 1500 ? left : (c <= 3000 ? mid : right));
		}

		// Estéreo: base pela compatibilidade + ajustes contínuos
		if (stereo) {
			const base = stereo.monoCompatibility === 'excellent' ? 90
				: stereo.monoCompatibility === 'good' ? 75
				: stereo.monoCompatibility === 'fair' ? 60 : 40;
			let st = base;
			if (isFinite(stereo.width)) {
				const w = stereo.width;
				if (w > 1.8) st -= 10; else st += Math.round(mapLin(clamp(w, 0.2, 1.5), 0.2, 1.5, -5, 8));
			}
			if (isFinite(stereo.balance)) {
				const b = Math.abs(clamp(stereo.balance, -1, 1));
				st -= Math.round(mapLin(clamp(b, 0.1, 0.6), 0.1, 0.6, 0, 15));
			}
			scores.stereo = clamp(Math.round(st), 0, 100);
		}

		// Pesos mantidos
		const weights = {
			dynamics: 0.25,
			frequency: 0.20,
			stereo: stereo ? 0.20 : 0,
			loudness: 0.20,
			technical: 0.15
		};
		if (!stereo) {
			weights.dynamics = 0.30; weights.frequency = 0.25; weights.loudness = 0.25; weights.technical = 0.20;
		}

		const overall = Math.round(
			scores.dynamics * weights.dynamics +
			scores.frequency * weights.frequency +
			scores.stereo * weights.stereo +
			scores.loudness * weights.loudness +
			scores.technical * weights.technical
		);

		if (window.DEBUG_ANALYZER === true) console.log(`🏆 Score geral (contínuo): ${overall}/100`, scores);

		return { overall: Math.max(0, Math.min(100, overall)), breakdown: scores };
	}
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
				// Guardar bloco spectral detalhado
				metrics.spectral = {
					centroid_hz: spectralMetrics?.spectralCentroid ?? null,
					rolloff85_hz: spectralMetrics?.spectralRolloff ?? null,
					spectral_flux: spectralMetrics?.spectralFlux ?? null,
					spectral_flatness: spectralMetrics?.spectralFlatness ?? null,
					dominantFrequencies: spectralMetrics?.dominantFrequencies ?? [],
				};
			}

			// 3. ANÁLISE ESTÉREO
			if (config.features.includes('stereo') && rightChannel) {
				steps.push('stereo_analysis');
				const stereoStart = performance.now();
        
				metrics.stereo = this.analyzeStereoMetrics(leftChannel, rightChannel);
				analysisPerformance.stereo = performance.now() - stereoStart;
			}

			// 4. MÉTRICAS DE LOUDNESS (LUFS/LRA) E TRUE PEAK (client-side, aproximação)
			steps.push('loudness_truepeak');
			const loudTpStart = performance.now();
			try {
				const lm = this.calculateLoudnessMetrics(leftChannel, rightChannel || leftChannel, audioBuffer.sampleRate);
				metrics.loudness = lm; // { lufs_integrated, lufs_short_term, lufs_momentary, lra, headroom_db }
			} catch (e) {
				metrics.loudness = { lufs_integrated: null, lufs_short_term: null, lufs_momentary: null, lra: null, headroom_db: null };
			}
			try {
				metrics.truePeak = this.analyzeTruePeaks(leftChannel, rightChannel || leftChannel, audioBuffer.sampleRate);
			} catch (e) {
				metrics.truePeak = { true_peak_dbtp: null, exceeds_minus1dbtp: null, sample_peak_left_db: null, sample_peak_right_db: null };
			}
			analysisPerformance.loudness_truepeak = performance.now() - loudTpStart;

			// 5. TONAL BALANCE (bandas Sub/Low/Mid/High) e espectro médio compactado
			steps.push('tonal_balance');
			const tonalStart = performance.now();
			try {
				metrics.tonalBalance = this.calculateTonalBalance(leftChannel, rightChannel || leftChannel, audioBuffer.sampleRate);
			} catch (e) {
				metrics.tonalBalance = { sub: null, low: null, mid: null, high: null };
			}
			// Espectro médio compactado (<=256 pontos)
			try {
				const compact = this.computeAverageSpectrumCompact(leftChannel, audioBuffer.sampleRate, config.quality);
				metrics.spectral = { ...(metrics.spectral || {}), spectrum_avg: compact };
			} catch (e) {
				// manter leve
			}
			analysisPerformance.tonal_balance = performance.now() - tonalStart;

			// 5.1. MÉTRICAS PRO POR BANDA (somente se feature flag ativa)
			const __PRO_FLAG__ = (typeof window !== 'undefined') ? ((window.SUGESTOES_AVANCADAS !== false) || (window.DIAG_V2_PRO === true)) : false;
			if (__PRO_FLAG__) {
				steps.push('pro_band_metrics');
				const proStart = performance.now();
				try {
					const pro = this.computeProBandMetrics(leftChannel, rightChannel || leftChannel, audioBuffer.sampleRate, config.quality, metrics);
					metrics.v2ProMetrics = pro;
				} catch (e) {
					warnings.push('Falha no cálculo PRO por banda: ' + (e && e.message ? e.message : e));
				}
				analysisPerformance.pro_bands = performance.now() - proStart;
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
			// 5.2. DIAGNÓSTICO PROFISSIONAL (somente se feature flag ativa)
			if (__PRO_FLAG__ && metrics.v2ProMetrics) {
				steps.push('pro_diagnostics');
				const proDiagStart = performance.now();
				try {
					diagnostics.v2Pro = this.generateProDiagnostics(metrics, metadata);
					// Mesclar sugestões/problemas PRO por padrão (pode ser desativado com window.SUGESTOES_AVANCADAS=false)
					const __MERGE_ADV__ = (typeof window !== 'undefined') ? (window.SUGESTOES_AVANCADAS !== false) : false;
					if (__MERGE_ADV__) {
						const pro = diagnostics.v2Pro || { problems: [], suggestions: [] };
						diagnostics.problems = [ ...(diagnostics.problems || []), ...(pro.problems || []) ].slice(0, 8);
						diagnostics.suggestions = [ ...(diagnostics.suggestions || []), ...(pro.suggestions || []) ].slice(0, 8);
					}
				} catch (e) {
					warnings.push('Falha no diagnóstico PRO: ' + (e && e.message ? e.message : e));
				}
				analysisPerformance.pro_diagnostics = performance.now() - proDiagStart;
			}
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
			if (window.DEBUG_ANALYZER === true) console.error('❌ Erro na análise completa:', error);
			throw new Error(`Falha na análise: ${error.message}`);
		}
	}

	// 🎯 ANÁLISE CORE METRICS
	async analyzeCoreMetrics(leftChannel, rightChannel) {
		if (window.DEBUG_ANALYZER === true) console.log('🔬 Analisando métricas core...');
    
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

		if (window.DEBUG_ANALYZER === true) console.log(`📊 Core metrics: Peak=${peakDb.toFixed(1)}dB, RMS=${rmsDb.toFixed(1)}dB, DR=${dynamicRange.toFixed(1)}dB`);

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
			if (window.DEBUG_ANALYZER === true) console.log('🎯 Analisando características espectrais...');
			try {
				// Configurações baseadas na qualidade
				const configs = {
					fast: { frameSize: 512, hopSize: 256, maxFrames: 50 },
					balanced: { frameSize: 1024, hopSize: 512, maxFrames: 100 },
					accurate: { frameSize: 2048, hopSize: 1024, maxFrames: 200 }
				};
				const config = configs[quality] || configs.balanced;
				const { frameSize, hopSize, maxFrames } = config;

				// Acumuladores
				const dominantFrequencies = [];
				let frameCount = 0;
				let sumCentroid = 0;
				let sumRolloff = 0;
				let sumFlux = 0;
				let sumFlatness = 0;
				let prevSpectrum = null;

				const useMeyda = typeof Meyda !== 'undefined';

				for (let i = 0; i + frameSize <= channelData.length && frameCount < maxFrames; i += hopSize) {
					try {
						const frame = channelData.slice(i, i + frameSize);

						// Extrair features com Meyda (se disponível)
						let centroid = null, rolloff = null, flux = null, flatness = null;
						if (useMeyda) {
							const mf = Meyda.extract([
								'spectralCentroid', 'spectralRolloff', 'spectralFlux', 'spectralFlatness'
							], frame);
							if (mf) {
								centroid = Number.isFinite(mf.spectralCentroid) ? mf.spectralCentroid : null;
								rolloff = Number.isFinite(mf.spectralRolloff) ? mf.spectralRolloff : null;
								flux = Number.isFinite(mf.spectralFlux) ? mf.spectralFlux : null;
								flatness = Number.isFinite(mf.spectralFlatness) ? mf.spectralFlatness : null;
							}
						}

						// FFT própria para fallback e dominantes
						const spectrum = this.computeFFT(frame);
						const half = Math.floor(spectrum.length);
						const binToHz = (k) => (k * sampleRate) / (frameSize);

						// Calcular fallback de centroid/rolloff/flatness/flux quando Meyda indisponível ou retornou inválido
						// Energia espectral (amplitude ~ magnitude)
						let sumMag = 0;
						let sumFreqMag = 0;
						let geoSum = 0;
						const eps = 1e-12;
						for (let k = 1; k < half; k++) {
							const mag = Math.max(eps, spectrum[k]);
							sumMag += mag;
							sumFreqMag += binToHz(k) * mag;
							geoSum += Math.log(mag);
						}
						if (!Number.isFinite(centroid)) {
							centroid = sumMag > 0 ? (sumFreqMag / sumMag) : null;
						}
						if (!Number.isFinite(flatness)) {
							const am = sumMag / Math.max(1, (half - 1));
							const gm = Math.exp(geoSum / Math.max(1, (half - 1)));
							flatness = am > 0 ? (gm / am) : null;
						}
						if (!Number.isFinite(rolloff)) {
							const target = 0.85 * sumMag;
							let acc = 0;
							let k85 = 1;
							for (let k = 1; k < half; k++) {
								acc += Math.max(eps, spectrum[k]);
								if (acc >= target) { k85 = k; break; }
							}
							rolloff = binToHz(k85);
						}
						if (!Number.isFinite(flux)) {
							if (prevSpectrum && prevSpectrum.length === spectrum.length) {
								let num = 0;
								for (let k = 1; k < half; k++) {
									const d = spectrum[k] - prevSpectrum[k];
									if (d > 0) num += d;
								}
								const denom = sumMag || 1;
								flux = num / denom;
							} else {
								flux = 0;
							}
						}

						prevSpectrum = spectrum;

						// Dominante
						const dominantFreq = this.findDominantFrequency(spectrum, sampleRate);
						if (dominantFreq > 20 && dominantFreq < 20000) {
							dominantFrequencies.push({
								frequency: dominantFreq,
								magnitude: this.getFrequencyMagnitude(spectrum, dominantFreq, sampleRate),
								frame: frameCount
							});
						}

						// Acumular
						if (Number.isFinite(centroid)) sumCentroid += centroid;
						if (Number.isFinite(rolloff)) sumRolloff += rolloff;
						if (Number.isFinite(flux)) sumFlux += flux;
						if (Number.isFinite(flatness)) sumFlatness += flatness;
						frameCount++;
					} catch (err) {
						continue;
					}
				}

				if (window.DEBUG_ANALYZER === true) console.log(`🎯 Analisadas ${frameCount} janelas espectrais`);

				const avgCentroid = frameCount ? (sumCentroid / frameCount) : null;
				const avgRolloff = frameCount ? (sumRolloff / frameCount) : null;
				const avgFlux = frameCount ? (sumFlux / frameCount) : null;
				const avgFlatness = frameCount ? (sumFlatness / frameCount) : null;

				const groupedFreqs = this.groupDominantFrequencies(dominantFrequencies);
				if (window.DEBUG_ANALYZER === true) console.log(`🎯 Features espectrais: Centroid=${avgCentroid?.toFixed(0)}Hz, Flux=${avgFlux?.toFixed(3)}, Dominantes=${groupedFreqs.length}`);

				return {
					spectralCentroid: avgCentroid,
					spectralRolloff: avgRolloff,
					spectralFlux: avgFlux,
					spectralFlatness: avgFlatness,
					dominantFrequencies: groupedFreqs.slice(0, 8)
				};
			} catch (error) {
				if (window.DEBUG_ANALYZER === true) console.warn('⚠️ Erro na análise espectral:', error);
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
		if (window.DEBUG_ANALYZER === true) console.log('🔊 Analisando métricas estéreo...');
    
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
    
		if (window.DEBUG_ANALYZER === true) console.log(`🔊 Estéreo: Correlação=${correlation.toFixed(2)}, Width=${width.toFixed(2)}, Compatibilidade=${monoCompatibility}`);
    
		return {
			correlation: Math.max(-1, Math.min(1, correlation)),
			width: Math.max(0, Math.min(2, width)),
			balance: Math.max(-1, Math.min(1, balance)),
			monoCompatibility,
			phaseIssues
		};
	}

	// 📊 CÁLCULO DE SCORES (versão original baseada em faixas) - mantida como fallback interno
	calculateQualityScoresLegacy(metrics) {
		if (window.DEBUG_ANALYZER === true) console.log('🏆 Calculando scores de qualidade...');
    
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
    
		if (window.DEBUG_ANALYZER === true) console.log(`🏆 Score geral (legacy): ${overall}/100 (Dinâmica:${scores.dynamics}, Técnico:${scores.technical})`);
    
		return {
			overall: Math.max(0, Math.min(100, overall)),
			breakdown: scores
		};
	}

	// 🏥 DIAGNÓSTICO E SUGESTÕES
	generateDiagnostics(metrics, metadata) {
		if (window.DEBUG_ANALYZER === true) console.log('🏥 Gerando diagnósticos...');
    
		const problems = [];
		const suggestions = [];
		const feedback = [];
    
		const core = metrics.core;
		const stereo = metrics.stereo;
    
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
    
		if (window.DEBUG_ANALYZER === true) console.log(`🏥 Diagnóstico: ${problems.length} problemas, ${suggestions.length} sugestões`);
    
		return {
			problems: problems.slice(0, 8),
			suggestions: suggestions.slice(0, 8),
			feedback: feedback.slice(0, 4)
		};
	}

	// ===== PRO: Diagnóstico profissional com justificativas numéricas =====
	generateProDiagnostics(metrics, metadata) {
		const out = { problems: [], suggestions: [], feedback: [] };
		const core = metrics.core || {};
		const pro = metrics.v2ProMetrics || {};
		const b = (id) => pro.bands?.[id] || {};
		const idx = pro.indices || {};
		const __DBG__ = (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true);

		// Regras explicáveis
		// 1) Pouca presença de graves (menos sensível; exige bpi < -4 e headroom)
		if (isFinite(idx.bpi) && idx.bpi < -4 && isFinite(idx.headroomTP) && idx.headroomTP >= 2) {
			const msg = `BPI ${idx.bpi.toFixed(2)} dB; LowEnd ${idx.lowEndDb?.toFixed?.(2)} dB vs Mid/High ${idx.midHighDb?.toFixed?.(2)} dB; HeadroomTP ${idx.headroomTP?.toFixed?.(2)} dB; TP ${metrics.truePeak?.true_peak_dbtp?.toFixed?.(2)} dBTP`;
			const action = `Aumentar 60–80 Hz em +2 a +3 dB (Q 0.7–1.0); considerar sub-synth se Sub muito baixo; verificar KBI/sidechain 3–6 dB GR — ${msg}`;
			out.suggestions.push({ type: 'low_end', priority: 'medium', message: 'Pouca presença de graves', action, details: msg });
			if (__DBG__) console.log('[PRO] regra: low_end', { criteria: { bpi: idx.bpi, headroomTP: idx.headroomTP }, action });
		}

		// 1b) Excesso de graves (novo: quando bpi > +4)
		if (isFinite(idx.bpi) && idx.bpi > 4) {
			const msg = `BPI ${idx.bpi.toFixed(2)} dB; LowEnd ${idx.lowEndDb?.toFixed?.(2)} dB acima de Mid/High ${idx.midHighDb?.toFixed?.(2)} dB; KBI ${(idx.kbi??metrics.v2ProMetrics?.indices?.kbi)?.toFixed?.(3)}`;
			const action = `Reduzir 60–100 Hz em −2 a −4 dB (Q 0.8–1.2) no buss; usar sidechain (3–6 dB GR) entre kick e baixo; checar sub < 40 Hz com HPF — ${msg}`;
			out.suggestions.push({ type: 'low_end_excess', priority: 'high', message: 'Excesso de graves', action, details: msg });
			if (__DBG__) console.log('[PRO] regra: low_end_excess', { criteria: { bpi: idx.bpi }, action });
		}

		// 2) Excesso de lama (200–400 Hz)
		if (isFinite(idx.mmi) && idx.mmi > 3 && isFinite(core.spectralCentroid) && core.spectralCentroid < 2000) {
			const msg = `MMI ${idx.mmi} dB; Centroid ${core.spectralCentroid} Hz`;
			const action = `Cortar −2 a −4 dB em 250–350 Hz (Q 1.2–1.6) no buss; avaliar multibanda se LRA < 6 dB — ${msg}`;
			out.suggestions.push({ type: 'mud', priority: 'medium', message: 'Excesso de lama (200–400 Hz)', action, details: msg });
			if (__DBG__) console.log('[PRO] regra: mud', { criteria: { mmi: idx.mmi, centroidHz: core.spectralCentroid }, action });
		}

		// 3) Brilho/agudos insuficientes
		if (isFinite(idx.hpi) && idx.hpi < -3 && isFinite(idx.rolloff85Hz) && idx.rolloff85Hz < 6000) {
			const msg = `HPI ${idx.hpi} dB; Rolloff85 ${idx.rolloff85Hz} Hz`;
			const action = `Shelf +1.5 a +3 dB em 10–12 kHz; checar sibilância 6–8 kHz — ${msg}`;
			out.suggestions.push({ type: 'highs', priority: 'low', message: 'Brilho/agudos insuficientes', action, details: msg });
			if (__DBG__) console.log('[PRO] regra: highs', { criteria: { hpi: idx.hpi, rolloff85Hz: idx.rolloff85Hz }, action });
		}

		// 4) Estéreo estreito/mono
		const wMid = b('mid').width; const cMid = b('mid').corr; const wPres = b('presence').width; const cPres = b('presence').corr;
		if (isFinite(idx.sti) && idx.sti < 40 && isFinite(wMid) && wMid < 0.8 && isFinite(cMid) && cMid > 0.9) {
			const msg = `STI ${idx.sti}; width_mid ${wMid}; corr_mid ${cMid}; width_presence ${wPres}; corr_presence ${cPres}`;
			const action = `Widening em 2–8 kHz; evitar estéreo <120 Hz — ${msg}`;
			out.suggestions.push({ type: 'stereo', priority: 'low', message: 'Estéreo estreito/mono', action, details: msg });
			if (__DBG__) console.log('[PRO] regra: stereo', { criteria: { sti: idx.sti, width_mid: wMid, corr_mid: cMid }, action });
		}

		// 5) Loudness fora do alvo
		if (isFinite(metrics.loudness?.lufs_integrated)) {
			const lufs = metrics.loudness.lufs_integrated;
			const tp = metrics.truePeak?.true_peak_dbtp;
			const clipPct = core.clippingPercentage;
			const headroomTP = idx.headroomTP;
			const msg = `LUFS ${lufs} LUFS; TP ${tp} dBTP; HeadroomTP ${headroomTP} dB; Clipping% ${clipPct}`;
			const action = `Ajustar gain/limiter até −1 dBTP; se Clipping% > 0.2% reduzir 1–2 dB antes — ${msg}`;
			out.suggestions.push({ type: 'loudness', priority: 'high', message: 'Loudness fora do alvo', action, details: msg });
			if (__DBG__) console.log('[PRO] regra: loudness', { criteria: { lufs, tp, headroomTP, clipPct }, action });
		}

		// Problemas técnicos adicionais
		if (isFinite(core.dcOffset) && Math.abs(core.dcOffset) > 0.01) {
			out.problems.push({ type: 'dc_offset', severity: 'low', message: `DC offset ${core.dcOffset}`, solution: 'Aplicar high-pass 5–20 Hz' });
		}
		if (isFinite(core.clippingPercentage) && core.clippingPercentage > 0.2) {
			out.problems.push({ type: 'clipping', severity: core.clippingPercentage > 1 ? 'high' : 'medium', message: `Clipping% ${core.clippingPercentage}`, solution: 'Reduzir ganho de entrada e/ou usar limitador brick-wall' });
		}

		return out;
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

	// ===== PRO: Cálculo por bandas e índices derivativos (sem arredondamento) =====
	computeProBandMetrics(left, right, sampleRate, quality = 'balanced', baseMetrics = {}) {
		const q = quality === 'fast' ? { frame: 512, hop: 256, max: 60 } : quality === 'accurate' ? { frame: 2048, hop: 512, max: 200 } : { frame: 1024, hop: 512, max: 120 };
		const bands = [
			{ id: 'sub', lo: 20, hi: 40 },
			{ id: 'low', lo: 40, hi: 80 },
			{ id: 'lowmid', lo: 80, hi: 200 },
			{ id: 'mud', lo: 200, hi: 400 },
			{ id: 'mid', lo: 400, hi: 2000 },
			{ id: 'presence', lo: 2000, hi: 6000 },
			{ id: 'brilho', lo: 6000, hi: 10000 },
			{ id: 'air', lo: 10000, hi: 16000 }
		];

		// STFT simples reaproveitando computeFFT; medição por banda no espectro
		const frame = q.frame, hop = q.hop, maxFrames = q.max;
		const makeSpec = (slice) => this.computeFFT(slice);
		const hzPerBin = (N) => (sampleRate / N);

		// Acumuladores por banda
		const acc = bands.reduce((m, b) => (m[b.id] = { energy: 0, energyCount: 0, flatGeoSum: 0, flatCount: 0, fluxSum: 0, fluxDen: 0, peak: 0, leftP: 0, rightP: 0, midP: 0, sideP: 0 }, m), {});

		let frames = 0;
		let prevSpecL = null, prevSpecR = null;
		const minLen = Math.min(left.length, right.length);
		for (let i = 0; i + frame <= minLen && frames < maxFrames; i += hop) {
			const sliceL = left.slice(i, i + frame);
			const sliceR = right.slice(i, i + frame);
			const specL = makeSpec(sliceL);
			const specR = makeSpec(sliceR);
			const N = frame; const half = Math.floor(N / 2);
			const hzb = hzPerBin(N);

			// energia/flatness/flux por banda
			for (let b of bands) {
				const startBin = Math.max(1, Math.floor(b.lo / hzb));
				const endBin = Math.min(half - 1, Math.ceil(b.hi / hzb));
				let eSum = 0, gmSum = 0, count = 0, posFlux = 0, den = 0;
				for (let k = startBin; k <= endBin; k++) {
					const magL = specL[k] || 0; const magR = specR[k] || 0;
					const mag = (magL + magR) / 2;
					eSum += mag * mag; // potência
					gmSum += Math.log(Math.max(1e-12, mag));
					den += Math.max(1e-12, mag);
					if (prevSpecL && prevSpecR) {
						const pL = prevSpecL[k] || 0; const pR = prevSpecR[k] || 0;
						const d = ((magL + magR) / 2) - ((pL + pR) / 2);
						if (d > 0) posFlux += d;
					}
					count++;
				}
				acc[b.id].energy += eSum;
				acc[b.id].energyCount += count;
				acc[b.id].flatGeoSum += gmSum;
				acc[b.id].flatCount += count;
				acc[b.id].fluxSum += posFlux;
				acc[b.id].fluxDen += den;
			}

			// pico e M/S por banda (proxy via RMS de janelas filtradas simples)
			// Aproximação: usar potência por banda para mid/side
			for (let b of bands) {
				const startBin = Math.max(1, Math.floor(b.lo / hzb));
				const endBin = Math.min(half - 1, Math.ceil(b.hi / hzb));
				let pL = 0, pR = 0, pM = 0, pS = 0;
				for (let k = startBin; k <= endBin; k++) {
					const l = specL[k] || 0; const r = specR[k] || 0;
					pL += l * l; pR += r * r;
					const m = (l + r) / 2; const s = (l - r) / 2;
					pM += m * m; pS += s * s;
				}
				acc[b.id].leftP += pL; acc[b.id].rightP += pR; acc[b.id].midP += pM; acc[b.id].sideP += pS;
			}

			// pico temporal aproximado da janela
			for (let s of [sliceL, sliceR]) {
				for (let n = 0; n < s.length; n++) {
					const v = Math.abs(s[n]); if (v > acc.__peak) acc.__peak = v;
				}
			}

			prevSpecL = specL; prevSpecR = specR; frames++;
		}

		// Conversões finais por banda
		const out = { bands: {}, indices: {} };
		const totalEnergy = Object.values(acc).reduce((s, v) => s + (v.energy || 0), 0) || 1;
		const eps = 1e-12;
		for (let b of bands) {
			const a = acc[b.id];
			// Usar potência média por bin (energia média) para neutralizar a largura de banda
			const meanPower = a.energyCount > 0 ? (a.energy / Math.max(1, a.energyCount)) : eps;
			const levelDb = 10 * Math.log10(Math.max(eps, meanPower));
			const flatGeom = a.flatCount > 0 ? Math.exp(a.flatGeoSum / a.flatCount) : 0;
			const flatArith = a.energyCount > 0 ? (a.energy / Math.max(1, a.energyCount)) : 0;
			const flatness = flatArith > 0 ? (flatGeom / Math.sqrt(flatArith)) : 0;
			const flux = a.fluxDen > 0 ? (a.fluxSum / a.fluxDen) : 0;
			const peakDbfs = a.__peakBand ? 20 * Math.log10(a.__peakBand) : null;
			const crestDb = null; // não confiável sem pico por banda temporal
			const width = a.midP > 0 ? Math.sqrt(a.sideP / a.midP) : 0;
			const corr = (a.leftP > 0 && a.rightP > 0) ? ((a.midP - a.sideP) / Math.sqrt(a.leftP * a.rightP)) : 1;
			const balance = (a.leftP + a.rightP) > 0 ? ((a.rightP - a.leftP) / (a.rightP + a.leftP)) : 0;
			out.bands[b.id] = { lufs: levelDb, peakDbfs, crestDb, flatness, flux, width, corr, balance, energyShare: (a.energy / totalEnergy) };
		}

		// Índices
		const bget = (id) => out.bands[id] || {};
		const Sub = bget('sub').lufs ?? -Infinity;
		const Low = bget('low').lufs ?? -Infinity;
		const LowMid = bget('lowmid').lufs ?? -Infinity;
		const Mud = bget('mud').lufs ?? -Infinity;
		const Mid = bget('mid').lufs ?? -Infinity;
		const Presence = bget('presence').lufs ?? -Infinity;
		const Brilho = bget('brilho').lufs ?? -Infinity;

		// Média ponderada em domínio de potência (linear) e convertida de volta para dB
		const lin = (db) => (isFinite(db) ? Math.pow(10, db/10) : 0);
		const wAvgDb = (pairs) => {
			let num = 0, den = 0;
			for (const {db, w} of pairs) { num += w * lin(db); den += w; }
			return den > 0 ? 10 * Math.log10(Math.max(1e-20, num / den)) : -Infinity;
		};

		const lowEndDb = wAvgDb([
			{ db: Sub, w: 0.6 },
			{ db: Low, w: 1.0 },
			{ db: LowMid, w: 0.8 }
		]);
		const midHighDb = wAvgDb([
			{ db: Mid, w: 0.7 },
			{ db: Presence, w: 1.0 }
		]);

		const bpi = lowEndDb - midHighDb; // Bass Presence Index (positivo = mais graves que médios/agudos)
		const mmi = Mud - (0.5 * LowMid + 0.5 * Mid);
		const meanAll = Object.values(out.bands).reduce((s, v) => s + (isFinite(v.lufs) ? v.lufs : 0), 0) / Math.max(1, Object.keys(out.bands).length);
		const hpi = Brilho - meanAll;

		// STI: compor médias ponderadas por bandas úteis
		const wMid = bget('mid').width ?? 0; const cMid = bget('mid').corr ?? 1;
		const wPres = bget('presence').width ?? 0; const cPres = bget('presence').corr ?? 1;
		const wLow = bget('low').width ?? 0; const wSub = bget('sub').width ?? 0;
		let sti = 0;
		sti += Math.max(0, (wMid - 0.6)) * 25; // estimular largura saudável
		sti += Math.max(0, (wPres - 0.6)) * 25;
		sti -= Math.max(0, (1 - cMid)) * 20; // se correlação cai, penaliza
		sti -= Math.max(0, (1 - cPres)) * 20;
		sti -= Math.max(0, (wLow - 0.4)) * 20; // penalizar largura em graves
		sti -= Math.max(0, (wSub - 0.3)) * 20;
		// garantir faixa 0–100
		sti = Math.max(0, Math.min(100, sti));

		// KBI: overlap de 45–70 (kick) e 55–120 (baixo) via energia
		const kickBand = { lo: 45, hi: 70 }, bassBand = { lo: 55, hi: 120 };
		// Proxy: usar shares de energia Low/Sub e LowMid
		const kbi = ((bget('low').energyShare || 0) + (bget('sub').energyShare || 0)) * (bget('lowmid').energyShare || 0);

		// Headroom real
		const tp = baseMetrics.truePeak?.true_peak_dbtp;
		const spL = baseMetrics.truePeak?.sample_peak_left_db;
		const spR = baseMetrics.truePeak?.sample_peak_right_db;
		const headroomTP = isFinite(tp) ? (-1 - tp) : null;
		const headroomSP = Math.min(isFinite(spL) ? (0 - spL) : Infinity, isFinite(spR) ? (0 - spR) : Infinity);

		out.indices = { bpi, mmi, hpi, sti, kbi, headroomTP, headroomSP, lowEndDb, midHighDb, rolloff85Hz: baseMetrics.core?.spectralRolloff, centroidHz: baseMetrics.core?.spectralCentroid };
		return out;
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
		if (window.DEBUG_ANALYZER === true) console.log('🎵 Audio Analyzer V2 disposed');
	}
}

// 🌟 Interface global
if (typeof window !== 'undefined') {
	window.AudioAnalyzerV2 = AudioAnalyzerV2;
  
	// Manter compatibilidade com V1
	if (!window.audioAnalyzer) {
		window.audioAnalyzer = new AudioAnalyzerV2();
	}
  
	if (window.DEBUG_ANALYZER === true) console.log('🎵 Audio Analyzer V2 disponível globalmente');
}

// ========================= MÉTODOS AUXILIARES FASE 2 =========================
// Implementações leves e compatíveis com browser para LUFS/LRA, True Peak, Tonal Balance e espectro compacto

AudioAnalyzerV2.prototype.applyKWeighting = function(samples, sampleRate) {
	const out = new Float32Array(samples.length);
	let y1 = 0, y2 = 0, x1 = 0, x2 = 0;
	const a0 = 1.0, a1 = -1.69065929318241, a2 = 0.73248077421585;
	const b0 = 1.53512485958697, b1 = -2.69169618940638, b2 = 1.19839281085285;
	for (let i = 0; i < samples.length; i++) {
		const x0 = samples[i];
		const y0 = b0*x0 + b1*x1 + b2*x2 - a1*y1 - a2*y2;
		out[i] = y0;
		x2 = x1; x1 = x0; y2 = y1; y1 = y0;
	}
	return out;
};

AudioAnalyzerV2.prototype.blockRMS = function(samples, blockSize) {
	const nBlocks = Math.max(1, Math.floor(samples.length / blockSize));
	const arr = new Float32Array(nBlocks);
	for (let i = 0; i < nBlocks; i++) {
		let sum = 0; const start = i*blockSize; const end = Math.min(samples.length, start + blockSize);
		for (let j = start; j < end; j++) sum += samples[j]*samples[j];
		const rms = Math.sqrt(sum / Math.max(1, end-start));
		arr[i] = rms;
	}
	return arr;
};

AudioAnalyzerV2.prototype.dbfs = function(x) {
	return x > 0 ? 20 * Math.log10(x) : -Infinity;
};

AudioAnalyzerV2.prototype.calculateLoudnessMetrics = function(left, right, sampleRate) {
	const Lk = this.applyKWeighting(left, sampleRate);
	const Rk = this.applyKWeighting(right, sampleRate);
	const mix = new Float32Array(Lk.length);
	for (let i = 0; i < mix.length; i++) mix[i] = (Lk[i] + (Rk[i] || 0)) / 2;

	const blockMs = 400; // 400ms para LUFS integrado
	const stMs = 3000;   // 3s para Short-Term
	const mMs = 400;     // 400ms para Momentary
	const blockSize = Math.max(1, Math.round(sampleRate * blockMs / 1000));
	const stSize = Math.max(1, Math.round(sampleRate * stMs / 1000));
	const mSize = Math.max(1, Math.round(sampleRate * mMs / 1000));

	const br = this.blockRMS(mix, blockSize);
	const st = this.blockRMS(mix, stSize);
	const mm = this.blockRMS(mix, mSize);

	const brDb = Array.from(br, v => this.dbfs(v));
	const gated = brDb.filter(v => v > -70);
	const lufsIntegrated = gated.length ? this.calculateEnergyAverageDb(gated) : this.calculateEnergyAverageDb(brDb);

	const relThresh = lufsIntegrated - 10;
	const gatedRel = brDb.filter(v => v > relThresh);
	const lufsIntegratedRel = gatedRel.length ? this.calculateEnergyAverageDb(gatedRel) : lufsIntegrated;

	const stDb = Array.from(st, v => this.dbfs(v)).filter(isFinite);
	stDb.sort((a,b)=>a-b);
	const p = (arr, q) => arr.length ? arr[Math.floor((arr.length-1)*q)] : -Infinity;
	const lra = stDb.length ? (p(stDb, 0.95) - p(stDb, 0.10)) : null;

	const mDb = Array.from(mm, v => this.dbfs(v)).filter(isFinite);
	const lufsShortTerm = stDb.length ? this.calculateEnergyAverageDb(stDb) : null;
	const lufsMomentary = mDb.length ? this.calculateEnergyAverageDb(mDb) : null;

	const headroomDb = (lufsIntegratedRel !== null && isFinite(lufsIntegratedRel)) ? (-1 - lufsIntegratedRel) : null;

	return {
		lufs_integrated: lufsIntegratedRel,
		lufs_short_term: lufsShortTerm,
		lufs_momentary: lufsMomentary,
		lra,
		headroom_db: headroomDb
	};
};

AudioAnalyzerV2.prototype.calculateEnergyAverageDb = function(dbArray) {
	const lin = dbArray.filter(isFinite).map(d => Math.pow(10, d/20));
	if (!lin.length) return null;
	const mean = lin.reduce((a,b)=>a+b,0) / lin.length;
	return 20 * Math.log10(mean);
};

AudioAnalyzerV2.prototype.analyzeTruePeaks = function(left, right, sampleRate) {
	const oversample = (ch) => {
		const out = new Float32Array(ch.length * 4);
		for (let i = 0; i < ch.length - 1; i++) {
			const a = ch[i]; const b = ch[i+1];
			const base = i*4;
			out[base] = a;
			out[base+1] = a + 0.25*(b-a);
			out[base+2] = a + 0.5*(b-a);
			out[base+3] = a + 0.75*(b-a);
		}
		out[out.length-1] = ch[ch.length-1];
		return out;
	};
	const L4 = oversample(left);
	const R4 = oversample(right);
	const maxL = L4.reduce((m,v)=>Math.max(m, Math.abs(v)), 0);
	const maxR = R4.reduce((m,v)=>Math.max(m, Math.abs(v)), 0);
	const max = Math.max(maxL, maxR);
	return {
		true_peak_dbtp: max > 0 ? 20*Math.log10(max) : -Infinity,
		exceeds_minus1dbtp: max > Math.pow(10, -1/20),
		sample_peak_left_db: maxL > 0 ? 20*Math.log10(maxL) : -Infinity,
		sample_peak_right_db: maxR > 0 ? 20*Math.log10(maxR) : -Infinity
	};
};

AudioAnalyzerV2.prototype.calculateTonalBalance = function(left, right, sampleRate) {
	const band = (low, high) => {
		const rms = (ch) => {
			let acc = 0; let count = 0; const step = Math.max(1, Math.floor(ch.length/2000));
			for (let i = 0; i < ch.length; i+=step) { acc += ch[i]*ch[i]; count++; }
			const v = Math.sqrt(acc / Math.max(1, count));
			return v;
		};
		const l = rms(left);
		const r = rms(right);
		const mix = (l + r) / 2;
		return { rms_db: mix>0?20*Math.log10(mix):-80, rms_left_db: l>0?20*Math.log10(l):-80, rms_right_db: r>0?20*Math.log10(r):-80 };
	};
	return {
		sub: band(20,60),
		low: band(60,250),
		mid: band(250,4000),
		high: band(4000,20000)
	};
};

AudioAnalyzerV2.prototype.computeAverageSpectrumCompact = function(channel, sampleRate, quality='balanced') {
	const cfg = quality==='fast'?{frame:512,hop:256,max:40}:quality==='accurate'?{frame:2048,hop:512,max:120}:{frame:1024,hop:256,max:80};
	const { frame, hop, max } = cfg;
	const half = Math.floor(frame/2);
	const acc = new Float32Array(half);
	let frames=0;
	for (let i=0; i+frame<=channel.length && frames<max; i+=hop) {
		const slice = channel.slice(i,i+frame);
		const spec = this.computeFFT(slice);
		for (let k=0;k<half;k++) acc[k]+=spec[k]||0;
		frames++;
	}
	if (!frames) return null;
	for (let k=0;k<acc.length;k++) acc[k]/=frames;
	const target = Math.min(256, acc.length);
	const out = new Array(target);
	const ratio = acc.length/target;
	for (let i=0;i<target;i++) {
		const start = Math.floor(i*ratio);
		const end = Math.floor((i+1)*ratio);
		let s=0,c=0; for (let j=start;j<end;j++){s+=acc[j];c++;}
		out[i] = c? s/c : 0;
	}
	return out;
};

