/**
 * 🎵 Audio Analyzer V2 - Advanced Features
 * Phase 2: Funcionalidades Avançadas
 * Implementa análise espectral avançada, presets, exportação e visualizações
 */

class AudioAnalyzerV2Advanced {
    constructor(config = {}) {
        this.config = {
            ...AudioAnalyzerV2Config?.advanced || {},
            ...config
        };
        
        this.presets = {
            rock: {
                name: 'Rock/Metal',
                features: ['spectralCentroid', 'spectralRolloff', 'loudness', 'energy'],
                weights: { bass: 1.2, mid: 1.0, treble: 1.3 },
                thresholds: { energy: 0.7, loudness: 0.8 }
            },
            electronic: {
                name: 'Electronic/EDM',
                features: ['spectralFlux', 'spectralSpread', 'spectralSkewness', 'mfcc'],
                weights: { bass: 1.5, mid: 0.8, treble: 1.1 },
                thresholds: { flux: 0.6, spread: 0.5 }
            },
            classical: {
                name: 'Classical/Orchestra',
                features: ['spectralCentroid', 'harmonicRatio', 'spectralFlatness'],
                weights: { bass: 0.8, mid: 1.2, treble: 1.0 },
                thresholds: { harmonic: 0.7, flatness: 0.3 }
            },
            jazz: {
                name: 'Jazz/Blues',
                features: ['chroma', 'spectralRolloff', 'complexSpectralDifference'],
                weights: { bass: 1.1, mid: 1.3, treble: 0.9 },
                thresholds: { chroma: 0.5, rolloff: 0.6 }
            },
            vocal: {
                name: 'Vocal/Speech',
                features: ['mfcc', 'spectralCentroid', 'harmonicRatio'],
                weights: { bass: 0.7, mid: 1.5, treble: 1.2 },
                thresholds: { mfcc: 0.8, harmonic: 0.9 }
            }
        };
        
        this.visualizations = new Map();
        this.analysisHistory = [];
        this.webWorker = null;
        
        this.initializeAdvancedFeatures();
    }
    
    initializeAdvancedFeatures() {
        console.log('🎵 Inicializando Audio Analyzer V2 Advanced Features...');
        
        // Initialize Web Worker for heavy computations
        if (this.config.useWebWorker && typeof Worker !== 'undefined') {
            this.initializeWebWorker();
        }
        
        // Initialize visualization canvases
        this.initializeVisualizations();
        
        // Setup real-time analysis
        this.setupRealTimeAnalysis();
    }
    
    initializeWebWorker() {
        try {
            const workerBlob = new Blob([this.getWorkerScript()], {
                type: 'application/javascript'
            });
            this.webWorker = new Worker(URL.createObjectURL(workerBlob));
            
            this.webWorker.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };
            
            console.log('✅ Web Worker initialized for advanced processing');
        } catch (error) {
            console.warn('⚠️ Web Worker não disponível:', error);
        }
    }
    
    getWorkerScript() {
        return `
            // Web Worker for heavy audio processing
            self.onmessage = function(event) {
                const { type, data } = event.data;
                
                switch (type) {
                    case 'ANALYZE_SPECTRUM':
                        analyzeSpectrum(data);
                        break;
                    case 'CALCULATE_FEATURES':
                        calculateAdvancedFeatures(data);
                        break;
                    case 'GENERATE_REPORT':
                        generateReport(data);
                        break;
                }
            };
            
            function analyzeSpectrum(audioData) {
                // Advanced spectrum analysis in worker
                const result = {
                    frequencies: [],
                    amplitudes: [],
                    peaks: [],
                    harmonics: []
                };
                
                // Perform FFT and peak detection
                const fftSize = audioData.length;
                const nyquist = 22050; // Assuming 44.1kHz sample rate
                
                for (let i = 0; i < fftSize / 2; i++) {
                    const frequency = (i * nyquist) / (fftSize / 2);
                    const amplitude = Math.sqrt(
                        audioData[i * 2] ** 2 + audioData[i * 2 + 1] ** 2
                    );
                    
                    result.frequencies.push(frequency);
                    result.amplitudes.push(amplitude);
                    
                    // Detect peaks
                    if (amplitude > 0.1 && i > 0 && i < fftSize / 2 - 1) {
                        if (amplitude > audioData[i - 1] && amplitude > audioData[i + 1]) {
                            result.peaks.push({ frequency, amplitude });
                        }
                    }
                }
                
                self.postMessage({
                    type: 'SPECTRUM_ANALYZED',
                    result: result
                });
            }
            
            function calculateAdvancedFeatures(data) {
                const features = {
                    spectralComplexity: calculateSpectralComplexity(data),
                    rhythmicComplexity: calculateRhythmicComplexity(data),
                    harmonicComplexity: calculateHarmonicComplexity(data),
                    timbreProfile: calculateTimbreProfile(data)
                };
                
                self.postMessage({
                    type: 'FEATURES_CALCULATED',
                    features: features
                });
            }
            
            function calculateSpectralComplexity(data) {
                // Shannon entropy of spectrum
                let entropy = 0;
                const sum = data.reduce((a, b) => a + Math.abs(b), 0);
                
                for (let i = 0; i < data.length; i++) {
                    const prob = Math.abs(data[i]) / sum;
                    if (prob > 0) {
                        entropy -= prob * Math.log2(prob);
                    }
                }
                
                return entropy / Math.log2(data.length);
            }
            
            function calculateRhythmicComplexity(data) {
                // Autocorrelation for rhythm detection
                const autocorr = [];
                const maxLag = Math.min(data.length / 2, 1000);
                
                for (let lag = 0; lag < maxLag; lag++) {
                    let sum = 0;
                    for (let i = 0; i < data.length - lag; i++) {
                        sum += data[i] * data[i + lag];
                    }
                    autocorr.push(sum / (data.length - lag));
                }
                
                // Find periodic patterns
                const peaks = [];
                for (let i = 1; i < autocorr.length - 1; i++) {
                    if (autocorr[i] > autocorr[i - 1] && autocorr[i] > autocorr[i + 1]) {
                        peaks.push({ lag: i, strength: autocorr[i] });
                    }
                }
                
                return peaks.length / maxLag;
            }
            
            function calculateHarmonicComplexity(data) {
                // Harmonic-to-noise ratio estimation
                const fundamentalBin = findFundamentalFrequency(data);
                let harmonicEnergy = 0;
                let totalEnergy = 0;
                
                for (let i = 0; i < data.length; i++) {
                    const energy = data[i] ** 2;
                    totalEnergy += energy;
                    
                    // Check if this bin is near a harmonic
                    const isHarmonic = isNearHarmonic(i, fundamentalBin);
                    if (isHarmonic) {
                        harmonicEnergy += energy;
                    }
                }
                
                return harmonicEnergy / totalEnergy;
            }
            
            function findFundamentalFrequency(data) {
                let maxAmplitude = 0;
                let fundamentalBin = 0;
                
                // Look in the low frequency range for fundamental
                for (let i = 1; i < Math.min(data.length / 8, 200); i++) {
                    if (data[i] > maxAmplitude) {
                        maxAmplitude = data[i];
                        fundamentalBin = i;
                    }
                }
                
                return fundamentalBin;
            }
            
            function isNearHarmonic(bin, fundamentalBin) {
                if (fundamentalBin === 0) return false;
                
                const harmonic = bin / fundamentalBin;
                const nearestInteger = Math.round(harmonic);
                
                return Math.abs(harmonic - nearestInteger) < 0.1 && nearestInteger > 0;
            }
            
            function calculateTimbreProfile(data) {
                return {
                    brightness: calculateBrightness(data),
                    roughness: calculateRoughness(data),
                    warmth: calculateWarmth(data),
                    clarity: calculateClarity(data)
                };
            }
            
            function calculateBrightness(data) {
                const midPoint = data.length / 2;
                let highFreqEnergy = 0;
                let totalEnergy = 0;
                
                for (let i = 0; i < data.length; i++) {
                    const energy = data[i] ** 2;
                    totalEnergy += energy;
                    
                    if (i > midPoint) {
                        highFreqEnergy += energy;
                    }
                }
                
                return highFreqEnergy / totalEnergy;
            }
            
            function calculateRoughness(data) {
                // Spectral irregularity
                let roughness = 0;
                for (let i = 1; i < data.length - 1; i++) {
                    roughness += Math.abs(data[i] - (data[i - 1] + data[i + 1]) / 2);
                }
                return roughness / data.length;
            }
            
            function calculateWarmth(data) {
                const lowMidPoint = data.length / 4;
                let lowMidEnergy = 0;
                let totalEnergy = 0;
                
                for (let i = 0; i < data.length; i++) {
                    const energy = data[i] ** 2;
                    totalEnergy += energy;
                    
                    if (i < lowMidPoint) {
                        lowMidEnergy += energy;
                    }
                }
                
                return lowMidEnergy / totalEnergy;
            }
            
            function calculateClarity(data) {
                // Signal-to-noise ratio estimation
                const sortedData = [...data].sort((a, b) => Math.abs(b) - Math.abs(a));
                const signalLevel = sortedData.slice(0, data.length / 10).reduce((sum, val) => sum + Math.abs(val), 0);
                const noiseLevel = sortedData.slice(-data.length / 10).reduce((sum, val) => sum + Math.abs(val), 0);
                
                return signalLevel / (noiseLevel + 1e-6);
            }
            
            function generateReport(data) {
                // Generate comprehensive analysis report
                const report = {
                    timestamp: Date.now(),
                    summary: generateSummary(data),
                    recommendations: generateRecommendations(data),
                    technicalDetails: generateTechnicalDetails(data)
                };
                
                self.postMessage({
                    type: 'REPORT_GENERATED',
                    report: report
                });
            }
            
            function generateSummary(data) {
                return {
                    overallQuality: calculateOverallQuality(data),
                    musicalGenre: predictMusicalGenre(data),
                    emotionalTone: analyzeEmotionalTone(data),
                    production: analyzeProduction(data)
                };
            }
            
            function calculateOverallQuality(data) {
                // Composite quality score
                const clarity = calculateClarity(data);
                const balance = calculateSpectralBalance(data);
                const dynamics = calculateDynamicRange(data);
                
                return (clarity * 0.4 + balance * 0.3 + dynamics * 0.3) * 100;
            }
            
            function calculateSpectralBalance(data) {
                const third = data.length / 3;
                let bassEnergy = 0, midEnergy = 0, trebleEnergy = 0;
                
                for (let i = 0; i < data.length; i++) {
                    const energy = data[i] ** 2;
                    if (i < third) bassEnergy += energy;
                    else if (i < third * 2) midEnergy += energy;
                    else trebleEnergy += energy;
                }
                
                const total = bassEnergy + midEnergy + trebleEnergy;
                const ideal = total / 3;
                
                const bassDeviation = Math.abs(bassEnergy - ideal) / ideal;
                const midDeviation = Math.abs(midEnergy - ideal) / ideal;
                const trebleDeviation = Math.abs(trebleEnergy - ideal) / ideal;
                
                return 1 - (bassDeviation + midDeviation + trebleDeviation) / 3;
            }
            
            function calculateDynamicRange(data) {
                const max = Math.max(...data.map(Math.abs));
                const rms = Math.sqrt(data.reduce((sum, val) => sum + val ** 2, 0) / data.length);
                
                return Math.min(max / (rms + 1e-6), 10) / 10;
            }
            
            function predictMusicalGenre(data) {
                // Simple genre classification based on spectral features
                const features = calculateTimbreProfile(data);
                
                if (features.brightness > 0.7 && features.roughness > 0.5) {
                    return 'Electronic/EDM';
                } else if (features.warmth > 0.6 && features.roughness < 0.3) {
                    return 'Classical/Orchestral';
                } else if (features.brightness > 0.5 && features.roughness > 0.4) {
                    return 'Rock/Metal';
                } else if (features.warmth > 0.5 && features.clarity > 0.6) {
                    return 'Jazz/Blues';
                } else {
                    return 'Pop/Alternative';
                }
            }
            
            function analyzeEmotionalTone(data) {
                const spectral = calculateSpectralComplexity(data);
                const rhythmic = calculateRhythmicComplexity(data);
                const harmonic = calculateHarmonicComplexity(data);
                
                if (harmonic > 0.7 && spectral < 0.4) return 'Peaceful/Calm';
                if (rhythmic > 0.6 && spectral > 0.6) return 'Energetic/Exciting';
                if (harmonic < 0.3 && spectral > 0.7) return 'Tense/Aggressive';
                if (harmonic > 0.5 && rhythmic < 0.3) return 'Melancholic/Sad';
                return 'Neutral/Balanced';
            }
            
            function analyzeProduction(data) {
                return {
                    compression: calculateCompression(data),
                    saturation: calculateSaturation(data),
                    stereoWidth: calculateStereoWidth(data),
                    mastering: calculateMasteringQuality(data)
                };
            }
            
            function calculateCompression(data) {
                const dynamicRange = calculateDynamicRange(data);
                return 1 - dynamicRange; // Higher compression = lower dynamic range
            }
            
            function calculateSaturation(data) {
                // Harmonic distortion estimation
                let distortion = 0;
                for (let i = 1; i < data.length - 1; i++) {
                    const derivative = Math.abs(data[i + 1] - data[i - 1]);
                    distortion += derivative;
                }
                return Math.min(distortion / data.length, 1);
            }
            
            function calculateStereoWidth(data) {
                // Placeholder - would need stereo data
                return 0.5; // Neutral width
            }
            
            function calculateMasteringQuality(data) {
                const balance = calculateSpectralBalance(data);
                const clarity = calculateClarity(data);
                const dynamics = calculateDynamicRange(data);
                
                return (balance * 0.4 + clarity * 0.3 + dynamics * 0.3) * 100;
            }
            
            function generateRecommendations(data) {
                const analysis = generateSummary(data);
                const recommendations = [];
                
                if (analysis.overallQuality < 70) {
                    recommendations.push('Consider remastering for better overall quality');
                }
                
                if (analysis.production.compression > 0.8) {
                    recommendations.push('Audio appears heavily compressed - consider more dynamic range');
                }
                
                if (analysis.production.mastering < 60) {
                    recommendations.push('Professional mastering could improve the sound quality');
                }
                
                return recommendations;
            }
            
            function generateTechnicalDetails(data) {
                return {
                    sampleRate: 44100, // Assumed
                    bitDepth: 16, // Assumed
                    channels: 'Stereo', // Assumed
                    format: 'Unknown',
                    duration: data.length / 44100,
                    fileSize: 'Unknown'
                };
            }
        `;
    }
    
    initializeVisualizations() {
        this.visualizations.set('spectrum', new SpectrumVisualizer());
        this.visualizations.set('waveform', new WaveformVisualizer());
        this.visualizations.set('spectrogram', new SpectrogramVisualizer());
        this.visualizations.set('features', new FeatureVisualizer());
    }
    
    setupRealTimeAnalysis() {
        this.realTimeConfig = {
            updateInterval: 50, // 20 FPS
            bufferSize: 2048,
            smoothing: 0.8
        };
    }
    
    async analyzeWithPreset(audioFile, presetName = 'electronic') {
        const preset = this.presets[presetName];
        if (!preset) {
            throw new Error(`Preset '${presetName}' não encontrado`);
        }
        
        console.log(`🎵 Analisando com preset: ${preset.name}`);
        
        try {
            const audioBuffer = await this.loadAudioFile(audioFile);
            const features = await this.extractFeatures(audioBuffer, preset.features);
            const analysis = this.processWithPreset(features, preset);
            
            // Store in history
            this.analysisHistory.push({
                timestamp: Date.now(),
                preset: presetName,
                filename: audioFile.name,
                analysis: analysis
            });
            
            return analysis;
        } catch (error) {
            console.error('❌ Erro na análise com preset:', error);
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
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    async extractFeatures(audioBuffer, featureList) {
        const audioData = audioBuffer.getChannelData(0);
        
        if (this.webWorker) {
            return this.extractFeaturesWithWorker(audioData, featureList);
        } else {
            return this.extractFeaturesMainThread(audioData, featureList);
        }
    }
    
    extractFeaturesWithWorker(audioData, featureList) {
        return new Promise((resolve) => {
            this.webWorker.postMessage({
                type: 'CALCULATE_FEATURES',
                data: audioData,
                features: featureList
            });
            
            const handler = (event) => {
                if (event.data.type === 'FEATURES_CALCULATED') {
                    this.webWorker.removeEventListener('message', handler);
                    resolve(event.data.features);
                }
            };
            
            this.webWorker.addEventListener('message', handler);
        });
    }
    
    extractFeaturesMainThread(audioData, featureList) {
        // Fallback para thread principal se Worker não disponível
        const features = {};
        
        // Implementação simplificada das features principais
        if (featureList.includes('spectralCentroid')) {
            features.spectralCentroid = this.calculateSpectralCentroid(audioData);
        }
        
        if (featureList.includes('spectralRolloff')) {
            features.spectralRolloff = this.calculateSpectralRolloff(audioData);
        }
        
        if (featureList.includes('energy')) {
            features.energy = this.calculateEnergy(audioData);
        }
        
        if (featureList.includes('loudness')) {
            features.loudness = this.calculateLoudness(audioData);
        }
        
        return Promise.resolve(features);
    }
    
    calculateSpectralCentroid(audioData) {
        // Simplified spectral centroid calculation
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < audioData.length; i++) {
            const magnitude = Math.abs(audioData[i]);
            weightedSum += i * magnitude;
            magnitudeSum += magnitude;
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    calculateSpectralRolloff(audioData) {
        // Frequency below which 85% of energy is contained
        const totalEnergy = audioData.reduce((sum, val) => sum + val ** 2, 0);
        const threshold = totalEnergy * 0.85;
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < audioData.length; i++) {
            cumulativeEnergy += audioData[i] ** 2;
            if (cumulativeEnergy >= threshold) {
                return i / audioData.length;
            }
        }
        
        return 1.0;
    }
    
    calculateEnergy(audioData) {
        return Math.sqrt(audioData.reduce((sum, val) => sum + val ** 2, 0) / audioData.length);
    }
    
    calculateLoudness(audioData) {
        // A-weighted loudness approximation
        const rms = this.calculateEnergy(audioData);
        return 20 * Math.log10(rms + 1e-6); // Convert to dB
    }
    
    processWithPreset(features, preset) {
        const analysis = {
            preset: preset.name,
            features: features,
            score: 0,
            recommendations: [],
            classification: {}
        };
        
        // Apply preset weights and thresholds
        let totalScore = 0;
        let scoreCount = 0;
        
        Object.keys(features).forEach(featureName => {
            const value = features[featureName];
            const threshold = preset.thresholds[featureName];
            
            if (threshold !== undefined) {
                const score = Math.min(value / threshold, 1.0) * 100;
                totalScore += score;
                scoreCount++;
                
                if (value < threshold * 0.7) {
                    analysis.recommendations.push(`Melhorar ${featureName} (atual: ${value.toFixed(3)})`);
                }
            }
        });
        
        analysis.score = scoreCount > 0 ? totalScore / scoreCount : 0;
        
        // Genre-specific classification
        this.classifyForGenre(analysis, preset);
        
        return analysis;
    }
    
    classifyForGenre(analysis, preset) {
        switch (preset.name) {
            case 'Rock/Metal':
                analysis.classification = {
                    energy: analysis.features.energy > 0.7 ? 'High' : 'Low',
                    distortion: analysis.features.loudness > 0.5 ? 'Heavy' : 'Clean',
                    dynamics: 'Aggressive'
                };
                break;
                
            case 'Electronic/EDM':
                analysis.classification = {
                    synthesized: 'High',
                    rhythm: 'Electronic',
                    bass: analysis.features.energy > 0.6 ? 'Heavy' : 'Moderate'
                };
                break;
                
            case 'Classical/Orchestra':
                analysis.classification = {
                    instrumentation: 'Acoustic',
                    complexity: 'High',
                    dynamics: analysis.features.loudness < 0.3 ? 'Natural' : 'Compressed'
                };
                break;
        }
    }
    
    startRealTimeVisualization(audioElement, containerId) {
        if (!audioElement || !document.getElementById(containerId)) {
            console.error('❌ Elementos para visualização não encontrados');
            return;
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaElementSource(audioElement);
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        analyser.fftSize = this.realTimeConfig.bufferSize;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const container = document.getElementById(containerId);
        const canvas = document.createElement('canvas');
        canvas.width = container.offsetWidth || 800;
        canvas.height = container.offsetHeight || 400;
        container.appendChild(canvas);
        
        const canvasCtx = canvas.getContext('2d');
        
        const draw = () => {
            requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            // Clear canvas
            canvasCtx.fillStyle = 'rgba(10, 10, 10, 0.1)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw spectrum
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;
                
                // Create gradient based on frequency
                const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                if (i < bufferLength / 3) {
                    gradient.addColorStop(0, '#00d4ff'); // Bass - blue
                    gradient.addColorStop(1, '#0099cc');
                } else if (i < (bufferLength * 2) / 3) {
                    gradient.addColorStop(0, '#00ff88'); // Mid - green
                    gradient.addColorStop(1, '#00cc6a');
                } else {
                    gradient.addColorStop(0, '#b066ff'); // Treble - purple
                    gradient.addColorStop(1, '#8c4dcc');
                }
                
                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
        
        return {
            audioContext,
            analyser,
            stop: () => {
                audioContext.close();
                container.removeChild(canvas);
            }
        };
    }
    
    async generateReport(analysis) {
        if (this.webWorker) {
            return this.generateReportWithWorker(analysis);
        } else {
            return this.generateReportMainThread(analysis);
        }
    }
    
    generateReportWithWorker(analysis) {
        return new Promise((resolve) => {
            this.webWorker.postMessage({
                type: 'GENERATE_REPORT',
                data: analysis
            });
            
            const handler = (event) => {
                if (event.data.type === 'REPORT_GENERATED') {
                    this.webWorker.removeEventListener('message', handler);
                    resolve(event.data.report);
                }
            };
            
            this.webWorker.addEventListener('message', handler);
        });
    }
    
    generateReportMainThread(analysis) {
        const report = {
            timestamp: Date.now(),
            summary: {
                preset: analysis.preset,
                overallScore: analysis.score,
                classification: analysis.classification,
                recommendations: analysis.recommendations
            },
            details: analysis.features,
            visualization: this.generateVisualizationData(analysis)
        };
        
        return Promise.resolve(report);
    }
    
    generateVisualizationData(analysis) {
        return {
            spectrumChart: this.createSpectrumChart(analysis.features),
            radarChart: this.createRadarChart(analysis.features),
            timeline: this.createTimelineChart(analysis.features)
        };
    }
    
    createSpectrumChart(features) {
        return {
            type: 'bar',
            data: {
                labels: Object.keys(features),
                datasets: [{
                    label: 'Feature Values',
                    data: Object.values(features),
                    backgroundColor: 'rgba(0, 212, 255, 0.6)',
                    borderColor: 'rgba(0, 212, 255, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Análise Espectral'
                    }
                }
            }
        };
    }
    
    createRadarChart(features) {
        const normalizedFeatures = this.normalizeFeatures(features);
        
        return {
            type: 'radar',
            data: {
                labels: Object.keys(normalizedFeatures),
                datasets: [{
                    label: 'Audio Profile',
                    data: Object.values(normalizedFeatures),
                    backgroundColor: 'rgba(176, 102, 255, 0.2)',
                    borderColor: 'rgba(176, 102, 255, 1)',
                    pointBackgroundColor: 'rgba(176, 102, 255, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(176, 102, 255, 1)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Perfil Audio'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 1
                    }
                }
            }
        };
    }
    
    createTimelineChart(features) {
        // Placeholder for timeline visualization
        return {
            type: 'line',
            data: {
                labels: ['0s', '25%', '50%', '75%', '100%'],
                datasets: [{
                    label: 'Energy Over Time',
                    data: [0.3, 0.7, 0.9, 0.6, 0.4],
                    borderColor: 'rgba(0, 255, 136, 1)',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Evolução Temporal'
                    }
                }
            }
        };
    }
    
    normalizeFeatures(features) {
        const normalized = {};
        const maxValues = {
            spectralCentroid: 1.0,
            spectralRolloff: 1.0,
            energy: 1.0,
            loudness: 0.0 // dB scale
        };
        
        Object.keys(features).forEach(key => {
            const maxVal = maxValues[key] || 1.0;
            normalized[key] = Math.min(Math.abs(features[key]) / maxVal, 1.0);
        });
        
        return normalized;
    }
    
    exportReport(analysis, format = 'json') {
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                version: '2.0.0',
                analyzer: 'Audio Analyzer V2 Advanced'
            },
            analysis: analysis,
            history: this.analysisHistory.slice(-10) // Last 10 analyses
        };
        
        switch (format.toLowerCase()) {
            case 'json':
                return this.exportAsJSON(report);
            case 'csv':
                return this.exportAsCSV(report);
            case 'pdf':
                return this.exportAsPDF(report);
            default:
                throw new Error(`Formato '${format}' não suportado`);
        }
    }
    
    exportAsJSON(report) {
        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audio-analysis-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return report;
    }
    
    exportAsCSV(report) {
        const csv = this.convertToCSV(report.analysis);
        const blob = new Blob([csv], { type: 'text/csv' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audio-analysis-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return csv;
    }
    
    convertToCSV(analysis) {
        const headers = ['Feature', 'Value', 'Classification'];
        const rows = [headers.join(',')];
        
        Object.keys(analysis.features).forEach(feature => {
            const value = analysis.features[feature];
            const classification = analysis.classification[feature] || 'N/A';
            rows.push(`${feature},${value},${classification}`);
        });
        
        return rows.join('\n');
    }
    
    exportAsPDF(report) {
        // Simplified PDF generation - would use jsPDF in real implementation
        console.log('📄 PDF export would be implemented with jsPDF library');
        return report;
    }
    
    getPresetsList() {
        return Object.keys(this.presets).map(key => ({
            id: key,
            name: this.presets[key].name,
            description: `Optimized for ${this.presets[key].name} music analysis`
        }));
    }
    
    getAnalysisHistory() {
        return this.analysisHistory.slice();
    }
    
    clearHistory() {
        this.analysisHistory = [];
        console.log('🗑️ Analysis history cleared');
    }
    
    handleWorkerMessage(data) {
        switch (data.type) {
            case 'SPECTRUM_ANALYZED':
                this.updateSpectrumVisualization(data.result);
                break;
            case 'FEATURES_CALCULATED':
                console.log('✅ Advanced features calculated:', data.features);
                break;
            case 'REPORT_GENERATED':
                console.log('📊 Report generated:', data.report);
                break;
            default:
                console.log('📨 Worker message:', data);
        }
    }
    
    updateSpectrumVisualization(result) {
        const spectrumViz = this.visualizations.get('spectrum');
        if (spectrumViz) {
            spectrumViz.update(result);
        }
    }
    
    destroy() {
        if (this.webWorker) {
            this.webWorker.terminate();
            this.webWorker = null;
        }
        
        this.visualizations.clear();
        this.analysisHistory = [];
        
        console.log('🗑️ Audio Analyzer V2 Advanced destroyed');
    }
}

// Visualization Classes
class SpectrumVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }
    
    initialize(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    
    update(data) {
        if (!this.ctx) return;
        
        // Update spectrum visualization
        this.drawSpectrum(data.frequencies, data.amplitudes);
        this.drawPeaks(data.peaks);
    }
    
    drawSpectrum(frequencies, amplitudes) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.clearRect(0, 0, width, height);
        
        // Draw spectrum bars
        const barWidth = width / frequencies.length;
        
        for (let i = 0; i < frequencies.length; i++) {
            const barHeight = (amplitudes[i] * height) / 2;
            const x = i * barWidth;
            const y = height - barHeight;
            
            // Color based on frequency
            const hue = (frequencies[i] / 22050) * 360;
            this.ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            this.ctx.fillRect(x, y, barWidth - 1, barHeight);
        }
    }
    
    drawPeaks(peaks) {
        // Draw peak markers
        peaks.forEach(peak => {
            const x = (peak.frequency / 22050) * this.canvas.width;
            const y = this.canvas.height - (peak.amplitude * this.canvas.height) / 2;
            
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }
}

class WaveformVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }
    
    initialize(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    
    update(waveformData) {
        if (!this.ctx) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.strokeStyle = '#00d4ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        const sliceWidth = width / waveformData.length;
        let x = 0;
        
        for (let i = 0; i < waveformData.length; i++) {
            const v = waveformData[i] * height / 2;
            const y = height / 2 + v;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.stroke();
    }
}

class SpectrogramVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.imageData = null;
    }
    
    initialize(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(canvas.width, canvas.height);
    }
    
    update(spectrogramData) {
        if (!this.ctx) return;
        
        // Update spectrogram (scrolling visualization)
        // Implementation would depend on the specific data format
        console.log('🎵 Spectrogram update:', spectrogramData);
    }
}

class FeatureVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }
    
    initialize(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    
    update(features) {
        if (!this.ctx) return;
        
        // Draw feature bars
        const featureNames = Object.keys(features);
        const featureValues = Object.values(features);
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const barWidth = width / featureNames.length;
        
        this.ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < featureNames.length; i++) {
            const barHeight = (featureValues[i] * height) / 2;
            const x = i * barWidth;
            const y = height - barHeight;
            
            this.ctx.fillStyle = `hsl(${i * 60}, 70%, 60%)`;
            this.ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
            
            // Label
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(featureNames[i], x + barWidth / 2, height - 5);
        }
    }
}

// Make available globally
window.AudioAnalyzerV2Advanced = AudioAnalyzerV2Advanced;

console.log('✅ Audio Analyzer V2 Advanced Features loaded successfully');
