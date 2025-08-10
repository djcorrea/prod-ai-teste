// Debug específico do fase2-adapter
import { performFase2Analysis } from './api/fase2-adapter.js';

async function testAdapter() {
  try {
    console.log('🧪 Testando fase2-adapter...');
    
    // Criar buffer de teste simples (10 samples, 1 segundo fictício)
    const testBuffer = Buffer.alloc(1024); // buffer pequeno para teste
    
    console.log('📦 Buffer criado, tamanho:', testBuffer.length);
    
    const result = await performFase2Analysis(testBuffer, { 
      features: ['core'],
      quality: 'fast' 
    });
    
    console.log('✅ Resultado obtido:', Object.keys(result));
    
  } catch (error) {
    console.error('❌ Erro no adapter:', error.message);
    console.error('Stack completo:', error.stack);
  }
}

testAdapter();
