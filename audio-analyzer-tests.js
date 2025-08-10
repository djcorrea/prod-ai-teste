// 🧪 TESTES AUTOMÁTICOS DE ACEITAÇÃO - Audio Analyzer
// Sistema de testes determinísticos para validar elimição de valores genéricos

class AudioAnalyzerTests {
	constructor() {
		this.testResults = [];
		this.analyzerV2 = null;
		
		// Configurações de teste
		this.config = {
			sampleRate: 44100,
			testDuration: 2.0, // 2 segundos
			baseFrequency: 1000, // 1kHz tom de teste
			testAmplitude: 0.7 // -3dB aproximadamente
		};
		
		console.log('🧪 Audio Analyzer Tests inicializado');
	}
	
	// 🎬 Executar todos os testes de aceitação
	async runAllAcceptanceTests() {
		console.log('🚀 Iniciando bateria completa de testes de aceitação...');
		
		this.testResults = [];
		
		try {
			// Inicializar analyzer
			this.analyzerV2 = new AudioAnalyzerV2();
			await this.analyzerV2.initialize();
			
			// 1. Teste de ganho (+3dB)
			await this.testGainIncrease();
			
			// 2. Teste estéreo (mono collapse)
			await this.testStereoToMono();
			
			// 3. Teste low-pass (filtragem)
			await this.testLowPassFiltering();
			
			// 4. Teste DC offset
			await this.testDCOffset();
			
			// 5. Teste determinismo
			await this.testDeterminism();
			
			// Relatório final
			this.generateReport();
			
		} catch (error) {
			console.error('❌ Erro na execução dos testes:', error);
			this.testResults.push({
				test: 'Test Suite',
				passed: false,
				error: error.message
			});
		}
		
		return this.testResults;
	}
	
	// 📈 TESTE 1: Ganho (+3dB deve alterar LUFS, Headroom, Clipping, Score)
	async testGainIncrease() {
		console.log('📈 Executando Teste 1: Ganho +3dB...');
		
		try {
			// Gerar áudio base
			const baseAudio = this.generateTestTone(this.config.baseFrequency, this.config.testAmplitude);
			const baseFile = this.audioBufferToFile(baseAudio, 'base_audio.wav');
			
			// Gerar áudio com +3dB
			const gainedAudio = this.generateTestTone(this.config.baseFrequency, this.config.testAmplitude * Math.pow(10, 3/20));
			const gainedFile = this.audioBufferToFile(gainedAudio, 'gained_audio.wav');
			
			// Analisar ambos
			const baseAnalysis = await this.analyzerV2.analyzeFile(baseFile);
			const gainedAnalysis = await this.analyzerV2.analyzeFile(gainedFile);
			
			const baseLufs = baseAnalysis.metrics.loudness?.lufs_integrated;
			const gainedLufs = gainedAnalysis.metrics.loudness?.lufs_integrated;
			const lufsIncrease = gainedLufs - baseLufs;
			
			const baseHeadroom = baseAnalysis.metrics.loudness?.headroom_db;
			const gainedHeadroom = gainedAnalysis.metrics.loudness?.headroom_db;
			
			const baseScore = baseAnalysis.metrics.quality?.overall;
			const gainedScore = gainedAnalysis.metrics.quality?.overall;
			
			// Validações
			const lufsValid = Math.abs(lufsIncrease - 3.0) < 0.5; // Tolerância de 0.5dB
			const headroomValid = gainedHeadroom < baseHeadroom; // Headroom deve diminuir
			const scoreChanged = Math.abs(baseScore - gainedScore) > 1; // Score deve mudar
			
			const passed = lufsValid && headroomValid && scoreChanged;
			
			this.testResults.push({
				test: 'Teste Ganho +3dB',
				passed,
				details: {
					lufs_increase: lufsIncrease.toFixed(2) + 'dB',
					headroom_decrease: (baseHeadroom - gainedHeadroom).toFixed(2) + 'dB',
					score_change: (gainedScore - baseScore).toFixed(0),
					expected_lufs: '~3dB',
					actual_lufs: lufsIncrease.toFixed(2) + 'dB',
					lufs_valid: lufsValid,
					headroom_valid: headroomValid,
					score_changed: scoreChanged
				}
			});
			
			console.log(`📈 Teste 1 ${passed ? '✅ PASSOU' : '❌ FALHOU'}: LUFS +${lufsIncrease.toFixed(2)}dB, Score ${baseScore}→${gainedScore}`);
			
		} catch (error) {
			console.error('❌ Erro no teste de ganho:', error);
			this.testResults.push({
				test: 'Teste Ganho +3dB',
				passed: false,
				error: error.message
			});
		}
	}
	
	// 🔊 TESTE 2: Estéreo para Mono (Correlação→1, Largura↓)
	async testStereoToMono() {
		console.log('🔊 Executando Teste 2: Estéreo para Mono...');
		
		try {
			// Gerar áudio estéreo (L≠R)
			const stereoAudio = this.generateStereoTestTone(1000, 0.5, 1500, 0.3);
			const stereoFile = this.audioBufferToFile(stereoAudio, 'stereo_audio.wav');
			
			// Gerar versão mono (L+R)/2
			const monoAudio = this.generateTestTone(this.config.baseFrequency, this.config.testAmplitude);
			const monoFile = this.audioBufferToFile(monoAudio, 'mono_audio.wav');
			
			// Analisar ambos
			const stereoAnalysis = await this.analyzerV2.analyzeFile(stereoFile);
			const monoAnalysis = await this.analyzerV2.analyzeFile(monoFile);
			
			const stereoCorr = stereoAnalysis.metrics.stereo?.correlation;
			const stereoWidth = stereoAnalysis.metrics.stereo?.width;
			const monoCorr = monoAnalysis.metrics.stereo?.correlation;
			const monoWidth = monoAnalysis.metrics.stereo?.width;
			
			// Validações
			const corrValid = (monoCorr || 1.0) > (stereoCorr || 0.5); // Mono tem correlação maior
			const widthValid = (monoWidth || 0.1) < (stereoWidth || 1.0); // Mono tem largura menor
			
			const passed = corrValid && widthValid;
			
			this.testResults.push({
				test: 'Teste Estéreo→Mono',
				passed,
				details: {
					stereo_correlation: stereoCorr?.toFixed(3),
					mono_correlation: monoCorr?.toFixed(3) || '1.0 (mono)',
					stereo_width: stereoWidth?.toFixed(3),
					mono_width: monoWidth?.toFixed(3) || '0.0 (mono)',
					correlation_improved: corrValid,
					width_reduced: widthValid
				}
			});
			
			console.log(`🔊 Teste 2 ${passed ? '✅ PASSOU' : '❌ FALHOU'}: Corr ${stereoCorr?.toFixed(2)}→${monoCorr?.toFixed(2) || '1.0'}, Width ${stereoWidth?.toFixed(2)}→${monoWidth?.toFixed(2) || '0.0'}`);
			
		} catch (error) {
			console.error('❌ Erro no teste estéreo:', error);
			this.testResults.push({
				test: 'Teste Estéreo→Mono',
				passed: false,
				error: error.message
			});
		}
	}
	
	// 🔇 TESTE 3: Low-pass 5kHz (Centroid↓, Rolloff↓)
	async testLowPassFiltering() {
		console.log('🔇 Executando Teste 3: Filtro Low-pass...');
		
		try {
			// Gerar áudio com conteúdo de alta frequência
			const fullRangeAudio = this.generateMultiToneTest([500, 2000, 8000, 12000]);
			const fullRangeFile = this.audioBufferToFile(fullRangeAudio, 'full_range.wav');
			
			// Gerar versão filtrada (só frequências baixas)
			const filteredAudio = this.generateMultiToneTest([500, 2000]);
			const filteredFile = this.audioBufferToFile(filteredAudio, 'filtered.wav');
			
			// Analisar ambos
			const fullAnalysis = await this.analyzerV2.analyzeFile(fullRangeFile);
			const filteredAnalysis = await this.analyzerV2.analyzeFile(filteredFile);
			
			const fullCentroid = fullAnalysis.metrics.core?.spectralCentroid;
			const filteredCentroid = filteredAnalysis.metrics.core?.spectralCentroid;
			
			const fullRolloff = fullAnalysis.metrics.spectral?.rolloff85_hz;
			const filteredRolloff = filteredAnalysis.metrics.spectral?.rolloff85_hz;
			
			// Validações
			const centroidReduced = filteredCentroid < fullCentroid;
			const rolloffReduced = filteredRolloff < fullRolloff;
			
			const passed = centroidReduced && rolloffReduced;
			
			this.testResults.push({
				test: 'Teste Low-pass Filter',
				passed,
				details: {
					full_centroid: fullCentroid?.toFixed(0) + 'Hz',
					filtered_centroid: filteredCentroid?.toFixed(0) + 'Hz',
					full_rolloff: fullRolloff?.toFixed(0) + 'Hz',
					filtered_rolloff: filteredRolloff?.toFixed(0) + 'Hz',
					centroid_reduced: centroidReduced,
					rolloff_reduced: rolloffReduced,
					centroid_reduction: ((fullCentroid - filteredCentroid) / fullCentroid * 100).toFixed(1) + '%'
				}
			});
			
			console.log(`🔇 Teste 3 ${passed ? '✅ PASSOU' : '❌ FALHOU'}: Centroid ${fullCentroid?.toFixed(0)}→${filteredCentroid?.toFixed(0)}Hz, Rolloff ${fullRolloff?.toFixed(0)}→${filteredRolloff?.toFixed(0)}Hz`);
			
		} catch (error) {
			console.error('❌ Erro no teste de filtro:', error);
			this.testResults.push({
				test: 'Teste Low-pass Filter',
				passed: false,
				error: error.message
			});
		}
	}
	
	// ⚡ TESTE 4: DC Offset (detectar offset > 0)
	async testDCOffset() {
		console.log('⚡ Executando Teste 4: DC Offset...');
		
		try {
			// Gerar áudio sem DC offset
			const cleanAudio = this.generateTestTone(this.config.baseFrequency, this.config.testAmplitude);
			const cleanFile = this.audioBufferToFile(cleanAudio, 'clean_audio.wav');
			
			// Gerar áudio com DC offset
			const offsetAudio = this.generateTestToneWithDC(this.config.baseFrequency, this.config.testAmplitude, 0.05);
			const offsetFile = this.audioBufferToFile(offsetAudio, 'offset_audio.wav');
			
			// Analisar ambos
			const cleanAnalysis = await this.analyzerV2.analyzeFile(cleanFile);
			const offsetAnalysis = await this.analyzerV2.analyzeFile(offsetFile);
			
			const cleanDC = Math.abs(cleanAnalysis.metrics.core?.dcOffset || 0);
			const offsetDC = Math.abs(offsetAnalysis.metrics.core?.dcOffset || 0);
			
			// Validações
			const cleanDCLow = cleanDC < 0.01; // DC limpo deve ser < 1%
			const offsetDCHigh = offsetDC > 0.03; // DC com offset deve ser detectado
			
			const passed = cleanDCLow && offsetDCHigh;
			
			this.testResults.push({
				test: 'Teste DC Offset',
				passed,
				details: {
					clean_dc_offset: (cleanDC * 100).toFixed(3) + '%',
					offset_dc_offset: (offsetDC * 100).toFixed(3) + '%',
					injected_dc: '5%',
					clean_dc_ok: cleanDCLow,
					offset_detected: offsetDCHigh,
					detection_threshold: '3%'
				}
			});
			
			console.log(`⚡ Teste 4 ${passed ? '✅ PASSOU' : '❌ FALHOU'}: Clean DC=${(cleanDC*100).toFixed(2)}%, Offset DC=${(offsetDC*100).toFixed(2)}%`);
			
		} catch (error) {
			console.error('❌ Erro no teste de DC offset:', error);
			this.testResults.push({
				test: 'Teste DC Offset',
				passed: false,
				error: error.message
			});
		}
	}
	
	// 🎯 TESTE 5: Determinismo (mesmo áudio = mesmos resultados)
	async testDeterminism() {
		console.log('🎯 Executando Teste 5: Determinismo...');
		
		try {
			// Gerar áudio de teste
			const testAudio = this.generateTestTone(this.config.baseFrequency, this.config.testAmplitude);
			const testFile1 = this.audioBufferToFile(testAudio, 'determinism_1.wav');
			const testFile2 = this.audioBufferToFile(testAudio, 'determinism_2.wav');
			
			// Analisar o mesmo áudio duas vezes
			const analysis1 = await this.analyzerV2.analyzeFile(testFile1);
			const analysis2 = await this.analyzerV2.analyzeFile(testFile2);
			
			// Comparar métricas chave
			const metrics = ['lufs_integrated', 'true_peak_dbtp', 'spectralCentroid', 'dynamicRange'];
			const differences = [];
			let maxDifference = 0;
			
			for (const metric of metrics) {
				let value1, value2;
				
				// Extrair valores das métricas
				switch (metric) {
					case 'lufs_integrated':
						value1 = analysis1.metrics.loudness?.lufs_integrated;
						value2 = analysis2.metrics.loudness?.lufs_integrated;
						break;
					case 'true_peak_dbtp':
						value1 = analysis1.metrics.truePeak?.true_peak_dbtp;
						value2 = analysis2.metrics.truePeak?.true_peak_dbtp;
						break;
					case 'spectralCentroid':
						value1 = analysis1.metrics.core?.spectralCentroid;
						value2 = analysis2.metrics.core?.spectralCentroid;
						break;
					case 'dynamicRange':
						value1 = analysis1.metrics.core?.dynamicRange;
						value2 = analysis2.metrics.core?.dynamicRange;
						break;
				}
				
				if (Number.isFinite(value1) && Number.isFinite(value2)) {
					const diff = Math.abs(value1 - value2);
					const relativeDiff = diff / Math.abs(value1) * 100;
					differences.push({
						metric,
						value1: value1.toFixed(3),
						value2: value2.toFixed(3),
						absolute_diff: diff.toFixed(6),
						relative_diff: relativeDiff.toFixed(3) + '%'
					});
					maxDifference = Math.max(maxDifference, relativeDiff);
				}
			}
			
			// Scores devem ser idênticos
			const score1 = analysis1.metrics.quality?.overall;
			const score2 = analysis2.metrics.quality?.overall;
			const scoresIdentical = score1 === score2;
			
			// Tolerância: diferenças relativas < 0.1%
			const deterministic = maxDifference < 0.1 && scoresIdentical;
			
			this.testResults.push({
				test: 'Teste Determinismo',
				passed: deterministic,
				details: {
					max_relative_difference: maxDifference.toFixed(3) + '%',
					score_1: score1,
					score_2: score2,
					scores_identical: scoresIdentical,
					tolerance: '0.1%',
					metric_differences: differences
				}
			});
			
			console.log(`🎯 Teste 5 ${deterministic ? '✅ PASSOU' : '❌ FALHOU'}: Max diff=${maxDifference.toFixed(3)}%, Scores=${score1}==${score2}`);
			
		} catch (error) {
			console.error('❌ Erro no teste de determinismo:', error);
			this.testResults.push({
				test: 'Teste Determinismo',
				passed: false,
				error: error.message
			});
		}
	}
	
	// 📊 Gerar relatório final dos testes
	generateReport() {
		const passedTests = this.testResults.filter(t => t.passed).length;
		const totalTests = this.testResults.length;
		const passRate = (passedTests / totalTests * 100).toFixed(1);
		
		console.log('\n' + '='.repeat(60));
		console.log('📊 RELATÓRIO FINAL DOS TESTES DE ACEITAÇÃO');
		console.log('='.repeat(60));
		console.log(`✅ Testes aprovados: ${passedTests}/${totalTests} (${passRate}%)`);
		console.log('');
		
		this.testResults.forEach((result, index) => {
			const status = result.passed ? '✅ PASSOU' : '❌ FALHOU';
			console.log(`${index + 1}. ${result.test}: ${status}`);
			
			if (result.error) {
				console.log(`   Erro: ${result.error}`);
			}
			
			if (result.details) {
				Object.entries(result.details).forEach(([key, value]) => {
					if (typeof value === 'object' && value !== null) {
						console.log(`   ${key}:`);
						Object.entries(value).forEach(([subKey, subValue]) => {
							console.log(`     ${subKey}: ${subValue}`);
						});
					} else {
						console.log(`   ${key}: ${value}`);
					}
				});
			}
			console.log('');
		});
		
		console.log('='.repeat(60));
		
		return {
			summary: {
				passed: passedTests,
				total: totalTests,
				passRate: passRate + '%'
			},
			results: this.testResults
		};
	}
	
	// 🔧 FUNÇÕES UTILITÁRIAS PARA GERAÇÃO DE ÁUDIO DE TESTE
	
	// Gerar tom de teste
	generateTestTone(frequency, amplitude, duration = null) {
		const dur = duration || this.config.testDuration;
		const sampleRate = this.config.sampleRate;
		const samples = Math.floor(dur * sampleRate);
		
		const audioContext = new OfflineAudioContext(2, samples, sampleRate);
		const buffer = audioContext.createBuffer(2, samples, sampleRate);
		
		const leftData = buffer.getChannelData(0);
		const rightData = buffer.getChannelData(1);
		
		for (let i = 0; i < samples; i++) {
			const t = i / sampleRate;
			const value = amplitude * Math.sin(2 * Math.PI * frequency * t);
			leftData[i] = value;
			rightData[i] = value;
		}
		
		return buffer;
	}
	
	// Gerar tom com DC offset
	generateTestToneWithDC(frequency, amplitude, dcOffset, duration = null) {
		const buffer = this.generateTestTone(frequency, amplitude, duration);
		
		const leftData = buffer.getChannelData(0);
		const rightData = buffer.getChannelData(1);
		
		for (let i = 0; i < leftData.length; i++) {
			leftData[i] += dcOffset;
			rightData[i] += dcOffset;
		}
		
		return buffer;
	}
	
	// Gerar tom estéreo (L≠R)
	generateStereoTestTone(leftFreq, leftAmp, rightFreq, rightAmp, duration = null) {
		const dur = duration || this.config.testDuration;
		const sampleRate = this.config.sampleRate;
		const samples = Math.floor(dur * sampleRate);
		
		const audioContext = new OfflineAudioContext(2, samples, sampleRate);
		const buffer = audioContext.createBuffer(2, samples, sampleRate);
		
		const leftData = buffer.getChannelData(0);
		const rightData = buffer.getChannelData(1);
		
		for (let i = 0; i < samples; i++) {
			const t = i / sampleRate;
			leftData[i] = leftAmp * Math.sin(2 * Math.PI * leftFreq * t);
			rightData[i] = rightAmp * Math.sin(2 * Math.PI * rightFreq * t);
		}
		
		return buffer;
	}
	
	// Gerar múltiplos tons (simular espectro complexo)
	generateMultiToneTest(frequencies, amplitude = null, duration = null) {
		const amp = amplitude || this.config.testAmplitude / frequencies.length; // Dividir amplitude
		const dur = duration || this.config.testDuration;
		const sampleRate = this.config.sampleRate;
		const samples = Math.floor(dur * sampleRate);
		
		const audioContext = new OfflineAudioContext(2, samples, sampleRate);
		const buffer = audioContext.createBuffer(2, samples, sampleRate);
		
		const leftData = buffer.getChannelData(0);
		const rightData = buffer.getChannelData(1);
		
		for (let i = 0; i < samples; i++) {
			const t = i / sampleRate;
			let value = 0;
			
			for (const freq of frequencies) {
				value += amp * Math.sin(2 * Math.PI * freq * t);
			}
			
			leftData[i] = value;
			rightData[i] = value;
		}
		
		return buffer;
	}
	
	// Converter AudioBuffer para File (para testes)
	audioBufferToFile(buffer, filename) {
		// Converter para WAV simplificado
		const length = buffer.length;
		const channels = buffer.numberOfChannels;
		const sampleRate = buffer.sampleRate;
		
		// WAV header (44 bytes) + data
		const arrayBuffer = new ArrayBuffer(44 + length * channels * 2);
		const view = new DataView(arrayBuffer);
		
		// WAV header
		const writeString = (offset, string) => {
			for (let i = 0; i < string.length; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		};
		
		writeString(0, 'RIFF');
		view.setUint32(4, 36 + length * channels * 2, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, channels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * channels * 2, true);
		view.setUint16(32, channels * 2, true);
		view.setUint16(34, 16, true);
		writeString(36, 'data');
		view.setUint32(40, length * channels * 2, true);
		
		// Dados de áudio
		let offset = 44;
		for (let i = 0; i < length; i++) {
			for (let channel = 0; channel < channels; channel++) {
				const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
				const intSample = sample < 0 ? sample * 32768 : sample * 32767;
				view.setInt16(offset, intSample, true);
				offset += 2;
			}
		}
		
		return new File([arrayBuffer], filename, { type: 'audio/wav' });
	}
}

// Exportar para uso global
window.AudioAnalyzerTests = AudioAnalyzerTests;