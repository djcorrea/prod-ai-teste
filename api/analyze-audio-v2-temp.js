// 🎵 AUDIO ANALYZER API V2 - FASE 2 (TEMP SEM FIREBASE)
// Endpoint para análise avançada de áudio com 12 métricas core

import { performFase2Analysis } from './fase2-adapter.js';

// Configurações da análise (Fase 2)
const CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  PROCESSING_TIMEOUT: 45000, // 45s timeout
  ENABLE_ALL_CORE_FEATURES: true,
  QUALITY_PRESET: process.env.ANALYSIS_QUALITY || 'core'
};

// 🎵 HANDLER PRINCIPAL
export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('🎵 Audio Analyzer V2 API chamada:', {
    method: req.method,
    timestamp: new Date().toISOString()
  });

  try {
    // Método OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }

    // Apenas POST é permitido
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    // Timeout de segurança
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ 
          error: 'Timeout na análise',
          processingTime: Date.now() - startTime 
        });
      }
    }, CONFIG.PROCESSING_TIMEOUT);

    // Extrair dados da requisição
    const { audio: audioData, config: requestConfig } = req.body;

    // Validação do áudio
    if (!audioData || typeof audioData !== 'string') {
      return res.status(400).json({ error: 'Dados de áudio necessários (base64)' });
    }

    // Decodificar e validar tamanho
    const audioBuffer = Buffer.from(audioData, 'base64');
    if (audioBuffer.length > CONFIG.MAX_FILE_SIZE) {
      return res.status(413).json({ 
        error: 'Arquivo muito grande',
        maxSize: `${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`,
        receivedSize: `${Math.round(audioBuffer.length / 1024 / 1024)}MB`
      });
    }

    console.log('🎛️ Iniciando análise:', {
      fileSize: `${Math.round(audioBuffer.length / 1024)}KB`,
      features: requestConfig?.features || ['core'],
      quality: requestConfig?.quality || CONFIG.QUALITY_PRESET
    });

    // Análise principal com Fase 2
    const analysisResult = await performFase2Analysis(audioBuffer, {
      ...requestConfig,
      quality: requestConfig?.quality || CONFIG.QUALITY_PRESET,
      enableAdvanced: CONFIG.ENABLE_ALL_CORE_FEATURES
    });

    const processingTime = Date.now() - startTime;
    
    // Construir resposta completa
    const response = {
      success: true,
      version: '2.0',
      timestamp: new Date().toISOString(),
      processingTime,
      ...analysisResult
    };

    clearTimeout(timeoutId);
    
    console.log('✅ Análise V2 concluída:', {
      processingTime: `${processingTime}ms`,
      metricsCount: Object.keys(response.metrics || {}).length,
      problemsFound: response.diagnostics?.problems?.length || 0
    });

    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('💥 Erro na análise V2:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      processingTime: Date.now() - startTime
    });
    
    // Headers CORS mesmo em erro
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(500).json({ 
      error: 'Erro interno na análise',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
      processingTime: Date.now() - startTime
    });
  }
}

console.log('🎵 Audio Analyzer API V2 (temp) carregado');
