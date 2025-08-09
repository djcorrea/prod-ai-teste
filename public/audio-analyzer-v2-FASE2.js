/**
 * 🎵 AUDIO ANALYZER V2 - FASE 2: CORE FEATURES
 * Implementa as 12 métricas principais de análise de áudio
 * Seguindo o plano: Fase 2 - Features core (12 métricas viáveis): 3-4 dias
 */

class AudioAnalyzerV2 {
    constructor(config = {}) {
        this.config = {
            version: '2.0.0-FASE2',
            phase: 'Core Features',
            enabledMetrics: [
                'spectralCentroid',      // 1. Centro espectral
                'spectralRolloff',       // 2. Rolloff espectral  
                'spectralSpread',        // 3. Espalhamento espectral
                'spectralFlatness',      // 4. Planura espectral
                'rms',                   // 5. RMS (energia)
                'loudness',              // 6. Loudness
                'mfcc',                  // 7. MFCC (timbral)
                'chromaticityCoefficient', // 8. Cromaticidade
                'spectralSlope',         // 9. Inclinação espectral
                'spectralKurtosis',      // 10. Curtose espectral
                'spectralSkewness',      // 11. Assimetria espectral
                'harmonicRatio'          // 12. Razão harmônica
            ],
            sampleRate: 44100,
            bufferSize: 2048,
            windowFunction: 'hamming',
            ...config
        };
        
        this.audioContext = null;
        this.analyser = null;
        this.isInitialized = false;
        this.analysisBuffer = new Float32Array(this.config.bufferSize);
        this.frequencyData = new Float32Array(this.config.bufferSize / 2);
        
        // Resultados das 12 métricas core
        this.coreMetrics = {
            spectralCentroid: 0,
            spectralRolloff: 0,
            spectralSpread: 0,
            spectralFlatness: 0,
            rms: 0,
            loudness: 0,
            mfcc: [],
            chromaticityCoefficient: 0,
            spectralSlope: 0,
            spectralKurtosis: 0,
            spectralSkewness: 0,
            harmonicRatio: 0
        };
        
        console.log(`🎵 Audio Analyzer V2 ${this.config.version} - ${this.config.phase}`);
        console.log(`📊 Métricas ativadas: ${this.config.enabledMetrics.length}/12`);
    }
    
    async initialize() {
        try {
            console.log('🎵 Inicializando Audio Analyzer V2 - FASE 2...');
            
            // Verificar dependências
            if (typeof Meyda === 'undefined') {
                console.warn('⚠️ Meyda library não encontrada - usando cálculos manuais');
            }
            
            // Configurar Meyda se disponível
            if (typeof Meyda !== 'undefined') {
                Meyda.bufferSize = this.config.bufferSize;
                Meyda.sampleRate = this.config.sampleRate;
                Meyda.windowingFunction = this.config.windowFunction;
                
                // Verificar features disponíveis no Meyda
                const availableFeatures = Object.keys(Meyda.featureExtractors);
                const supportedMetrics = this.config.enabledMetrics.filter(metric => 
                    availableFeatures.includes(metric)
                );
                
                console.log(`✅ ${supportedMetrics.length} métricas suportadas pelo Meyda`);
                console.log(`📋 Métricas: ${supportedMetrics.join(', ')}`);
            }
            
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            throw error;
        }
    }
    
    async analyzeFile(audioFile) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        console.log(`🎵 Analisando arquivo: ${audioFile.name}`);
        console.log(`📊 FASE 2: Extraindo 12 métricas core...`);
        
        try {
            // Carregar arquivo de áudio
            const audioBuffer = await this.loadAudioFile(audioFile);
            
            // Extrair as 12 métricas core
            const metrics = await this.extractCoreMetrics(audioBuffer);
            
            // Calcular score geral baseado nas métricas
            const overallScore = this.calculateOverallScore(metrics);
            
            const results = {
                version: this.config.version,
                phase: this.config.phase,
                filename: audioFile.name,
                timestamp: Date.now(),
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                channels: audioBuffer.numberOfChannels,
                coreMetrics: metrics,
                overallScore: overallScore,
                analysis: this.interpretMetrics(metrics),
                recommendations: this.generateRecommendations(metrics)
            };
            
            console.log(`✅ Análise completa - Score: ${overallScore.toFixed(1)}%`);
            return results;
            
        } catch (error) {
            console.error('❌ Erro na análise:', error);
            throw error;
        }
    }
    
    async loadAudioFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const arrayBuffer = event.target.result;
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    resolve(audioBuffer);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsArrayBuffer(file);
        });
    }
    
    async extractCoreMetrics(audioBuffer) {
        const audioData = audioBuffer.getChannelData(0); // Mono para análise
        const metrics = { ...this.coreMetrics };
        
        console.log('📊 Extraindo métricas com Meyda...');
        
        try {
            // Usar Meyda para extrair todas as features de uma vez
            if (typeof Meyda !== 'undefined') {
                const meydaFeatures = Meyda.extract(this.config.enabledMetrics, audioData);
                
                // Mapear resultados do Meyda para nossas métricas
                if (meydaFeatures) {
                    metrics.spectralCentroid = meydaFeatures.spectralCentroid || 0;
                    metrics.spectralRolloff = meydaFeatures.spectralRolloff || 0;
                    metrics.spectralSpread = meydaFeatures.spectralSpread || 0;
                    metrics.spectralFlatness = meydaFeatures.spectralFlatness || 0;
                    metrics.rms = meydaFeatures.rms || 0;
                    metrics.loudness = meydaFeatures.loudness?.specific || 0;
                    metrics.mfcc = meydaFeatures.mfcc || [];
                    metrics.spectralSlope = meydaFeatures.spectralSlope || 0;
                    metrics.spectralKurtosis = meydaFeatures.spectralKurtosis || 0;
                    metrics.spectralSkewness = meydaFeatures.spectralSkewness || 0;
                    
                    console.log('✅ Métricas Meyda extraídas');
                }
            }
            
            // Calcular métricas customizadas que o Meyda não tem
            metrics.chromaticityCoefficient = this.calculateChromaticity(audioData);
            metrics.harmonicRatio = this.calculateHarmonicRatio(audioData);
            
            // Normalizar valores
            this.normalizeMetrics(metrics);
            
            console.log('📊 12 métricas core extraídas:');
            Object.keys(metrics).forEach(key => {
                if (Array.isArray(metrics[key])) {
                    console.log(`  ${key}: [${metrics[key].length} valores]`);
                } else {
                    console.log(`  ${key}: ${metrics[key].toFixed(3)}`);
                }
            });
            
            return metrics;
            
        } catch (error) {
            console.error('❌ Erro na extração de métricas:', error);
            
            // Fallback: calcular métricas manualmente
            return this.calculateMetricsManually(audioData);
        }
    }
    
    calculateMetricsManually(audioData) {
        console.log('⚠️ Usando cálculo manual de métricas...');
        
        const metrics = { ...this.coreMetrics };
        
        // 1. RMS (Root Mean Square) - Energia do sinal
        metrics.rms = this.calculateRMS(audioData);
        
        // 2. Spectral Centroid - "Brilho" do som
        const spectrum = this.getSpectrum(audioData);
        metrics.spectralCentroid = this.calculateSpectralCentroid(spectrum);
        
        // 3. Spectral Rolloff - Frequência onde 85% da energia está contida
        metrics.spectralRolloff = this.calculateSpectralRolloff(spectrum);
        
        // 4. Spectral Spread - Dispersão do espectro
        metrics.spectralSpread = this.calculateSpectralSpread(spectrum, metrics.spectralCentroid);
        
        // 5. Spectral Flatness - "Ruído" vs "Tonal"
        metrics.spectralFlatness = this.calculateSpectralFlatness(spectrum);
        
        // 6. Loudness - Percepção subjetiva de volume
        metrics.loudness = this.calculateLoudness(audioData);
        
        // 7. MFCC - Mel-Frequency Cepstral Coefficients (timbral)
        metrics.mfcc = this.calculateMFCC(spectrum);
        
        // 8. Chromaticity - Conteúdo harmônico
        metrics.chromaticityCoefficient = this.calculateChromaticity(audioData);
        
        // 9. Spectral Slope - Inclinação espectral
        metrics.spectralSlope = this.calculateSpectralSlope(spectrum);
        
        // 10. Spectral Kurtosis - "Peakiness" do espectro
        metrics.spectralKurtosis = this.calculateSpectralKurtosis(spectrum);
        
        // 11. Spectral Skewness - Assimetria do espectro
        metrics.spectralSkewness = this.calculateSpectralSkewness(spectrum);
        
        // 12. Harmonic Ratio - Razão harmônico/inarmônico
        metrics.harmonicRatio = this.calculateHarmonicRatio(audioData);
        
        this.normalizeMetrics(metrics);
        return metrics;
    }
    
    // IMPLEMENTAÇÃO DAS 12 MÉTRICAS CORE
    
    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }
    
    getSpectrum(audioData) {
        // FFT simples para obter espectro
        const N = Math.min(audioData.length, this.config.bufferSize);
        const spectrum = new Float32Array(N / 2);
        
        // Aplicar janela de Hamming
        const windowed = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            windowed[i] = audioData[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1)));
        }
        
        // FFT básica (simplificada)
        for (let k = 0; k < N / 2; k++) {
            let real = 0, imag = 0;
            for (let n = 0; n < N; n++) {
                const angle = -2 * Math.PI * k * n / N;
                real += windowed[n] * Math.cos(angle);
                imag += windowed[n] * Math.sin(angle);
            }
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }
        
        return spectrum;
    }
    
    calculateSpectralCentroid(spectrum) {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            weightedSum += i * spectrum[i];
            magnitudeSum += spectrum[i];
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    calculateSpectralRolloff(spectrum, threshold = 0.85) {
        const totalEnergy = spectrum.reduce((sum, val) => sum + val * val, 0);
        const targetEnergy = totalEnergy * threshold;
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < spectrum.length; i++) {
            cumulativeEnergy += spectrum[i] * spectrum[i];
            if (cumulativeEnergy >= targetEnergy) {
                return i / spectrum.length; // Normalizado
            }
        }
        return 1.0;
    }
    
    calculateSpectralSpread(spectrum, centroid) {
        let sum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            sum += Math.pow(i - centroid, 2) * spectrum[i];
            magnitudeSum += spectrum[i];
        }
        
        return magnitudeSum > 0 ? Math.sqrt(sum / magnitudeSum) : 0;
    }
    
    calculateSpectralFlatness(spectrum) {
        let geometricMean = 1;
        let arithmeticMean = 0;
        const n = spectrum.length;
        
        for (let i = 0; i < n; i++) {
            const magnitude = spectrum[i] + 1e-10; // Evitar log(0)
            geometricMean *= Math.pow(magnitude, 1 / n);
            arithmeticMean += magnitude / n;
        }
        
        return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
    
    calculateLoudness(audioData) {
        // A-weighting aproximado para loudness perceptual
        const rms = this.calculateRMS(audioData);
        return 20 * Math.log10(rms + 1e-10); // Em dB
    }
    
    calculateMFCC(spectrum) {
        // MFCC simplificado - primeiros 13 coeficientes
        const mfcc = [];
        const numCoeffs = 13;
        const numFilters = 26;
        const minFreq = 0;
        const maxFreq = this.config.sampleRate / 2;
        
        // Criar banco de filtros mel
        const melFilters = this.createMelFilterBank(numFilters, spectrum.length, minFreq, maxFreq);
        
        // Aplicar filtros
        const filterOutputs = [];
        for (let i = 0; i < numFilters; i++) {
            let output = 0;
            for (let j = 0; j < spectrum.length; j++) {
                output += spectrum[j] * melFilters[i][j];
            }
            filterOutputs.push(Math.log(output + 1e-10));
        }
        
        // DCT para obter coeficientes cepstrais
        for (let i = 0; i < numCoeffs; i++) {
            let coeff = 0;
            for (let j = 0; j < numFilters; j++) {
                coeff += filterOutputs[j] * Math.cos(Math.PI * i * (j + 0.5) / numFilters);
            }
            mfcc.push(coeff);
        }
        
        return mfcc;
    }
    
    createMelFilterBank(numFilters, spectrumLength, minFreq, maxFreq) {
        const filters = [];
        
        // Converter para escala mel
        const melMin = this.hzToMel(minFreq);
        const melMax = this.hzToMel(maxFreq);
        const melStep = (melMax - melMin) / (numFilters + 1);
        
        for (let i = 0; i < numFilters; i++) {
            const filter = new Float32Array(spectrumLength);
            
            const melCenter = melMin + (i + 1) * melStep;
            const hzCenter = this.melToHz(melCenter);
            const binCenter = Math.round(hzCenter * spectrumLength * 2 / this.config.sampleRate);
            
            // Filtro triangular simples
            const width = Math.max(1, Math.round(spectrumLength / numFilters));
            const start = Math.max(0, binCenter - width);
            const end = Math.min(spectrumLength, binCenter + width);
            
            for (let j = start; j < end; j++) {
                filter[j] = 1 - Math.abs(j - binCenter) / width;
            }
            
            filters.push(filter);
        }
        
        return filters;
    }
    
    hzToMel(hz) {
        return 2595 * Math.log10(1 + hz / 700);
    }
    
    melToHz(mel) {
        return 700 * (Math.pow(10, mel / 2595) - 1);
    }
    
    calculateChromaticity(audioData) {
        // Análise de conteúdo harmônico baseada em autocorrelação
        let maxCorrelation = 0;
        const maxLag = Math.min(audioData.length / 2, 1000);
        
        for (let lag = 1; lag < maxLag; lag++) {
            let correlation = 0;
            for (let i = 0; i < audioData.length - lag; i++) {
                correlation += audioData[i] * audioData[i + lag];
            }
            correlation /= (audioData.length - lag);
            
            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
            }
        }
        
        return maxCorrelation;
    }
    
    calculateSpectralSlope(spectrum) {
        const n = spectrum.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            const x = i;
            const y = Math.log(spectrum[i] + 1e-10);
            
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }
    
    calculateSpectralKurtosis(spectrum) {
        const mean = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
        const variance = spectrum.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spectrum.length;
        const fourthMoment = spectrum.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / spectrum.length;
        
        return variance > 0 ? fourthMoment / Math.pow(variance, 2) - 3 : 0;
    }
    
    calculateSpectralSkewness(spectrum) {
        const mean = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
        const variance = spectrum.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spectrum.length;
        const thirdMoment = spectrum.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / spectrum.length;
        
        return variance > 0 ? thirdMoment / Math.pow(variance, 1.5) : 0;
    }
    
    calculateHarmonicRatio(audioData) {
        // Razão entre energia harmônica e inarmônica
        const spectrum = this.getSpectrum(audioData);
        const fundamental = this.findFundamental(spectrum);
        
        if (fundamental === 0) return 0;
        
        let harmonicEnergy = 0;
        let totalEnergy = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            const energy = spectrum[i] * spectrum[i];
            totalEnergy += energy;
            
            // Verificar se está próximo de um harmônico
            const harmonic = i / fundamental;
            const nearestInteger = Math.round(harmonic);
            if (Math.abs(harmonic - nearestInteger) < 0.1 && nearestInteger > 0) {
                harmonicEnergy += energy;
            }
        }
        
        return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
    }
    
    findFundamental(spectrum) {
        let maxMagnitude = 0;
        let fundamental = 0;
        
        // Procurar na região de baixa frequência
        for (let i = 1; i < Math.min(spectrum.length / 4, 100); i++) {
            if (spectrum[i] > maxMagnitude) {
                maxMagnitude = spectrum[i];
                fundamental = i;
            }
        }
        
        return fundamental;
    }
    
    normalizeMetrics(metrics) {
        // Normalizar métricas para faixas úteis [0-1]
        
        if (metrics.spectralCentroid) {
            metrics.spectralCentroid = Math.min(metrics.spectralCentroid / 1000, 1); // Normalizar por 1kHz
        }
        
        if (metrics.rms) {
            metrics.rms = Math.min(Math.abs(metrics.rms) * 10, 1); // Amplificar RMS baixos
        }
        
        if (metrics.loudness && metrics.loudness > -100) {
            metrics.loudness = Math.min((metrics.loudness + 60) / 60, 1); // -60dB a 0dB -> 0-1
        }
        
        // Normalizar estatísticas espectrais
        metrics.spectralFlatness = Math.min(Math.abs(metrics.spectralFlatness), 1);
        metrics.harmonicRatio = Math.min(Math.abs(metrics.harmonicRatio), 1);
        metrics.chromaticityCoefficient = Math.min(Math.abs(metrics.chromaticityCoefficient), 1);
        
        // MFCC: normalizar primeiros coeficientes
        if (metrics.mfcc && metrics.mfcc.length > 0) {
            for (let i = 0; i < Math.min(metrics.mfcc.length, 5); i++) {
                metrics.mfcc[i] = Math.min(Math.abs(metrics.mfcc[i]) / 10, 1);
            }
        }
    }
    
    calculateOverallScore(metrics) {
        // Score baseado nas 12 métricas core (FASE 2)
        let score = 0;
        let count = 0;
        
        // Pesos para diferentes métricas
        const weights = {
            rms: 0.15,                    // Energia importante
            spectralCentroid: 0.12,       // Brilho
            spectralFlatness: 0.10,       // Tonalidade vs ruído
            harmonicRatio: 0.10,          // Harmônicos
            loudness: 0.08,               // Volume percebido
            spectralRolloff: 0.08,        // Conteúdo de alta freq
            spectralSpread: 0.07,         // Dispersão
            chromaticityCoefficient: 0.07, // Conteúdo harmônico
            spectralSlope: 0.06,          // Inclinação
            spectralKurtosis: 0.06,       // Peakiness
            spectralSkewness: 0.06,       // Assimetria
            mfcc: 0.05                    // Características timbrais
        };
        
        Object.keys(weights).forEach(key => {
            if (metrics[key] !== undefined && metrics[key] !== null) {
                let value = 0;
                
                if (Array.isArray(metrics[key])) {
                    // Para MFCC, usar média dos primeiros coeficientes
                    const relevantCoeffs = metrics[key].slice(0, 5);
                    value = relevantCoeffs.reduce((sum, val) => sum + Math.abs(val), 0) / relevantCoeffs.length;
                } else {
                    value = Math.abs(metrics[key]);
                }
                
                score += value * weights[key];
                count++;
            }
        });
        
        // Converter para percentual
        const normalizedScore = Math.min(score * 100, 100);
        
        console.log(`📊 Score calculado: ${normalizedScore.toFixed(1)}% (${count} métricas)`);
        return normalizedScore;
    }
    
    interpretMetrics(metrics) {
        const interpretation = {
            brightness: this.interpretBrightness(metrics.spectralCentroid),
            energy: this.interpretEnergy(metrics.rms),
            tonality: this.interpretTonality(metrics.spectralFlatness),
            harmony: this.interpretHarmony(metrics.harmonicRatio),
            richness: this.interpretRichness(metrics.spectralSpread),
            balance: this.interpretBalance(metrics.spectralSlope),
            overall: 'balanced'
        };
        
        // Interpretação geral baseada nas métricas
        if (metrics.rms > 0.7 && metrics.spectralCentroid > 0.6) {
            interpretation.overall = 'bright_energetic';
        } else if (metrics.harmonicRatio > 0.6 && metrics.spectralFlatness < 0.3) {
            interpretation.overall = 'harmonic_tonal';
        } else if (metrics.spectralFlatness > 0.7) {
            interpretation.overall = 'noisy_textured';
        } else if (metrics.rms < 0.3) {
            interpretation.overall = 'quiet_subdued';
        }
        
        return interpretation;
    }
    
    interpretBrightness(centroid) {
        if (centroid > 0.7) return 'very_bright';
        if (centroid > 0.5) return 'bright';
        if (centroid > 0.3) return 'balanced';
        return 'dark';
    }
    
    interpretEnergy(rms) {
        if (rms > 0.8) return 'very_high';
        if (rms > 0.6) return 'high';
        if (rms > 0.4) return 'medium';
        if (rms > 0.2) return 'low';
        return 'very_low';
    }
    
    interpretTonality(flatness) {
        if (flatness < 0.2) return 'very_tonal';
        if (flatness < 0.4) return 'tonal';
        if (flatness < 0.6) return 'mixed';
        if (flatness < 0.8) return 'noisy';
        return 'very_noisy';
    }
    
    interpretHarmony(ratio) {
        if (ratio > 0.8) return 'very_harmonic';
        if (ratio > 0.6) return 'harmonic';
        if (ratio > 0.4) return 'moderately_harmonic';
        if (ratio > 0.2) return 'inharmonic';
        return 'very_inharmonic';
    }
    
    interpretRichness(spread) {
        if (spread > 80) return 'very_rich';
        if (spread > 60) return 'rich';
        if (spread > 40) return 'moderate';
        if (spread > 20) return 'simple';
        return 'very_simple';
    }
    
    interpretBalance(slope) {
        if (Math.abs(slope) < 0.01) return 'balanced';
        if (slope > 0.05) return 'bass_heavy';
        if (slope < -0.05) return 'treble_heavy';
        return 'slightly_imbalanced';
    }
    
    generateRecommendations(metrics) {
        const recommendations = [];
        
        // Recomendações baseadas nas métricas FASE 2
        if (metrics.rms < 0.3) {
            recommendations.push('Considere aumentar o ganho geral do áudio');
        }
        
        if (metrics.spectralCentroid < 0.3) {
            recommendations.push('Áudio pode se beneficiar de realce nas frequências agudas');
        }
        
        if (metrics.spectralCentroid > 0.8) {
            recommendations.push('Considere reduzir frequências muito agudas para suavizar');
        }
        
        if (metrics.spectralFlatness > 0.8) {
            recommendations.push('Áudio possui muito ruído - considere filtragem');
        }
        
        if (metrics.harmonicRatio < 0.3) {
            recommendations.push('Baixo conteúdo harmônico - pode ser música atonal ou com distorção');
        }
        
        if (metrics.loudness < -40) {
            recommendations.push('Áudio muito baixo - considere normalização');
        }
        
        if (metrics.loudness > -5) {
            recommendations.push('Áudio pode estar com clipping - verificar limitação');
        }
        
        if (Math.abs(metrics.spectralSlope) > 0.05) {
            recommendations.push('Desequilíbrio espectral detectado - considere equalização');
        }
        
        return recommendations;
    }
}

// Exportar para uso global
window.AudioAnalyzerV2 = AudioAnalyzerV2;

console.log('✅ Audio Analyzer V2 FASE 2 (Core Features) carregado - 12 métricas implementadas');
