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

// 🧠 Bases técnicas por estilo (instrução base) "Usuário Plus tem "funk mandela" no perfil"
const instrucoesBase = {
  funkMandela: `
📌 DIRETRIZES:
- Responda com altíssimo nível técnico, explicando cada conceito com profundidade e clareza, como se estivesse ensinando um aluno que deseja se tornar profissional.
- Use os conteúdos abaixo apenas como **base técnica de referência**.
- Ao responder, **analise o contexto exato da pergunta do usuário** e entregue a melhor resposta possível, totalmente personalizada para o caso dele.
- Explique como aplicar cada técnica na prática: forneça parâmetros exatos (Hz, dB, ms), nome de plugins, valores sugeridos, variações avançadas, ordem de processamento e dicas profissionais.
- Sempre que for mencionado compressão, saturação, sidechain, equalização, automação, timbres, sound design ou mixagem, **detalhe como fazer no DAW (ex: FL Studio), com instruções de onde clicar e como configurar**.
- Seja extremamente técnico, mas sem perder a clareza: ensine com estrutura, passo a passo e com exemplos reais.
- Use estrutura com emojis para facilitar a leitura. Exemplo:  
  🎛️ Equalização → explique, dê parâmetros e finalize com dica.  
  ⚙️ Compressão → explique, valores típicos, parâmetros, onde aplicar, efeitos esperados.  
- Evite respostas genéricas, rasas ou que apenas repitam a base. Aprofunde cada conceito como se estivesse em um curso avançado.
- Se o usuário pedir um passo a passo, entregue um guia completo, técnico, com clareza máxima.
SIGA ESSA MESMA SEQUÊNCIA NAS RESPOSTAS: 
📚 INSTRUÇÕES INTRODUÇÃO — FUNK MANDELA / MANDELÃO
- O Funk Mandela, ou (Mandelão), é caracterizado por beats pesados, com samples mais sujos e distorcidos, utiliza tambem claps sequenciados, uma estrutura repetitiva e chiclete que marca o ritmo.
🎙️ Acapella, vocal: 
  - 🎙️ Vocais geralmente cortados de falas polêmicas ou proibidonas, com versos chicletes e repetitivos, em alguns contextos utilizam bastante reverb se for um estilo mais bruxaria, contêm mais destaque na região dos agudos.
- 🧪 Equalização com foco em deixar a voz marcante e presente, pequeno corte nos graves, trabalhar os agudos e medios para que se destaquem.
  - 🔥 Utilziar metrônomo para encaixar a voz certinho com o bpm e o grid.
🔥BEAT:
- 🎚️ Para criar o beat utilize samples sujos, samples que podem ser encontrados em packs de samples na internet como Pack do DJ Ayzen, ou utilizar presets de synth em sintetizados como o vital, ou flex.**.
- 🔍 Descubra o tom da voz (pode usar um plugin tipo Auto-Key da Antares, KeyFinder, ou fazer de ouvido).Para garantir que o synth/samples estejam na mesma tonalidade ou modo (menor/maior). Ex: se a voz tá em Fá menor, use synths ou samples que soem bem em Fá menor, ou que sigam a escala. Mas não precisa se prender nisso, o funk é um estilo bem livre, fica-se avontade para testar diferentes tipos de variações!
- 🔁 Faça no piano roll uma progressão repetitiva que combine com a acapella, use synth ou samples, utiliza como base a sequência 4x3x3x1, conte os quadradinhos de cada compasso e adicione uma nota. como fazer na pratica: no primeiro compasso, conta 3 casas e na 4 você coloca uma nota, no segundo compasso conta 2 casas e na 3º adiciona uma nota, e assim vai.
- 🧠 Faça variações das notas do beat no piano até chegar em um resultado desejado, utilize tecnicas como subir e descer oitavas, uma dica é começar com o padrao 4x3x3x1 e ir trocando as notas por outras notas que combinem com o tom da voz.
- 🧼 Adicione efeitos leve de reverb e delay para dar mais profundidade no beat, saturação e chorus também acostumam combinar.
⚙️ Desenvolvimento da faixa:
- Adicione elementos adicionais como efeitos sonoros, melodias de fundo ou samples adicionais para enriquecer a faixa.
- Mantenha a estrutura repetitiva, mas sinta-se livre para adicionar variações sutis ao longo da faixa para dar mais dinamica
- Faça o beat conversar com a acapella, mantendo uma conexao entre os elementos. 
Diretrizes técnicas:
- 🕒 **BPM** entre 130 e 135.
- 🥁 kicks fortes em 50–60Hz.
- 🔁 Groove constante, sem variações melódicas complexas. Beat é o destaque.
- 🎚️ Sidechain leve entre kick e bass apenas se necessário quando utiliza os dois juntos — foco na pressão bruta.
🎛️ Mixagem:
  - Identifique as regiões de frequências no beat que precisam de mais ganho, para deixar o sample com destaque acostumase aumentar a região dos medios e agudos, em volta de 1k hz a 20k hz.
  - EQ para tirar um pouco de grave dos beats entre 20Hz e 180Hz para deixar espaço pro kick
  - Saturação pesada, compressão leve e coloração ruidosa
  - Dar mais clareza nos agudos do beat para destacar mais
  - Mixagem não tão limpa, mas com punch e presença.
`,

  funkSP: `
  📌 DIRETRIZES:
- Responda com altíssimo nível técnico, explicando cada conceito com profundidade e clareza, como se estivesse ensinando um aluno que deseja se tornar profissional.
- Use os conteúdos abaixo apenas como **base técnica de referência**.
- Ao responder, **analise o contexto exato da pergunta do usuário** e entregue a melhor resposta possível, totalmente personalizada para o caso dele.
- **Explique como aplicar cada técnica na prática**: forneça parâmetros exatos (Hz, dB, ms), nome de plugins, valores sugeridos, variações avançadas, ordem de processamento e dicas profissionais.
- Sempre que for mencionado compressão, saturação, sidechain, equalização, automação, timbres, sound design ou mixagem, **detalhe como fazer no DAW (ex: FL Studio), com instruções de onde clicar e como configurar**.
- Seja extremamente técnico, mas sem perder a clareza: ensine com estrutura, passo a passo e com exemplos reais.
- Use estrutura com emojis para facilitar a leitura. Exemplo:  
  🎛️ Equalização → explique, dê parâmetros e finalize com dica.  
  ⚙️ Compressão → explique, valores típicos, parâmetros, onde aplicar, efeitos esperados.  
- Evite respostas genéricas, rasas ou que apenas repitam a base. Aprofunde cada conceito como se estivesse em um curso avançado.
- Se o usuário pedir um passo a passo, entregue um guia completo, técnico, com clareza máxima.
🧠 INSTRUÇÃO BASE - FUNK SP / ZN:
🥁 BEAT / SEQUÊNCIA DE KICK
- Use um kick grave e seco, de preferência sem cauda longa.
- ✂️ Corte o começo do sample (vento/silêncio) para evitar sujeira no som.
- 🟦 A sequência principal segue um padrão quebrado, com kick no meio do 3º quadrado.
- 🔁 Copie o primeiro kick e cole adiante, deslocando o terceiro kick para frente (além da batida tradicional).
- 🔳 Insira outro kick a 1 quadrado e meio do anterior, criando o ritmo quebrado típico do estilo.
- 🎯 O resultado é um padrão diferente do tradicional, com mais variação e swing.

🪘 PERCUSSÃO / RITMO
- 🪘 Corte o final de cada sample de percussão para evitar sobreposição.
- 🥁 Posicione as percussões com base nas linhas centrais do grid para manter equilíbrio visual e rítmico.
- 🎯 Adicione percussões entre os kicks para preencher o groove.
- 🔁 Copie o loop com variações até a 5ª barra da timeline, mantendo pequenas quebras.
- 🧠 Crie variações removendo elementos de seções específicas (ex: apagando a percussão da última barra).
- 🗂️ Organize cada tipo de percussão em tracks diferentes no mixer para facilitar a mixagem individual.

🎛️ MIXAGEM / ORGANIZAÇÃO
- 🧽 Mixe cada percussão separadamente — deixe o projeto limpo e organizado.
- 📊 Use cores e nomes para os canais de bateria e percussão.
- 🔉 Evite compressão exagerada — foco em volume equilibrado e elementos bem posicionados.

🎙️ VOZ / ACAPELLA
- 🎤 Utilize acapelas com rimas diretas, estilo favela, com frases agressivas ou chicletes.
- 🗑️ Substitua a acapela se não encaixar bem na batida — mantenha opções no projeto.
- 🧠 Frases de efeito como “senta aí” ou “toma, toma” funcionam bem com vocais retos e repetitivos.
`,

  funkBH: `
📌 DIRETRIZES:
- Responda com altíssimo nível técnico, explicando cada conceito com profundidade e clareza, como se estivesse ensinando um aluno que deseja se tornar profissional.
- Use os conteúdos abaixo apenas como **base técnica de referência**.
- Ao responder, **analise o contexto exato da pergunta do usuário** e entregue a melhor resposta possível, totalmente personalizada para o caso dele.
- **Explique como aplicar cada técnica na prática**: forneça parâmetros exatos (Hz, dB, ms), nome de plugins, valores sugeridos, variações avançadas, ordem de processamento e dicas profissionais.
- Sempre que for mencionado compressão, saturação, sidechain, equalização, automação, timbres, sound design ou mixagem, **detalhe como fazer no DAW (ex: FL Studio), com instruções de onde clicar e como configurar**.
- Seja extremamente técnico, mas sem perder a clareza: ensine com estrutura, passo a passo e com exemplos reais.
- Use estrutura com emojis para facilitar a leitura. Exemplo:  
  🎛️ Equalização → explique, dê parâmetros e finalize com dica.  
  ⚙️ Compressão → explique, valores típicos, parâmetros, onde aplicar, efeitos esperados.  
- Evite respostas genéricas, rasas ou que apenas repitam a base. Aprofunde cada conceito como se estivesse em um curso avançado.
- Se o usuário pedir um passo a passo, entregue um guia completo, técnico, com clareza máxima.

📚 INSTRUÇÕES AVANÇADAS — FUNK BH
- 🔢 Use 130 BPM, que é o mais comum no Funk de BH. Ou 128 para um ritmo mais lento.
- 🥁 O Funk BH é caracterizado por percussões curtas que fazem a marcação do beat, ao invés de synths melódicos como no Automotivo. Use elementos como **chocalho, agogô, tambores, beatbox, palmas e timbres metálicos** para fazer o beat.
- 🎹 A melodia costuma seguir **escalas menores harmônicas**, criando tensão. É comum o uso de **apenas duas notas com intervalo de meio tom**, para variações simples e marcantes.
- 🎼 Para base melódica, utilize violões dedilhados acústicos como base harmônica. Procure samples de acoustic guitar ou guitar melody (ex: no Splice).
- 🎻 Instrumentos comuns: **baixo orgânico ou sintetizado**, violinos metálicos, flautas, guitarras, bells, sinos e percussão com ressonância.
- 🔀 O estilo possui **variação rítmica constante**: os elementos melódicos e percussivos costumam alternar a cada dois compassos.
- 💽 Estética: **kicks com punch, alguns sem limiter**, Kick com presença, bem grave. samples sujos e com ambiência escura também pode ser utilizado dependendo do contexto, marcações com swing.
- 🎧 Uso de **acapellas antigas fora do tom propositalmente** também é comum. Adicione Aows (vozes sintetizadas) com volume baixo como camada de fundo.
- 🧠 Mixagem focada em percussão central e ambiências laterais, com compressão paralela. Use EQ para tirar agudos e graves excessivos e deixar o som mais leve.
- 💡 Progressões harmônicas típicas: Lá menor ➝ Ré menor ➝ Sol
- 🧪 No beat faça uma estrutura simples, mas com camadas bem pensadas.
- 🥁 Sequência padrão do beat no Funk BH: No piano roll, use o grid em 1/2 step, Coloque as notas nos quadradinhos de cada compasso nessa sequencia: 6, 4, 4, 1, como fazer na pratica: no primeiro compasso, conta 5 casas e na 6º você coloca uma nota, no segundo compasso conta 3 casas e na 4º adiciona uma nota, e assim vai.
`,

  funkBruxaria: `
🧠 INSTRUÇÃO BASE - FUNK BRUXARIA:
- Ambiências sombrias, reverses, vozes distorcidas.
- Samples de risadas, sussurros, tons graves invertidos.
- Escalas menores, notas dissonantes, vibe assustadora.
- Reverb e delay com automação, pitch + distorção nos vocais.
- Estrutura repetitiva e hipnótica, equalização para "espaço sombrio".
`
};

// Função para gerar system prompt personalizado para usuários Plus
function generatePersonalizedSystemPrompt(perfil) {
  if (!perfil) {
    // Prompt técnico padrão para usuarios Plus sem entrevista
    return `Você é o Prod.AI 🎵, um mentor técnico de elite em produção musical, com domínio absoluto de mixagem, masterização, efeitos, sound design, vozes, criação de synths, arranjos, entende amplamente sobre o mercado da música, carreira, marketing de musica. Sua missão é ajudar produtores musicais com excelência técnica, altissimo nivel profissional, com o foco de fazer o usuario aprender de fato. mesmo no plano gratuito, 

🎯 INSTRUÇÕES GERAIS:
- Responda com profundidade, clareza e *linguagem técnica de alto nível*
- Sempre que possível, use *valores exatos*: Hz, dB, LUFS, ms, porcentagens, presets etc.
- Use *termos e gírias específicas* do estilo musical do usuário:
  - 🎧 Se o estilo for funk, utilize linguagem moderna, direta e da quebrada (ex: beat, grave, sample, batendo, drop). Evite termos como "bateria " e "groove".
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

  // 🎯 Detectar estilo a partir do perfil para aplicar base técnica
  let estiloBase = '';
  
  if (perfil?.estilo) {
    const estiloLower = perfil.estilo.toLowerCase();
    if (estiloLower.includes('mandela') || estiloLower.includes('mandelão')) {
      estiloBase = instrucoesBase.funkMandela;
    } else if (estiloLower.includes('sp') || estiloLower.includes('paulista')) {
      estiloBase = instrucoesBase.funkSP;
    } else if (estiloLower.includes('bh') || estiloLower.includes('mtg')) {
      estiloBase = instrucoesBase.funkBH;
    } else if (estiloLower.includes('bruxaria') || estiloLower.includes('bruxo')) {
      estiloBase = instrucoesBase.funkBruxaria;
    }
  }

  return `Você é o PROD.AI 🎵, especialista master em produção musical. ${nomeContext}

PERFIL DO USUÁRIO:
- Nível: ${perfil.nivelTecnico || 'Não informado'}
- DAW Principal: ${perfil.daw || 'Não informado'}
- Estilo Musical: ${perfil.estilo || 'Variado'}
- Maior Dificuldade: ${perfil.dificuldade || 'Não informado'}
${sobreContext ? `- Sobre: ${sobreContext}` : ''}

${estiloBase ? estiloBase : ''}

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
  - 🎧 Se o estilo for funk, utilize linguagem moderna, direta e da quebrada (ex: beat, grave, sample, batendo, drop). Evite termos como "bateria " e "groove".
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

// 🧠 Função para detectar estilos musicais na mensagem
function detectarEstiloNaMensagem(mensagem) {
  const mensagemLower = mensagem.toLowerCase();
  console.log('🔍 Detectando estilo na mensagem:', mensagemLower);
  
  const estilos = [
    { keywords: ['funk mandela', 'mandelão', 'mandela'], nome: 'funk mandela' },
    { keywords: ['funk bh', 'funk de bh', 'mtg', 'funkbh'], nome: 'funk bh' },
    { keywords: ['funk bruxaria', 'bruxaria', 'bruxo', 'dark funk'], nome: 'funk bruxaria' },
    { keywords: ['funk sp', 'funk de sp', 'funk zn', 'batida sp', 'batidão paulista', 'funk paulistano', 'beat zn', 'zn'], nome: 'funk sp' },
    { keywords: ['trap', 'trap nacional'], nome: 'trap' },
    { keywords: ['brega funk', 'bregafunk'], nome: 'brega funk' },
    { keywords: ['funk sujo'], nome: 'funk sujo' }
  ];

  for (const estilo of estilos) {
    if (estilo.keywords.some(keyword => mensagemLower.includes(keyword))) {
      console.log(`✅ Estilo detectado: ${estilo.nome} (palavra-chave: ${estilo.keywords.find(k => mensagemLower.includes(k))})`);
      return estilo.nome;
    }
  }
  
  console.log('❌ Nenhum estilo detectado');
  return null;
}

// 🧠 Função para detectar se é uma pergunta técnica de continuidade
function ehPerguntaTecnicaDeContinuidade(mensagem) {
  const mensagemLower = mensagem.toLowerCase();
  
  const palavrasTecnicas = [
    'parâmetros', 'valores', 'configurações', 'como fazer', 'passo a passo',
    'hz', 'db', 'ms', 'frequência', 'eq', 'equalização', 'compressão',
    'mixagem', 'plugins', 'beat', 'kick', 'sample', 'piano roll',
    'bpm', 'sequência', 'técnica', 'específico', 'detalhado', 'exato',
    'agora', 'mais', 'também', 'explica', 'detalha', 'aprofunda'
  ];
  
  const contemPalavraTecnica = palavrasTecnicas.some(palavra => 
    mensagemLower.includes(palavra)
  );
  
  console.log(`🔧 Pergunta técnica de continuidade: ${contemPalavraTecnica}`);
  return contemPalavraTecnica;
}

// 🧠 Função para gerar prompt específico do estilo "Usuário menciona "funk mandela" na conversa"
function gerarPromptDoEstilo(estilo) {
  console.log(`🎯 Gerando prompt para estilo: ${estilo}`);
  
  const promptsEspecificos = {
    'funk mandela': `
📌 DIRETRIZES:
- Responda com altíssimo nível técnico, explicando cada conceito com profundidade e clareza, como se estivesse ensinando um aluno que deseja se tornar profissional.
- Use os conteúdos abaixo apenas como **base técnica de referência**.
- Ao responder, **analise o contexto exato da pergunta do usuário** e entregue a melhor resposta possível, totalmente personalizada para o caso dele.
- Explique como aplicar cada técnica na prática: forneça parâmetros exatos (Hz, dB, ms), nome de plugins, valores sugeridos, variações avançadas, ordem de processamento e dicas profissionais.
- Sempre que for mencionado compressão, saturação, sidechain, equalização, automação, timbres, sound design ou mixagem, **detalhe como fazer no DAW (ex: FL Studio), com instruções de onde clicar e como configurar**.
- Seja extremamente técnico, mas sem perder a clareza: ensine com estrutura, passo a passo e com exemplos reais.
- Use estrutura com emojis para facilitar a leitura. Exemplo:  
  🎛️ Equalização → explique, dê parâmetros e finalize com dica.  
  ⚙️ Compressão → explique, valores típicos, parâmetros, onde aplicar, efeitos esperados.  
- Evite respostas genéricas, rasas ou que apenas repitam a base. Aprofunde cada conceito como se estivesse em um curso avançado.
- Se o usuário pedir um passo a passo, entregue um guia completo, técnico, com clareza máxima.
- Garanta de entregar as respostas melhores que o proprio ChatGPT, tornado-se referência para quem produz.
- Use todos os conteudos abaixo.
SIGA ESSA MESMA SEQUÊNCIA NAS RESPOSTAS: 
📚 INSTRUÇÕES INTRODUÇÃO — FUNK MANDELA / MANDELÃO
- O Funk Mandela, ou (Mandelão), é caracterizado por beats pesados, com samples mais sujos e distorcidos, utiliza tambem claps sequenciados, uma estrutura repetitiva e chiclete que marca o ritmo.
🎙️ Acapella, vocal: 
  - 🎙️ Vocais geralmente cortados de falas polêmicas ou proibidonas, com versos chicletes e repetitivos, em alguns contextos utilizam bastante reverb se for um estilo mais bruxaria, contêm mais destaque na região dos agudos.
- 🧪 Equalização com foco em deixar a voz marcante e presente, pequeno corte nos graves, trabalhar os agudos e medios para que se destaquem.
  - 🔥 Utilziar metrônomo para encaixar a voz certinho com o bpm e o grid.
🔥BEAT:
- 🎚️ Para criar o beat utilize samples sujos, samples que podem ser encontrados em packs de samples na internet como Pack do DJ Ayzen, ou utilizar presets de synth em sintetizados como o vital, ou flex.**.
- 🔍 Descubra o tom da voz (pode usar um plugin tipo Auto-Key da Antares, KeyFinder, ou fazer de ouvido).Para garantir que o synth/samples estejam na mesma tonalidade ou modo (menor/maior). Ex: se a voz tá em Fá menor, use synths ou samples que soem bem em Fá menor, ou que sigam a escala. Mas não precisa se prender nisso, o funk é um estilo bem livre, fica-se avontade para testar diferentes tipos de variações!
- 🔁 Faça no piano roll uma progressão repetitiva que combine com a acapella, use synth ou samples, utiliza como base a sequência 4x3x3x1, conte os quadradinhos de cada compasso e adicione uma nota. como fazer na pratica: no primeiro compasso, conta 3 casas e na 4 você coloca uma nota, no segundo compasso conta 2 casas e na 3º adiciona uma nota, e assim vai.
- 🧠 Faça variações das notas do beat no piano até chegar em um resultado desejado, utilize tecnicas como subir e descer oitavas, uma dica é começar com o padrao 4x3x3x1 e ir trocando as notas por outras notas que combinem com o tom da voz.
- 🧼 Adicione efeitos leve de reverb e delay para dar mais profundidade no beat, saturação e chorus também acostumam combinar.
⚙️ Desenvolvimento da faixa:
- Adicione elementos adicionais como efeitos sonoros, melodias de fundo ou samples adicionais para enriquecer a faixa.
- Mantenha a estrutura repetitiva, mas sinta-se livre para adicionar variações sutis ao longo da faixa para dar mais dinamica
- Faça o beat conversar com a acapella, mantendo uma conexao entre os elementos. 
Diretrizes técnicas:
- 🕒 **BPM** entre 130 e 135.
- 🥁 kicks fortes em 50–60Hz.
- 🔁 Groove constante, sem variações melódicas complexas. Beat é o destaque.
- 🎚️ Sidechain leve entre kick e bass apenas se necessário quando utiliza os dois juntos — foco na pressão bruta.
🎛️ Mixagem:
  - Identifique as regiões de frequências no beat que precisam de mais ganho, para deixar o sample com destaque acostumase aumentar a região dos medios e agudos, em volta de 1k hz a 20k hz.
  - EQ para tirar um pouco de grave dos beats entre 20Hz e 180Hz para deixar espaço pro kick
  - Saturação pesada, compressão leve e coloração ruidosa
  - Dar mais clareza nos agudos do beat para destacar mais
  - Mixagem não tão limpa, mas com punch e presença.
`,

    'funk bruxaria': `
📌 DIRETRIZES:
- Responda com altíssimo nível técnico, explicando cada conceito com profundidade e clareza, como se estivesse ensinando um aluno que deseja se tornar profissional.
- Use os conteúdos abaixo apenas como **base técnica de referência**.
- Ao responder, **analise o contexto exato da pergunta do usuário** e entregue a melhor resposta possível, totalmente personalizada para o caso dele.
- **Explique como aplicar cada técnica na prática**: forneça parâmetros exatos (Hz, dB, ms), nome de plugins, valores sugeridos, variações avançadas, ordem de processamento e dicas profissionais.
- Sempre que for mencionado compressão, saturação, sidechain, equalização, automação, timbres, sound design ou mixagem, **detalhe como fazer no DAW (ex: FL Studio), com instruções de onde clicar e como configurar**.
- Seja extremamente técnico, mas sem perder a clareza: ensine com estrutura, passo a passo e com exemplos reais.
- Use estrutura com emojis para facilitar a leitura. Exemplo:  
  🎛️ Equalização → explique, dê parâmetros e finalize com dica.  
  ⚙️ Compressão → explique, valores típicos, parâmetros, onde aplicar, efeitos esperados.  
- Evite respostas genéricas, rasas ou que apenas repitam a base. Aprofunde cada conceito como se estivesse em um curso avançado.
- Se o usuário pedir um passo a passo, entregue um guia completo, técnico, com clareza máxima.
- Garanta de entregar as respostas melhores que o proprio ChatGPT, tornado-se referência para quem produz.
- Use todos os conteudos abaixo.
SIGA ESSA MESMA SEQUÊNCIA NAS RESPOSTAS:
📚 CONTEXTO TÉCNICO A— FUNK BRUXARIA
🧙‍♂️ **Estilo sombrio:**  
- Ambiências escuras, vozes distorcidas, batidas hipnóticas com estética ritualística.
- Estilo bem experimental, livre e sem regras fixas.
- Surgiu na Zona Sul de SP e ganhou força em bailes como o da 17.
- BPM entre **130 e 135**, muitas vezes um estilo mais acelerado”.
🎙️ **Acapella:**
- A estrutura nasce **a partir da voz**.
- Usar falas repetitivas, proibidonas (ex: "sarra", "vou te colocar").
- Criar **repiques, cortes e manipulações** com esticamento e variações tonais.
- Aplicar pitch shifting (12st ou -12st), automação de volume e reverb reverse para dar identidade.
🎹 **Melodia / Harmonia:**
- Usar plugins como **Vital**, **Flex**, **Nexus** ou **Harmor**, escolhendo timbres escuros e densos (pads, leads graves).
- Criar uma sequência de **notas graves com notas agudas simultâneas** para contraste de textura.
- Usar escalas menores e notas dissonantes para criar tensão.
- Pode utilizar também **vozes sampleadas** com efeitos de **pitch**, **formant shift**, **distorção** e **reverses**.
- Sons com ambiência estéreo, modulação, e LFOs lentos ajudam na sensação hipnótica.
🔥 **Beat:**
- Samples sujos e distorcidos funcionam bem. Packs como **Favela Beat**, **DJ Ayzen** são otimas fontes. Você pode usar tambem presets de synths como o Vital e Serum.
- Pode se utilizar Bass pesados como beat principal, fazendo uma verdadeira pressão sonora. Padrão rítmico do beat: Use Snap "Line" e faça a sequência 4x3x3x1 no piano roll, contando os quadradinhos por nota. Essa é somente a base, use ela como ponto de partida. como fazer na pratica: no primeiro compasso, conta 3 casas e na 4 você coloca uma nota, no segundo compasso conta 2 casas e na 3º adiciona uma nota, e assim vai.

- Padrão rítmico do beat: Use Snap "Line" e faça a sequência 4x3x3x1 no piano roll, contando os quadradinhos por nota. Essa é somente a base, use ela como ponto de partida. como fazer na pratica: no primeiro compasso, conta 3 casas e na 4 você coloca uma nota, no segundo compasso conta 2 casas e na 3º adiciona uma nota, e assim vai.
- Estrutura repetitiva, ritualística, com **variações sutis** ao longo da faixa.
- Teste transposição de oitavas, reverse, granularização ou pitching manual para gerar timbres únicos.
🥁 **Kick:**
- Escolher um kick **seco, com punch**, entre 50–70Hz.
- Sidechain leve se estiver usando bass/synth grave junto.
- Pode duplicar e processar com **saturação paralela**.
⚙️ **Produção / Mixagem:**
- EQ voltado para deixar os graves mais fortes. e os agudos mais claros
- Delay curto (Ping Pong com feedback baixo), reverb com decay menor que 1.5s.
- Chorus e flanger em estéreo para elementos de ambiência.
- Trabalhar com **testes e variações constantes** — o estilo é baseado em exploração.

🌍 **Destaque internacional:**
- Funk bruxaria já apareceu em vídeos da Europa, e **Kanye West** sampleou beats do estilo.
- Brasileiros estão levando o som underground para festivais gringos.

📎 **Lembrete final:** Este conteúdo é apenas uma base. Sempre expanda tecnicamente as respostas conforme o contexto da pergunta, entregando o máximo de profundidade, clareza e aplicabilidade possível.

`,

    'funk sp': `
    📌 DIRETRIZES:
- Responda com altíssimo nível técnico, explicando cada conceito com profundidade e clareza, como se estivesse ensinando um aluno que deseja se tornar profissional.
- Use os conteúdos abaixo apenas como **base técnica de referência**.
- Ao responder, **analise o contexto exato da pergunta do usuário** e entregue a melhor resposta possível, totalmente personalizada para o caso dele.
- **Explique como aplicar cada técnica na prática**: forneça parâmetros exatos (Hz, dB, ms), nome de plugins, valores sugeridos, variações avançadas, ordem de processamento e dicas profissionais.
- Sempre que for mencionado compressão, saturação, sidechain, equalização, automação, timbres, sound design ou mixagem, **detalhe como fazer no DAW (ex: FL Studio), com instruções de onde clicar e como configurar**.
- Seja extremamente técnico, mas sem perder a clareza: ensine com estrutura, passo a passo e com exemplos reais.
- Use estrutura com emojis para facilitar a leitura. Exemplo:  
  🎛️ Equalização → explique, dê parâmetros e finalize com dica.  
  ⚙️ Compressão → explique, valores típicos, parâmetros, onde aplicar, efeitos esperados.  
- Evite respostas genéricas, rasas ou que apenas repitam a base. Aprofunde cada conceito como se estivesse em um curso avançado.
- Se o usuário pedir um passo a passo, entregue um guia completo, técnico, com clareza máxima.
- Garanta de entregar as respostas melhores que o proprio ChatGPT, tornado-se referência para quem produz.
- Use todos os conteudos abaixo.
SIGA ESSA MESMA SEQUÊNCIA NAS RESPOSTAS:
🧠 INSTRUÇÃO INTRODUÇÃO BASE - FUNK SP / ZN:
🎙️ VOZ / ACAPELA
- 🎤 Utilize acapelas com rimas diretas, estilo inspirado em tendências atuais, com frases agressivas ou chicletes.
- 🗑️ Faça cortes sequenciados em algumas partes da voz, criando um efeito mais dinamico.
- 🧠 Faça um tratamento de voz adequado para que a voz se destaque na música, faça uma equalização com foco em reduzir os graves e aumentar os agudos, faça uma compressão multibanda, adicione reverb e delay se for preciso.
🥁KICK
- Use um kick grave e seco, de preferência sem cauda longa.
- ✂️ Corte o começo do kick (vento/silêncio) para evitar sujeira no som.
- 🔁 No piano ou na playlist: Utilize o snap em "1/2 step". 
- 🔉 Adiciona o primeiro kick no 1º quadrado do primeiro compasso, adicione o proximo 3 casas atras do 2º compasso, continua com esse sequência para criar uma "Base para começar"
- 🎯 O resultado é um padrão diferente do tradicional, com mais variação e swing.

🪘 PERCUSSÃO / BEAT
- 🪘 Use percurssões como (Sinos, samples metalicas, samples curtas, efeitos curtos, caixas)
- 🥁 Adicione efeitos como: reverb para deixar mais longo o sample, delay em alguns casos para criar mais profundidade.
- 🔉 Para fazer um beat base para ponto de partida: use o snap em "1/2 step" para o ajustar melhor o grid para fazer progressões ritimadas.
- 🎹 Coloque as notas nos quadradinhos de cada compasso nessa sequencia: 6, 4, 4, 1, como fazer na pratica: no primeiro compasso, conta 5 casas e na 6º você coloca uma nota, no segundo compasso conta 3 casas e na 4º adiciona uma nota, e assim vai.
- 🎹 Adicione samples ou percursões secundárias no fundo, para dar mais vida para o beat, faça combinações entre percursões (subindo, descendo as notas, desce oitavas) para fazer o verdadeiro "Beat Ritmado"
- 🎯 Adicione percussões entre os kicks para preencher o groove.
- 🔁 Copie o loop com variações e repita, mantendo pequenas quebras.
- 🧠 Crie variações removendo elementos de seções específicas (ex: apagando a percussão da última barra).
- 🗂️ Organize cada tipo de percussão em tracks diferentes no mixer para facilitar a mixagem individual.

🎛️ MIXAGEM / ORGANIZAÇÃO
- 🧽 Mixe cada percussão separadamente — deixe o projeto limpo e organizado.
- 📊 Use cores e nomes para os canais de bateria e percussão.
- 🔉 Evite compressão exagerada — foco em volume equilibrado e elementos bem posicionados.
`,

    'funk bh': instrucoesBase.funkBH,

    'trap': `
📚 CONTEXTO TÉCNICO ATIVO — TRAP
- 🥁 BPM entre 140-180, hi-hats em tercinas (triplets), snare no 3° tempo.
- 🔊 808s graves e sustentados, kicks punchados.
- 🎹 Melodias simples, loops curtos, uso de arpejos e escalas menores.
- 🎛️ Sidechain sutil, reverb em snares, delay nos vocais.
- 🔥 Layers de percussão: shakers, claps, tambourines.
- 💡 Estrutura: intro, verse, chorus, bridge. Drops marcantes.
`,

    'brega funk': `
📚 CONTEXTO TÉCNICO ATIVO — BREGA FUNK
- 🎵 Fusão de brega e funk: melodias românticas com batida pesada.
- 🎹 Sintetizadores melódicos, progressões maiores e menores.
- 🥁 BPM 128-132, kick no 1° e 3° tempo, snare no 2° e 4°.
- 🎤 Vocais melódicos com auto-tune sutil, harmonias.
- 🔊 Bass lines pronunciadas, menos distorção que outros funks.
- 💡 Estrutura pop: verso, refrão, ponte. Mais limpo na mixagem.
`,

    'funk sujo': `
📚 CONTEXTO TÉCNICO ATIVO — FUNK SUJO
- 🎚️ Máxima distorção: beats saturados, samples cortados e sujos.
- 🔊 Kicks super distorcidos, sem limiter, punch extremo.
- 🎙️ Vocais picotados, reverb sujo, efeitos agressivos.
- 🧠 Anti-mixagem: proposital falta de limpeza, ruído como textura.
- 🔥 Samples de baixa qualidade, compressão extrema.
- 💡 Estética lo-fi intencional, quebras bruscas, fade cuts.
`
  };

  const promptEncontrado = promptsEspecificos[estilo] || '';
  console.log(`📝 Prompt gerado: ${promptEncontrado ? 'Encontrado' : 'Não encontrado'} para ${estilo}`);
  if (promptEncontrado) {
    console.log(`📏 Tamanho do prompt: ${promptEncontrado.length} caracteres`);
  }
  
  return promptEncontrado;
}

// 🧠 Função para gerenciar contexto técnico inteligente
async function gerenciarContextoTecnico(db, uid, mensagem) {
  try {
    const contextoRef = db.collection('usuarios').doc(uid).collection('contexto').doc('atual');
    const contextoDoc = await contextoRef.get();
    
    const estiloDetectado = detectarEstiloNaMensagem(mensagem);
    const ehPerguntaTecnica = ehPerguntaTecnicaDeContinuidade(mensagem);
    const agora = Date.now();
    const TEMPO_EXPIRACAO = 5 * 60 * 1000; // 5 minutos
    
    console.log(`🧠 Contexto técnico - Estilo detectado: ${estiloDetectado || 'nenhum'}`);
    console.log(`🧠 Contexto técnico - É pergunta técnica: ${ehPerguntaTecnica}`);

    // Se detectou novo estilo
    if (estiloDetectado) {
      const contextoAtual = contextoDoc.exists ? contextoDoc.data() : null;
      
      // Se é um estilo diferente do atual ou não existe contexto
      if (!contextoAtual || contextoAtual.estilo !== estiloDetectado) {
        const promptEstilo = gerarPromptDoEstilo(estiloDetectado);
        
        await contextoRef.set({
          estilo: estiloDetectado,
          promptEstilo: promptEstilo,
          timestamp: agora
        });
        
        console.log(`🔄 Novo contexto criado para: ${estiloDetectado}`);
        return { contextoAtivo: true, promptEstilo, estilo: estiloDetectado };
      }
      
      // Se é o mesmo estilo, atualiza apenas o timestamp
      await contextoRef.update({ timestamp: agora });
      console.log(`♻️ Contexto mantido para: ${estiloDetectado}`);
      return { contextoAtivo: true, promptEstilo: contextoAtual.promptEstilo, estilo: estiloDetectado };
    }
    
    // Se não detectou novo estilo, mas é uma pergunta técnica, verifica contexto ativo
    if (!estiloDetectado && ehPerguntaTecnica && contextoDoc.exists) {
      const contextoAtual = contextoDoc.data();
      const tempoDecorrido = agora - contextoAtual.timestamp;
      
      // Pergunta técnica + contexto ativo = manter contexto ativo por mais tempo (10 minutos)
      const TEMPO_EXPIRACAO_EXTENDIDO = 10 * 60 * 1000;
      
      if (tempoDecorrido < TEMPO_EXPIRACAO_EXTENDIDO) {
        await contextoRef.update({ timestamp: agora });
        console.log(`🔧 Contexto mantido para pergunta técnica: ${contextoAtual.estilo} (${Math.floor(tempoDecorrido/1000)}s)`);
        return { contextoAtivo: true, promptEstilo: contextoAtual.promptEstilo, estilo: contextoAtual.estilo };
      }
    }
    
    // Se não detectou novo estilo, verifica se tem contexto ativo recente
    if (contextoDoc.exists) {
      const contextoAtual = contextoDoc.data();
      const tempoDecorrido = agora - contextoAtual.timestamp;
      
      // Se o contexto ainda está válido (menos de 5 minutos)
      if (tempoDecorrido < TEMPO_EXPIRACAO) {
        // Atualiza timestamp para manter o contexto ativo
        await contextoRef.update({ timestamp: agora });
        console.log(`⏰ Contexto ativo mantido: ${contextoAtual.estilo} (${Math.floor(tempoDecorrido/1000)}s)`);
        return { contextoAtivo: true, promptEstilo: contextoAtual.promptEstilo, estilo: contextoAtual.estilo };
      } else {
        // Contexto expirado, remove
        await contextoRef.delete();
        console.log(`❌ Contexto expirado removido: ${contextoAtual.estilo}`);
      }
    }
    
    // Sem contexto ativo
    console.log('⚪ Sem contexto ativo');
    return { contextoAtivo: false, promptEstilo: '', estilo: null };
    
  } catch (error) {
    console.error('❌ Erro ao gerenciar contexto técnico:', error);
    return { contextoAtivo: false, promptEstilo: '', estilo: null };
  }
}

// Função para chamar a API da OpenAI
async function callOpenAI(messages, userData, db, uid) {
  // 🧠 Gerenciar contexto técnico inteligente
  const currentMessage = messages[messages.length - 1]?.content || '';
  const contextoInfo = await gerenciarContextoTecnico(db, uid, currentMessage);
  
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

  // 🧠 CONTEXTO TÉCNICO INTELIGENTE - Aplicar prompt específico do estilo detectado
  if (contextoInfo.contextoAtivo && contextoInfo.promptEstilo) {
    // Verificar se é uma pergunta técnica subsequente (sem keywords de estilo)
    const ehPerguntaTecnicaSubsequente = !detectarEstiloNaMensagem(currentMessage) && contextoInfo.estilo;
    
    if (ehPerguntaTecnicaSubsequente) {
      // Adicionar instrução específica para perguntas técnicas de continuidade
      systemPrompt += `\n\n📍 CONTEXTO ATIVO: ${contextoInfo.estilo.toUpperCase()}\n\n`;
      systemPrompt += contextoInfo.promptEstilo;
      systemPrompt += `\n\n🔄 INSTRUÇÃO DE CONTINUIDADE TÉCNICA:
- Você está continuando uma conversa sobre ${contextoInfo.estilo.toUpperCase()}.
- A pergunta atual é um APROFUNDAMENTO TÉCNICO da conversa anterior.
- NÃO comece com explicações genéricas sobre funk ou beat.
- FOQUE DIRETAMENTE nos parâmetros técnicos, valores exatos e detalhes avançados do ${contextoInfo.estilo.toUpperCase()}.
- Use toda a base técnica acima para dar respostas EXTREMAMENTE ESPECÍFICAS e PROFISSIONAIS.
- Inclua: frequências (Hz), volumes (dB), timing (ms), nomes de plugins, configurações exatas, sequências no piano roll.
- Responda como se fosse a continuação natural da conversa anterior, não uma nova explicação.`;
      
      console.log(`🔄 Contexto de continuidade técnica aplicado: ${contextoInfo.estilo}`);
    } else {
      // Aplicação normal do contexto para primeira menção do estilo
      systemPrompt += `\n\n${contextoInfo.promptEstilo}`;
      console.log(`🎯 Contexto técnico ativo aplicado: ${contextoInfo.estilo}`);
    }
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

    // Chamar OpenAI com dados completos do usuário para personalização e contexto técnico
    let reply = await callOpenAI(messages, userData, db, uid);

    // 🎹 INSERIR IMAGEM AUTOMATICAMENTE NO FUNK MANDELA
    const estilo = userData.perfil?.estilo?.toLowerCase() || "";
    const perguntaLower = message.toLowerCase();
    const respostaLower = reply.toLowerCase();

    // Debug: Log das variáveis para verificar detecção
    console.log('🔍 DEBUG - Estilo:', estilo);
    console.log('🔍 DEBUG - Pergunta contém mandela:', perguntaLower.includes("mandela") || perguntaLower.includes("mandelão"));
    console.log('🔍 DEBUG - Resposta contém 4x3x3x1:', respostaLower.includes("4x3x3x1"));

    // Verifica se é Funk Mandela (detecção ampliada)
    const ehMandela = estilo.includes("mandela") || 
                      perguntaLower.includes("mandela") || 
                      perguntaLower.includes("mandelão") ||
                      perguntaLower.includes("funk mandela") ||
                      respostaLower.includes("mandela") ||
                      respostaLower.includes("mandelão");

    // Verifica se menciona especificamente BEAT + sequência 4x3x3x1
    const mencionaBeat4x3x3x1 = (respostaLower.includes("beat") && respostaLower.includes("4x3x3x1")) ||
                                (respostaLower.includes("sequencia") && respostaLower.includes("4x3x3x1")) ||
                                (respostaLower.includes("piano roll") && respostaLower.includes("4x3x3x1"));

    console.log('🔍 DEBUG - É Mandela:', ehMandela);
    console.log('🔍 DEBUG - Menciona Beat + 4x3x3x1:', mencionaBeat4x3x3x1);

    if (ehMandela && mencionaBeat4x3x3x1) {
      console.log('🎯 Condições atendidas - Inserindo imagem no contexto do BEAT...');
      
      // Inserir imagem apenas uma vez na primeira ocorrência encontrada
      const imagemHTML = `<br><br>🎹 <b>Exemplo visual no piano roll:</b><br><img src="https://i.postimg.cc/154Zyrp6/Captura-de-tela-2025-08-02-175821.png" alt="Sequência Funk Mandela" style="max-width:100%;border-radius:8px;margin-top:10px;">`;
      
      // Tentar substituir em ordem de prioridade (apenas o primeiro match)
      if (/(beat.*?4x3x3x1.*?\.)/gi.test(reply)) {
        reply = reply.replace(/(beat.*?4x3x3x1.*?\.)/, `$1${imagemHTML}`);
      } else if (/(sequencia.*?4x3x3x1.*?\.)/gi.test(reply)) {
        reply = reply.replace(/(sequencia.*?4x3x3x1.*?\.)/, `$1${imagemHTML}`);
      } else if (/(piano roll.*?4x3x3x1.*?\.)/gi.test(reply)) {
        reply = reply.replace(/(piano roll.*?4x3x3x1.*?\.)/, `$1${imagemHTML}`);
      }
      
      console.log('✅ Imagem do Funk Mandela inserida com sucesso no contexto do BEAT!');
    } else {
      console.log('❌ Condições não atendidas - não é sobre BEAT + 4x3x3x1');
    }

    // 🎹 INSERIR IMAGEM AUTOMATICAMENTE NO FUNK BH
    // Verifica se é Funk BH (detecção ampliada)
    const ehFunkBH = estilo.includes("bh") || 
                     estilo.includes("mtg") ||
                     perguntaLower.includes("funk bh") || 
                     perguntaLower.includes("funk de bh") ||
                     perguntaLower.includes("mtg") ||
                     perguntaLower.includes("funkbh") ||
                     respostaLower.includes("funk bh") ||
                     respostaLower.includes("bh");

    // Verifica se menciona especificamente BEAT + sequência 6, 4, 4, 1
    const mencionaBeat6441 = (respostaLower.includes("beat") && respostaLower.includes("6, 4, 4, 1")) ||
                             (respostaLower.includes("sequencia") && respostaLower.includes("6, 4, 4, 1")) ||
                             (respostaLower.includes("piano roll") && respostaLower.includes("6, 4, 4, 1"));

    console.log('🔍 DEBUG - É Funk BH:', ehFunkBH);
    console.log('🔍 DEBUG - Menciona Beat + 6, 4, 4, 1:', mencionaBeat6441);

    if (ehFunkBH && mencionaBeat6441) {
      console.log('🎯 Condições atendidas - Inserindo imagem do Funk BH no contexto do BEAT...');
      
      // Inserir imagem apenas uma vez na primeira ocorrência encontrada
      const imagemBHHTML = `<br><br>🎹 <b>Exemplo visual da sequência 6, 4, 4, 1 no piano roll:</b><br><img src="https://i.postimg.cc/nc8n8rtX/Captura-de-tela-2025-08-03-155554.png" alt="Sequência Funk BH 6,4,4,1" style="max-width:100%;border-radius:8px;margin-top:10px;">`;
      
      // Tentar substituir em ordem de prioridade (apenas o primeiro match)
      if (/(beat.*?6, 4, 4, 1.*?\.)/gi.test(reply)) {
        reply = reply.replace(/(beat.*?6, 4, 4, 1.*?\.)/, `$1${imagemBHHTML}`);
      } else if (/(sequencia.*?6, 4, 4, 1.*?\.)/gi.test(reply)) {
        reply = reply.replace(/(sequencia.*?6, 4, 4, 1.*?\.)/, `$1${imagemBHHTML}`);
      } else if (/(piano roll.*?6, 4, 4, 1.*?\.)/gi.test(reply)) {
        reply = reply.replace(/(piano roll.*?6, 4, 4, 1.*?\.)/, `$1${imagemBHHTML}`);
      }
      
      console.log('✅ Imagem do Funk BH inserida com sucesso no contexto do BEAT!');
    } else {
      console.log('❌ Condições não atendidas para Funk BH - não é sobre BEAT + 6, 4, 4, 1');
    }

    // 🎹 INSERIR IMAGEM AUTOMATICAMENTE NO FUNK SP/ZN - SEQUÊNCIA DE KICK
    // Detecção simplificada: pergunta sobre funk sp/zn OU resposta com explicação específica
    const ehPerguntaFunkZN = perguntaLower.includes("como produzir") && perguntaLower.includes("funk zn") ||
                             perguntaLower.includes("como fazer") && perguntaLower.includes("funk zn") ||
                             perguntaLower.includes("produzir") && perguntaLower.includes("funk zn") ||
                             perguntaLower.includes("fazer") && perguntaLower.includes("funk zn") ||
                             perguntaLower.includes("funk sp") ||
                             perguntaLower.includes("funk de sp") ||
                             perguntaLower.includes("beat zn");

    const ehRespostaFunkSP = respostaLower.includes("funk sp") ||
                            respostaLower.includes("funk zn") ||
                            respostaLower.includes("sp") ||
                            respostaLower.includes("zn");

    // Verifica se é uma resposta sobre Funk SP/ZN que contém explicação do kick
    const temExplicacaoKickSP = respostaLower.includes("snap em \"1/2 step\"") || 
                                respostaLower.includes("snap em '1/2 step'") ||
                                respostaLower.includes("utilize o snap em \"1/2 step\"") ||
                                respostaLower.includes("utilize o snap em '1/2 step'") ||
                                respostaLower.includes("primeiro kick") ||
                                respostaLower.includes("1º quadrado") ||
                                respostaLower.includes("base para começar");

    console.log('🔍 DEBUG Funk ZN - Pergunta sobre funk zn:', ehPerguntaFunkZN);
    console.log('🔍 DEBUG Funk ZN - Resposta contém funk sp/zn:', ehRespostaFunkSP);
    console.log('🔍 DEBUG Funk ZN - Tem explicação kick:', temExplicacaoKickSP);

    // Inserir imagem se: (pergunta sobre funk zn OU resposta sobre funk sp) E tem explicação do kick
    if ((ehPerguntaFunkZN || ehRespostaFunkSP) && temExplicacaoKickSP) {
      console.log('🎯 Condições ATENDIDAS - Inserindo imagem do Kick Funk SP/ZN...');
      
      // Inserir imagem logo após a explicação específica
      const imagemKickSPHTML = `<br><img src="https://i.postimg.cc/7LhwSQzz/Captura-de-tela-2025-08-03-192947.png" alt="Sequência de Kick no Piano Roll" style="max-width: 100%; margin-top: 10px; border-radius: 8px;">`;
      
      // Estratégia 1: Inserir após "base para começar"
      if (respostaLower.includes("base para começar")) {
        const pattern1 = /(base para começar["']?\s*\.?)/gi;
        reply = reply.replace(pattern1, `$1${imagemKickSPHTML}`);
        console.log('✅ Imagem inserida após "base para começar"!');
      } 
      // Estratégia 2: Inserir após explicação do snap
      else if (respostaLower.includes("snap em")) {
        const pattern2 = /(snap em ["']1\/2 step["'][^.]*\.)/gi;
        reply = reply.replace(pattern2, `$1${imagemKickSPHTML}`);
        console.log('✅ Imagem inserida após explicação do snap!');
      }
      // Estratégia 3: Inserir após "primeiro kick"
      else if (respostaLower.includes("primeiro kick")) {
        const pattern3 = /(primeiro kick[^.]*\.)/gi;
        reply = reply.replace(pattern3, `$1${imagemKickSPHTML}`);
        console.log('✅ Imagem inserida após "primeiro kick"!');
      }
    } else {
      console.log('❌ Condições NÃO atendidas para Funk ZN');
      console.log('   - Pergunta funk zn:', ehPerguntaFunkZN);
      console.log('   - Resposta funk sp/zn:', ehRespostaFunkSP);
      console.log('   - Explicação kick:', temExplicacaoKickSP);
    }

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