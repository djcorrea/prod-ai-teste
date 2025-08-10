// Criar arquivo WAV de teste usando JavaScript
const fs = require('fs');

function createTestWAV(frequency = 440, duration = 3) {
    const sampleRate = 44100;
    const amplitude = 0.3;
    const channels = 2;
    const bitsPerSample = 16;
    
    const samples = Math.floor(duration * sampleRate);
    const blockAlign = channels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples * blockAlign;
    const fileSize = 44 + dataSize;
    
    const buffer = Buffer.alloc(fileSize);
    let offset = 0;
    
    // Header WAV
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4;
    buffer.writeUInt16LE(1, offset); offset += 2;
    buffer.writeUInt16LE(channels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Dados de áudio
    for (let i = 0; i < samples; i++) {
        const time = i / sampleRate;
        let sample = Math.sin(2 * Math.PI * frequency * time) * amplitude;
        
        // Envelope
        const pos = time / duration;
        if (pos < 0.1) sample *= pos / 0.1;
        if (pos > 0.9) sample *= (1 - pos) / 0.1;
        
        const sampleValue = Math.floor(sample * 32767);
        
        buffer.writeInt16LE(sampleValue, offset); offset += 2;
        buffer.writeInt16LE(Math.floor(sampleValue * 0.8), offset); offset += 2;
    }
    
    return buffer;
}

// Criar arquivos de teste
const files = [
    { name: 'teste-440hz-3s.wav', freq: 440, dur: 3 },
    { name: 'teste-880hz-2s.wav', freq: 880, dur: 2 },
    { name: 'teste-220hz-4s.wav', freq: 220, dur: 4 }
];

files.forEach(({ name, freq, dur }) => {
    const buffer = createTestWAV(freq, dur);
    fs.writeFileSync(name, buffer);
    console.log(`✅ Criado: ${name} (${freq}Hz, ${dur}s)`);
});

console.log('🎵 Arquivos de teste criados com sucesso!');
