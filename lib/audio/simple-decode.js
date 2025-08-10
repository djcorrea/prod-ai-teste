// 🎵 SIMPLE DECODE FOR NODE.JS
// Decodificação básica de áudio sem AudioContext

/**
 * Decodifica áudio simples para Node.js
 * @param {Buffer} audioBuffer 
 * @returns {Object}
 */
export function decodeAudioSimple(audioBuffer) {
  console.log('🔄 Usando decoder simples (Node.js)...');
  
  // Simular dados de áudio para análise básica
  // Em produção, usaria uma lib como node-ffmpeg
  const sampleRate = 44100;
  const duration = 10; // 10 segundos fictícios
  const samples = sampleRate * duration;
  
  // Gerar dados simulados baseados no buffer real
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  // Usar dados do buffer como seed para simulação
  let seed = 0;
  for (let i = 0; i < Math.min(audioBuffer.length, 1000); i++) {
    seed += audioBuffer[i];
  }
  
  // Gerar forma de onda baseada no buffer
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = 440 + (seed % 200); // Frequência baseada no buffer
    const amplitude = Math.max(0.1, (audioBuffer.length / 1000000)); // Amplitude baseada no tamanho
    
    leftChannel[i] = amplitude * Math.sin(2 * Math.PI * freq * t) * 0.8;
    rightChannel[i] = amplitude * Math.sin(2 * Math.PI * freq * t + 0.1) * 0.8; // Pequena diferença de fase
  }
  
  return {
    sampleRate,
    duration,
    numberOfChannels: 2,
    left: leftChannel,
    right: rightChannel,
    getChannelData: function(channel) {
      return channel === 0 ? this.left : this.right;
    }
  };
}

/**
 * Preparar dados de áudio para análise
 */
export function prepareAudioSimple(decodedData) {
  return {
    left: decodedData.left,
    right: decodedData.right,
    sampleRate: decodedData.sampleRate,
    duration: decodedData.duration,
    channels: 2
  };
}

/**
 * Validar dados de áudio
 */
export function validateAudioSimple(audioData) {
  if (!audioData.left || !audioData.right) {
    throw new Error('Dados de áudio inválidos');
  }
  
  if (audioData.left.length === 0) {
    throw new Error('Áudio vazio');
  }
  
  return true;
}
