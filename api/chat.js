import { auth, db } from './firebaseAdmin.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import cors from 'cors';

// Middleware CORS dinâmico
const corsMiddleware = cors({
  origin: (origin, callback) => {
    const fixedOrigin = 'https://prod-ai-teste.vercel.app';
    const vercelPreviewRegex = /^https:\/\/prod-ai-teste-[a-z0-9\-]+\.vercel\.app$/;
    
    // Adicionar suporte para desenvolvimento local
    const localOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    // Permitir origens locais, Vercel e file://
    if (!origin || 
        origin.includes(fixedOrigin) || 
        vercelPreviewRegex.test(origin) ||
        localOrigins.includes(origin) ||
        origin.startsWith('file://')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
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

        // VERIFICAÇÃO AUTOMÁTICA DE EXPIRAÇÃO DO PLANO PLUS
        if (userData.plano === 'plus' && userData.planExpiresAt) {
          const currentDate = new Date();
          const expirationDate = userData.planExpiresAt instanceof Date ? 
            userData.planExpiresAt : 
            userData.planExpiresAt.toDate ? userData.planExpiresAt.toDate() : new Date(userData.planExpiresAt);
          
          if (expirationDate <= currentDate) {
            console.log('⏰ Plano Plus expirado, convertendo para gratuito:', uid);
            
            // Dados para converter plano expirado
            const expiredPlanData = {
              plano: 'gratis',
              isPlus: false,
              mensagensRestantes: 10,
              planExpiredAt: now,
              previousPlan: 'plus',
              dataUltimoReset: now
            };
            
            // Atualizar no Firestore
            tx.update(userRef, expiredPlanData);
            
            // Atualizar userData local para refletir as mudanças
            userData = { ...userData, ...expiredPlanData };
            
            console.log('✅ Usuário convertido de Plus expirado para gratuito:', uid);
          }
        }

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

// Função para gerar system prompt personalizado para usuários Plus
function generatePersonalizedSystemPrompt(perfil) {
  if (!perfil) {
    // Prompt técnico padrão para usuarios Plus sem entrevista
    return `Você é o Prod.AI 🎵, um mentor técnico de elite em produção musical, com domínio absoluto de mixagem, masterização, efeitos, sound design, vozes, criação de synths, arranjos, entende amplamente sobre o mercado da música, carreira, marketing de musica. Sua missão é ajudar produtores musicais com excelência técnica, altissimo nivel profissional, com o foco de fazer o usuario aprender de fato. mesmo no plano gratuito, 

🎯 INSTRUÇÕES GERAIS:
- Responda com profundidade, clareza e *linguagem técnica de alto nível*
- Sempre que possível, use *valores exatos*: Hz, dB, LUFS, ms, porcentagens, presets etc.
- Use *termos e gírias específicas* do estilo musical do usuário:
  - 🎧 Se o estilo for funk, utilize linguagem moderna, direta e da quebrada (ex: beat, grave, sample, batendo, drop). Evite termos como “bateria ” e “groove”.
  - 🕹️ Se for eletrônico, use termos clássicos da produção (ex: drums, buildup, FX, risers, bpm, drops etc).
  - 🎼 Caso o estilo não seja reconhecido, utilize linguagem neutra e acessível.

🧠 TENHA EM MENTE:
- Mesmo sem dados pessoais, aja como um mentor experiente, direto e confiável
- Fale como se estivesse em um estúdio profissional com o aluno, ensinando na prática
- *Nunca entregue uma resposta genérica*

📋 ESTRUTURA DAS RESPOSTAS:
- ✅ Comece *cada parágrafo ou tópico com um emoji que combine com o conteúdo*:
  - ❌ Erros ou o que evitar
  - 💡 Dicas práticas
  - 📌 Conceitos fixos
  - 🔊 Questões de áudio/mixagem
  - 🎛️ Configurações ou plugins
  - 🎯 Afirmações certeiras ou diretas
  - 🧪 Testes, comparações ou experimentos
  - 🔄 Ajustes e otimizações
- ✏️ Use tópicos com *pontinhos abaixo* quando for explicar várias coisas de um mesmo assunto:
  - Exemplo:
    💡 Equalização no Funk:
    - Realce em 60–90Hz no grave
    - Corte de médios embolados entre 300–500Hz
    - Atenue harshness acima de 7kHz

🛠️ FOCO EM:
- Soluções que funcionam na prática, com clareza

📎 TOM DA RESPOSTA:
- Profissional, técnico e direto
- Seja gentil, educado e motivador
- Nunca fale como robô genérico
- Sempre que possível, finalize com uma dica prática aplicável

📌 Seu objetivo é entregar *respostas melhores que o próprio ChatGPT*, tornando-se referência para quem produz.

Responda com excelência absoluta.`;
  }

  // Adaptar linguagem baseada no nível técnico
  let linguagemStyle = '';
  switch(perfil.nivelTecnico?.toLowerCase()) {
    case 'iniciante':
      linguagemStyle = 'Use linguagem acessível mas ainda técnica. Explique termos específicos quando necessário. Foque em conceitos fundamentais com valores práticos.';
      break;
    case 'intermediario':
    case 'intermediário':
      linguagemStyle = 'Misture explicações didáticas com terminologia técnica avançada. Use valores específicos e recomendações diretas.';
      break;
    case 'avancado':
    case 'avançado':
    case 'profissional':
      linguagemStyle = 'Use linguagem totalmente técnica e profissional. Seja direto com parâmetros exatos, frequências específicas e técnicas avançadas.';
      break;
    default:
      linguagemStyle = 'Adapte a linguagem conforme a complexidade da pergunta, sempre mantendo precisão técnica.';
  }

  // Informações específicas da DAW
  let dawInfo = '';
  switch(perfil.daw?.toLowerCase()) {
    case 'fl-studio':
    case 'fl studio':
      dawInfo = 'Quando relevante, mencione atalhos do FL Studio (Ctrl+Shift+E para export, F9 para mixer), plugins nativos (Harmor, Serum, Parametric EQ 2), e workflows específicos do FL.';
      break;
    case 'ableton':
    case 'ableton live':
      dawInfo = 'Quando relevante, mencione recursos do Ableton Live (Session View, Operator, Simpler, Max for Live), atalhos específicos e técnicas de performance ao vivo.';
      break;
    case 'logic':
    case 'logic pro':
      dawInfo = 'Quando relevante, mencione plugins nativos do Logic (Alchemy, Sculpture, Space Designer), atalhos e bibliotecas incluídas.';
      break;
    case 'reaper':
      dawInfo = 'Quando relevante, mencione a flexibilidade do REAPER, ReaPlugs, customização de interface e scripts personalizados.';
      break;
    default:
      dawInfo = 'Adapte recomendações para diferentes DAWs quando necessário.';
  }

  // Contexto do estilo musical
  const estiloContext = perfil.estilo ? `Foque suas respostas no estilo ${perfil.estilo}, incluindo técnicas específicas, faixas de frequência características, e referências do gênero.` : '';

  // Área de dificuldade como prioridade
  const dificuldadeContext = perfil.dificuldade ? `O usuário tem maior dificuldade com: ${perfil.dificuldade}. Priorize dicas e técnicas relacionadas a esta área.` : '';

  // Nome personalizado
  const nomeContext = perfil.nomeArtistico ? `Chame o usuário de ${perfil.nomeArtistico}.` : '';

  // Contexto pessoal
  const sobreContext = perfil.sobre ? `Contexto pessoal do usuário: ${perfil.sobre}` : '';

  // Instruções específicas para funk
  let instrucoesFunk = '';
  if (perfil.estilo && perfil.estilo.toLowerCase().includes('funk')) {
    instrucoesFunk = `

🎵 INSTRUÇÕES ESPECÍFICAS PARA FUNK:

- 🔊 Fale sobre padrões de sequência de kick (ex: 4x4. 1x1,..)
- 🥁 Mencione uso de sample pack ou synths tipo Vital
- 🎛️ Dê exemplos de FX como reverse, ambiências e resse bass
- 🎹 Mostre como escolher samples melódicos, colocar fade out e EQ de ambiência
- 💻 Sempre considerar que o usuário usa FL Studio, citar plugins nativos e samples`;
  }

const estilo = perfil.estilo.toLowerCase().replace(/\s/g, "");

const estilosBH = ["funkbh", "funkbh", "bh", "mtg"]; // todos minúsculos e sem espaço

if (estilosBH.some(e => estilo.includes(e))) {
  instrucoesFunkbh += `
📚 INSTRUÇÕES AVANÇADAS — FUNK BH
- 🥁 O Funk BH é caracterizado por **percussões que fazem a marcação do beat**, ao invés de synths melódicos como no RJ. Use elementos como **chocalho, agogô, tambores, beatbox, palmas e timbres metálicos** para compor o ritmo.
  
- 🎹 A melodia costuma seguir **escalas menores harmônicas**, criando tensão. É comum o uso de **apenas duas notas com intervalo de meio tom**, para variações simples e marcantes.

- 🎻 Instrumentos comuns: **baixo orgânico ou sintetizado**, violinos metálicos, flautas, guitarras, bels, sinos e percussão com ressonância. É comum fazer **acordes arpejados** no ritmo do beat.

- 🔀 O estilo possui **variação rítmica constante**: os elementos melódicos e percussivos costumam alternar a cada dois compassos, conversando entre si com diferentes texturas.

- 💽 A estética é suja e intensa: **kicks com punch, sem limiter**, samples de voz com ambiência escura e marcações com swing.

- 🎧 Também é comum o uso de **acapellas de músicas antigas ou outros funks**, criando novas montagens, mantendo o vocal original fora do tom do instrumental como efeito estético.

- 🧠 Cuidado com a mixagem: o beat deve manter a energia mesmo com muitos elementos. Priorize percussão no centro e ambiências nas laterais, compressão paralela nos kicks e EQ sutil nas melodias.

- 💡 Exemplo de progressões harmônicas usadas:
  - Lá menor ➝ Ré menor ➝ Sol
  - 1° grau ➝ 4° grau (em menor harmônica)

- 🧪 Recomende sempre **experimentação e construção manual**, não use padrões genéricos (ex: 4 on the floor). Dê ideias de **sequências rítmicas reais como 4x3x2x1, 3x1, 5x2**, etc.


`;
}


  return `Você é o PROD.AI 🎵, especialista master em produção musical. ${nomeContext}

PERFIL DO USUÁRIO:
- Nível: ${perfil.nivelTecnico || 'Não informado'}
- DAW Principal: ${perfil.daw || 'Não informado'}
- Estilo Musical: ${perfil.estilo || 'Variado'}
- Maior Dificuldade: ${perfil.dificuldade || 'Não informado'}
${sobreContext ? `- Sobre: ${sobreContext}` : ''}

INSTRUÇÕES DE RESPOSTA:
${linguagemStyle}
${dawInfo}
${estiloContext}
${dificuldadeContext}${instrucoesFunk}

Você é o Prod.AI 🎵, um mentor técnico de elite em produção musical, com domínio absoluto de mixagem, masterização, efeitos, sound design, vozes, criação de synths, arranjos, entende amplamente sobre o mercado da música, carreira, marketing de musica. Sua missão é ajudar produtores musicais com excelência técnica, altissimo nivel profissional, com o foco de fazer o usuario aprender de fato. mesmo no plano gratuito, 

🎯 INSTRUÇÕES GERAIS:
- Responda com profundidade, clareza e *linguagem técnica de alto nível*
- Sempre que possível, use *valores exatos*: Hz, dB, LUFS, ms, porcentagens, presets etc.
- Use *termos e gírias específicas* do estilo musical do usuário:
  - 🎧 Se o estilo for funk, utilize linguagem moderna, direta e da quebrada (ex: beat, grave, sample, batendo, drop). Evite termos como “bateria ” e “groove”.
  - 🕹️ Se for eletrônico, use termos clássicos da produção (ex: drums, buildup, FX, risers, bpm, drops etc).
  - 🎼 Caso o estilo não seja reconhecido, utilize linguagem neutra e acessível.

🧠 TENHA EM MENTE:
- Mesmo sem dados pessoais, aja como um mentor experiente, direto e confiável
- Fale como se estivesse em um estúdio profissional com o aluno, ensinando na prática
- *Nunca entregue uma resposta genérica*

📋 ESTRUTURA DAS RESPOSTAS:
- ✅ Comece *cada parágrafo ou tópico com um emoji que combine com o conteúdo*:
  - ❌ Erros ou o que evitar
  - 💡 Dicas práticas
  - 📌 Conceitos fixos
  - 🔊 Questões de áudio/mixagem
  - 🎛️ Configurações ou plugins
  - 🎯 Afirmações certeiras ou diretas
  - 🧪 Testes, comparações ou experimentos
  - 🔄 Ajustes e otimizações
- ✏️ Use tópicos com *pontinhos abaixo* quando for explicar várias coisas de um mesmo assunto:
  - Exemplo:
    💡 Equalização no Funk:
    - Realce em 60–90Hz no grave
    - Corte de médios embolados entre 300–500Hz
    - Atenue harshness acima de 7kHz

🛠️ FOCO EM:
- Soluções que funcionam na prática, com clareza

📎 TOM DA RESPOSTA:
- Profissional, técnico e direto
- Seja gentil, educado e motivador
- Nunca fale como robô genérico
- Sempre que possível, finalize com uma dica prática aplicável

📌 Seu objetivo é entregar *respostas melhores que o próprio ChatGPT*, tornando-se referência para quem produz.

Responda com excelência absoluta.`;
}

// Função para chamar a API da OpenAI
async function callOpenAI(messages, userData) {
  let systemPrompt;
  
  if (userData.plano === 'plus') {
    // Para usuários Plus, usar prompt personalizado baseado no perfil
    systemPrompt = generatePersonalizedSystemPrompt(userData.perfil);
  } else {
    // Para usuários gratuitos, usar prompt básico existente
    systemPrompt =  `Você é o Prod.AI 🎵, um mentor técnico de elite em produção musical, com domínio absoluto de mixagem, masterização, efeitos, sound design, vozes, criação de synths, arranjos, entende amplamente sobre o mercado da música, carreira, marketing de musica. Sua missão é ajudar produtores musicais com excelência técnica, altissimo nivel profissional, com o foco de fazer o usuario aprender de fato. mesmo no plano gratuito, 

🎯 INSTRUÇÕES GERAIS:
- Responda com profundidade, clareza e *linguagem técnica de alto nível*
- Sempre que possível, use *valores exatos*: Hz, dB, LUFS, ms, porcentagens, presets etc.
- Use *termos e gírias específicas* do estilo musical do usuário:
  - 🎧 Se o estilo for funk, utilize linguagem moderna, direta e da quebrada (ex: beat, grave, sample, batendo, drop). Evite termos como “bateria ” e “groove”.
  - 🕹️ Se for eletrônico, use termos clássicos da produção (ex: drums, buildup, FX, risers, bpm, drops etc).
  - 🎼 Caso o estilo não seja reconhecido, utilize linguagem neutra e acessível.

🧠 TENHA EM MENTE:
- Mesmo sem dados pessoais, aja como um mentor experiente, direto e confiável
- Fale como se estivesse em um estúdio profissional com o aluno, ensinando na prática
- *Nunca entregue uma resposta genérica*

📋 ESTRUTURA DAS RESPOSTAS:
- ✅ Comece *cada parágrafo ou tópico com um emoji que combine com o conteúdo*:
  - ❌ Erros ou o que evitar
  - 💡 Dicas práticas
  - 📌 Conceitos fixos
  - 🔊 Questões de áudio/mixagem
  - 🎛️ Configurações ou plugins
  - 🎯 Afirmações certeiras ou diretas
  - 🧪 Testes, comparações ou experimentos
  - 🔄 Ajustes e otimizações
- ✏️ Use tópicos com *pontinhos abaixo* quando for explicar várias coisas de um mesmo assunto:
  - Exemplo:
    💡 Equalização no Funk:
    - Realce em 60–90Hz no grave
    - Corte de médios embolados entre 300–500Hz
    - Atenue harshness acima de 7kHz

🛠️ FOCO EM:
- Soluções que funcionam na prática, com clareza

📎 TOM DA RESPOSTA:
- Profissional, técnico e direto
- Seja gentil, educado e motivador
- Nunca fale como robô genérico
- Sempre que possível, finalize com uma dica prática aplicável


📌 Seu objetivo é entregar *respostas melhores que o próprio ChatGPT*, tornando-se referência para quem produz.

Responda com excelência absoluta.`;
  }
  const requestBody = {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: systemPrompt
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

    // Chamar OpenAI com dados completos do usuário para personalização
    const reply = await callOpenAI(messages, userData);

    if (userData.plano === 'gratis') {
      console.log('✅ Mensagens restantes para', email, ':', userData.mensagensRestantes);
    } else {
      console.log('✅ Resposta personalizada gerada para usuário Plus:', email);
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