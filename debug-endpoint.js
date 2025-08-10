// Teste simples para debug do erro 501
import fs from 'fs';

// Simular uma requisição
const testRequest = {
  method: 'POST',
  body: {
    audio: 'test', // dados básicos para teste
    config: { features: ['core'] }
  },
  headers: {}
};

const testResponse = {
  status: function(code) {
    console.log(`Status: ${code}`);
    return this;
  },
  json: function(data) {
    console.log('Response:', JSON.stringify(data, null, 2));
    return this;
  },
  end: function() {
    console.log('Response ended');
    return this;
  },
  headersSent: false
};

try {
  console.log('🧪 Testando handler...');
  
  // Importar handler
  const { default: handler } = await import('./api/analyze-audio-v2.js');
  
  // Executar
  await handler(testRequest, testResponse);
  
} catch (error) {
  console.error('❌ Erro capturado:', error.message);
  console.error('Stack:', error.stack);
}
