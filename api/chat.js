import { auth, db } from './firebaseAdmin.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import cors from 'cors';

// Middleware CORS dinâmico
const corsMiddleware = cors({
  origin: (origin, callback) => {
    const fixedOrigin = 'https://prod-ai-teste.vercel.app';
    const vercelPreviewRegex = /^https:\/\/prod-ai-teste-[a-z0-9\-]+\.vercel\.app$/;

    if (!origin || origin.includes(fixedOrigin) || vercelPreviewRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// Função para validar e sanitizar dados de entrada
function validateAndSanitizeInput(req) {
  const { message, conversationHistory = [], idToken } = req.body;
  
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('TOKEN_MISSING');
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('MESSAGE_INVALID');
  }
  
  let validHistory = [];
  if (Array.isArray(conversationHistory)) {
    validHistory = conversationHistory
      .filter(msg => {
        return msg && 
          typeof msg === 'object' && 
          msg.role && 
          msg.content &&
          typeof msg.content === 'string' &&
          msg.content.trim().length > 0 &&
          ['user', 'assistant', 'system'].includes(msg.role);
      })
      .slice(-10);
  }
  
  return {
    message: message.trim().substring(0, 2000),
    conversationHistory: validHistory,
    idToken: idToken.trim()
  };
}

// Função para gerenciar limites de usuário
async function handleUserLimits(db, uid, email) {
  const userRef = db.collection('usuarios').doc(uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const now = Timestamp.now();
      const today = now.toDate().toDateString();

      let userData;

      if (!snap.exists) {
        userData = {
          uid,
          plano: 'gratis',
          mensagensRestantes: 9,
          dataUltimoReset: now,
          createdAt: now,
        };
        if (email) {
          userData.email = email;
        }
        tx.set(userRef, userData);
      } else {
        userData = snap.data();
        const lastReset = userData.dataUltimoReset?.toDate().toDateString();

        if (lastReset !== today) {
          userData.mensagensRestantes = 10;
          tx.update(userRef, {
            mensagensRestantes: 10,
            dataUltimoReset: now,
          });
        }

        if (userData.plano === 'gratis') {
          if (userData.mensagensRestantes <= 0) {
            throw new Error('LIMIT_EXCEEDED');
          }
          tx.update(userRef, {
            mensagensRestantes: FieldValue.increment(-1),
          });
          userData.mensagensRestantes =
            (userData.mensagensRestantes || 10) - 1;
        }
      }

      return userData;
    });

    const finalSnap = await userRef.get();
    return { ...result, perfil: finalSnap.data().perfil };
  } catch (error) {
    if (error.message === 'LIMIT_EXCEEDED') {
      console.warn('🚫 Limite de mensagens atingido para:', email);
      throw error;
    }
    console.error('❌ Erro na transação do usuário:', error);
    throw new Error('Erro ao processar limites do usuário');
  }
}

// Função para chamar a API da OpenAI
async function callOpenAI(messages, profileInfo = '') {
  const requestBody = {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `Você é o Prod.AI 🎵, especialista master em produção musical. Sua missão é ajudar produtores, beatmakers e músicos a criar, mixar e masterizar, ajudar a resolver qualquer desafio com precisão técnica, criatividade e linguagem acessível. tirar duvidas gerais sobre produção musical e a industria da música com excelência.${profileInfo}
        ...especialidades e instruções...
        `
      },
      ...messages,
    ],
  };

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiRes.ok) {
      throw new Error(`OpenAI API erro: ${openaiRes.status} ${openaiRes.statusText}`);
    }

    const data = await openaiRes.json();

    if (!data.choices || !data.choices[0]?.message) {
      throw new Error('Resposta inválida da OpenAI');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    throw new Error('Falha na comunicação com OpenAI');
  }
}

export default async function handler(req, res) {
  console.log('🔄 Nova requisição recebida:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    hasBody: !!req.body
  });

  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (err) {
    console.error('CORS error:', err);
    return res.status(403).end();
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    let validatedData;
    try {
      validatedData = validateAndSanitizeInput(req);
    } catch (error) {
      if (error.message === 'TOKEN_MISSING') {
        return res.status(401).json({ error: 'Token de autenticação necessário' });
      }
      if (error.message === 'MESSAGE_INVALID') {
        return res.status(400).json({ error: 'Mensagem inválida ou vazia' });
      }
      throw error;
    }

    const { message, conversationHistory, idToken } = validatedData;

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decoded.uid;
    const email = decoded.email;

    let userData;
    try {
      userData = await handleUserLimits(db, uid, email);
    } catch (error) {
      if (error.message === 'LIMIT_EXCEEDED') {
        return res.status(403).json({ error: 'Limite diário de mensagens atingido' });
      }
      throw error;
    }

    const messages = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    let profileInfo = '';
    if (userData.plano === 'plus' && userData.perfil) {
      const p = userData.perfil;
      profileInfo = `\n\nPERFIL DO USUÁRIO:\nNome artístico: ${p.nomeArtistico || ''}; Nível: ${p.nivelTecnico || ''}; DAW: ${p.daw || ''}; Estilo: ${p.estilo || ''}; Dificuldade: ${p.dificuldade || ''}.`;
    }

    const reply = await callOpenAI(messages, profileInfo);

    if (userData.plano === 'gratis') {
      console.log('✅ Mensagens restantes para', email, ':', userData.mensagensRestantes);
    }

    return res.status(200).json({ 
      reply,
      mensagensRestantes: userData.plano === 'gratis' ? userData.mensagensRestantes : null
    });

  } catch (error) {
    console.error('💥 ERRO NO SERVIDOR:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
}