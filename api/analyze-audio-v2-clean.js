// 🎵 AUDIO ANALYZER API V2 - FASE 2
// Endpoint para análise avançada de áudio com 12 métricas core

import { auth, db } from './firebaseAdmin.js';
import { AudioAnalysisResponseSchema, AudioAnalysisRequestSchema, validateAnalysisResponse, ANALYSIS_CONSTANTS } from '../schemas/audio-analysis.js';
import { performFase2Analysis } from './fase2-adapter.js';
import cors from 'cors';

// Configuração CORS
const corsMiddleware = cors({
  origin: process.env.NODE_ENV === 'development' ? '*' : [
    'https://prod-ai-teste.vercel.app',
    /^https:\/\/prod-ai-teste-[a-z0-9\-]+\.vercel\.app$/,
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500'
  ],
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // 24 horas
});

// Configurações da análise (Fase 2)
const CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  PROCESSING_TIMEOUT: 45000, // 45s timeout
  ENABLE_ALL_CORE_FEATURES: true,
  QUALITY_PRESET: process.env.ANALYSIS_QUALITY || 'core'
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// 🎵 HANDLER PRINCIPAL
export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('🎵 Audio Analyzer V2 API chamada:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent']?.substring(0, 100)
  });

  try {
    // CORS
    await runMiddleware(req, res, corsMiddleware);

    // Método OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
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

    // Autenticação (opcional)
    let uid = null, email = null;
    const idToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (idToken) {
      try {
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email;
        console.log('🔐 Usuário autenticado:', email);
      } catch (err) {
        console.warn('⚠️ Token inválido, continuando sem autenticação:', err.message);
      }
    }

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
      uid,
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

    // Validar resposta
    const validation = validateAnalysisResponse(response);
    if (!validation.success) {
      console.error('❌ Erro na validação da resposta:', validation.error);
      throw new Error('Erro na validação da resposta');
    }

    // Salvar analytics (async, não bloqueia resposta)
    if (uid) {
      saveAnalysisMetrics(uid, {
        processingTime,
        fileSize: audioBuffer.length,
        features: requestConfig?.features || ['core'],
        quality: response.metrics.quality?.overall,
        timestamp: new Date()
      }).catch(err => console.warn('Analytics save failed:', err));
    }

    clearTimeout(timeoutId);
    
    console.log('✅ Análise V2 concluída:', {
      processingTime: `${processingTime}ms`,
      metricsCount: Object.keys(response.metrics).length,
      problemsFound: response.diagnostics?.problems?.length || 0,
      overallScore: response.metrics.quality?.overall || 'N/A'
    });

    return res.status(200).json(validation.data);

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('💥 Erro na análise V2:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      processingTime: Date.now() - startTime
    });
    
    return res.status(500).json({ 
      error: 'Erro interno na análise',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
      processingTime: Date.now() - startTime
    });
  }
}

// 📊 ANALYTICS (não bloqueia resposta)
async function saveAnalysisMetrics(uid, metrics) {
  try {
    await db.collection('audio_analysis_metrics').add({
      uid,
      ...metrics,
      version: '2.0',
      createdAt: new Date()
    });
  } catch (error) {
    console.warn('Failed to save analytics:', error);
  }
}

function validateAnalysisRequest(data) {
  // Validação básica para compatibilidade
  return { success: true, data };
}

console.log('🎵 Audio Analyzer API V2 carregado');
