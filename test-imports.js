// Teste das importações da Fase 2
console.log('🧪 Testando importações...');

// Teste da engine
import { AudioAnalysisEngine } from './lib/audio/engine.js';
console.log('✅ Engine importada');

// Teste do adapter
import { performFase2Analysis } from './api/fase2-adapter.js';
console.log('✅ Adapter importado');

console.log('🎉 Todas as importações OK!');
