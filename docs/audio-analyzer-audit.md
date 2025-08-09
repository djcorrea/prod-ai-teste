# Auditoria e Plano de Upgrade do Analisador de Áudio

**Data:** 9 de agosto de 2025  
**Objetivo:** Auditoria completa do sistema atual, análise de compatibilidade e plano para upgrade com novo visual futurista

---

## A. Mapa do que existe hoje

### Árvore de arquivos relevante

**Frontend:**
```
public/
├── audio-analyzer.js                    # Motor principal de análise
├── audio-analyzer.css                   # Estilos do modal atual
├── audio-analyzer-integration.js        # Integração com o chat
├── audio-analyzer-proof.html           # Testes unitários
├── audio-analyzer-interface.html       # Interface standalone
├── audio-analyzer-integration-NOVO.js  # Versão experimental
└── audio-analyzer-advanced.js          # Funcionalidades avançadas
```

**Backend:**
```
api/
└── voice-message.js                     # Endpoint de processamento de áudio
```

**Principal (index.html):**
```html
<!-- Modal integrado no index.html -->
<div id="audioAnalysisModal" class="audio-modal">
  <!-- Upload, loading, results -->
</div>
```

### Fluxo de dados atual

1. **Upload → Decode → Features → Response → DOM**
   ```
   File Input → Web Audio API → AudioBuffer → performFullAnalysis() → Modal UI
   ```

2. **Processamento:**
   ```javascript
   analyzeAudioFile(file) → audioContext.decodeAudioData() → performFullAnalysis(audioBuffer)
   ```

3. **Análise:**
   ```javascript
   // Volume & Dinâmica
   findPeakLevel() → Peak dB
   calculateRMS() → RMS dB  
   calculateDynamicRange() → Peak - RMS
   
   // Frequências
   findDominantFrequencies() → simpleFFT() → Top 5 frequências
   
   // Diagnóstico
   detectCommonProblems() → Lista de problemas
   generateTechnicalSuggestions() → Sugestões de melhoria
   ```

### Contratos atuais

**Endpoints:**
- Nenhum endpoint específico para análise de mixagem
- `api/voice-message.js` faz análise básica de áudio para transcrição

**Formato de resposta JSON:**
```javascript
{
  duration: number,           // Duração em segundos
  sampleRate: number,        // Taxa de amostragem
  channels: number,          // Número de canais
  problems: [],              // Array de problemas detectados
  suggestions: [],           // Array de sugestões
  technicalData: {
    peak: number,            // Peak em dB
    rms: number,             // RMS em dB
    dynamicRange: number,    // Dinâmica em dB
    dominantFrequencies: []  // Top 5 frequências
  }
}
```

**IDs DOM atuais:**
```javascript
// Modal
#audioAnalysisModal, #audioUploadArea, #audioAnalysisLoading, #audioAnalysisResults
#modalTechnicalData, #audioProgressFill, #audioProgressText
#modalAudioFileInput

// Não há IDs específicos para métricas individuais no modal atual
```

### Métricas já calculadas

**Localização:** `audio-analyzer.js`

1. **Peak Level** (`findPeakLevel`): Nível de pico em dBFS
2. **RMS Level** (`calculateRMS`): Nível RMS médio em dBFS  
3. **Dynamic Range** (`calculateDynamicRange`): Diferença Peak-RMS
4. **Dominant Frequencies** (`findDominantFrequencies`): Top 5 frequências via FFT simples
5. **Duration**: Duração do arquivo
6. **Sample Rate & Channels**: Metadados básicos

### Dependências atuais

**Frontend:**
- Web Audio API nativa (sem libs externas)
- HTML5 File API
- Drag & Drop API
- Canvas API (não utilizada atualmente)

**Backend:**
- Node.js + Express
- OpenAI Whisper API (transcription)
- Firebase Admin SDK
- Vercel runtime limits

**Nenhuma dependência de análise de áudio externa** - tudo é nativo/manual

---

## B. Pontos críticos e compatibilidade

### Riscos identificados

**Performance:**
- FFT simples limitada a 512 samples (performance vs precisão)
- Processamento single-threaded (pode travar UI)
- Limite de 20MB por arquivo (pode ser insuficiente para masters)
- Timeout de 30 segundos pode ser curto para arquivos grandes

**Limitações técnicas:**
- Sem oversampling para True Peak
- FFT básico (não é profissional como FFTW)
- Análise de frequência simplificada (bins fixos, sem escala crítica)
- Sem análise estéreo/fase adequada

**Compatibilidade browser:**
- Web Audio API suporte: Chrome ✅, Firefox ✅, Safari ✅, Edge ✅
- File API suporte universal
- Performance varia entre dispositivos móveis

### Limites de CPU/memória e estratégias

**Vercel Limits:**
- Function timeout: 10s (Hobby) / 60s (Pro)
- Memory: 1GB
- CPU: Compartilhado

**Estratégias de otimização:**
1. **Downmix para mono** quando análise estéreo não necessária
2. **Resample para 48kHz** padrão (reduz dados)
3. **Chunking** para arquivos >5MB
4. **Web Workers** para FFT/processamento pesado
5. **Streaming analysis** para arquivos grandes

### Segurança

**Validações atuais:**
- Tipo MIME básico (`audio/*`)
- Tamanho máximo (20MB)

**Melhorias necessárias:**
- Validação de header binário real
- Limite de duração (max 10 minutos)
- Rate limiting por usuário
- Sanitização de metadados
- DoS protection (múltiplos uploads simultâneos)

### Acessibilidade e responsividade

**Modal atual:**
- ✅ Responsivo (mobile/desktop)
- ✅ Keyboard navigation (ESC para fechar)
- ✅ Touch-optimized (botões 44px+)
- ❌ Screen reader labels insuficientes
- ❌ Focus trap no modal
- ❌ ARIA attributes ausentes

**CSS conflitos:**
- ✅ CSS escopado sob `.audio-modal`
- ✅ z-index alto (10000)
- ❌ Pode conflitar com animations globais
- ❌ Variáveis CSS não padronizadas

---

## C. Métricas novas desejadas e viabilidade

### Core & Loudness

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **LUFS Integrado** | COMPLEXA | essentia.js-wasm | ±0.1 LUFS | Alto | `{integrated: -14.2}` |
| **LUFS Short/Momentary** | COMPLEXA | essentia.js-wasm | ±0.2 LUFS | Médio | `{short: -12.1, momentary: -10.5}` |
| **True Peak (oversampling)** | VIÁVEL | @ffmpeg/ffmpeg | ±0.1 dB | Alto | `{truePeak: -0.8, overSampled: 4}` |
| **RMS/Peak/Headroom** | NATIVA ✅ | Web Audio API | ±0.1 dB | Baixo | `{rms: -18.2, peak: -3.1, headroom: 3.1}` |
| **LRA (Loudness Range)** | VIÁVEL | essentia.js-wasm | ±0.5 LU | Médio | `{lra: 8.2, percentile10: -22.1, percentile95: -13.9}` |

### Dinâmica & Transientes

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **Crest Factor** | NATIVA | Web Audio API | ±0.1 | Baixo | `{crest: 12.8, perBand: [15.2, 10.4, 8.9]}` |
| **DR (Dynamic Range)** | VIÁVEL | dsp.js | ±0.5 dB | Médio | `{dr14: 8, drLufs: 7.2}` |
| **Transient Strength** | COMPLEXA | essentia.js-wasm | ±5% | Alto | `{strength: 0.73, byBand: [0.8, 0.65, 0.71]}` |
| **Gate de ruído** | VIÁVEL | Web Audio API | ±2 dB | Baixo | `{noiseFloor: -58.2, gate: -70}` |

### Tempo & Ritmo

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **BPM (autocorrelação)** | VIÁVEL | music-tempo | ±2 BPM | Alto | `{bpm: 128.5, confidence: 0.89}` |
| **Onset Detection** | COMPLEXA | essentia.js-wasm | ±20ms | Alto | `{onsets: [1.24, 1.76, 2.28], stability: 0.92}` |

### Tonalidade & Harmonia

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **Key Detection** | VIÁVEL | music-metadata + dsp | ±1 semitom | Alto | `{key: 'A', scale: 'major', confidence: 0.78}` |
| **Chord Analysis** | COMPLEXA | essentia.js-wasm | Heurística | Muito Alto | `{mainChords: ['Am', 'F', 'C', 'G'], progression: '...'}` |

### Frequência & Timbre

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **Spectral Centroid** | VIÁVEL | meyda | ±50 Hz | Médio | `{centroid: 2850.5, brightness: 0.65}` |
| **Spectral Rolloff** | VIÁVEL | meyda | ±100 Hz | Médio | `{rolloff85: 6800, rolloff95: 12000}` |
| **Spectral Flux/Flatness** | VIÁVEL | meyda | Normalizado | Médio | `{flux: 0.42, flatness: 0.18}` |
| **Harmonic Ratio** | COMPLEXA | essentia.js-wasm | ±10% | Alto | `{harmonicity: 0.73, inharmonic: 0.27}` |
| **Freq. Dominantes++** | NATIVA ✅ | FFT melhorado | ±25 Hz | Baixo | `{peaks: [{f:440, mag:0.8, q:2.1}]}` |

### Estéreo & Fase

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **Stereo Correlation** | VIÁVEL | Web Audio API | ±0.05 | Baixo | `{correlation: 0.92, monoCompat: 'good'}` |
| **Stereo Width** | VIÁVEL | Web Audio API | ±5% | Baixo | `{width: 0.85, byBand: [0.3, 0.9, 1.2]}` |
| **Balance L/R** | NATIVA | Web Audio API | ±1% | Baixo | `{balance: 0.02, left: 0.49, right: 0.51}` |

### Mascaramento Kick-Bass

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **Índice Mascaramento** | VIÁVEL | FFT + heurística | ±15% | Médio | `{maskingIndex: 0.67, overlap: 'moderate'}` |
| **Sugestão Sidechain** | VIÁVEL | Análise espectral | Heurística | Médio | `{sidechainSuggested: true, ratio: '4:1', attack: '1ms'}` |

### Qualidade & Saúde

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **DC Offset** | NATIVA | Web Audio API | ±0.001 | Baixo | `{dcOffset: 0.0023, needsFilter: false}` |
| **Clipping/Overs** | NATIVA ✅ | Web Audio API | Exato | Baixo | `{clippedSamples: 42, percentage: 0.02}` |
| **Sibilância** | VIÁVEL | Filtro 5-10kHz | ±20% | Médio | `{sibilanceIndex: 0.31, problematic: false}` |
| **SNR Estimado** | VIÁVEL | Análise de ruído | ±3 dB | Médio | `{snr: 68.2, quality: 'excellent'}` |

### Scores & Feedback

| Métrica | Status | Biblioteca Sugerida | Precisão | Custo CPU | Formato Output |
|---------|--------|-------------------|----------|-----------|----------------|
| **Score Qualidade** | VIÁVEL | Algoritmo próprio | Subjetivo | Baixo | `{score: 87, breakdown: {...}}` |
| **Coloração Musical** | COMPLEXA | ML/heurística | Subjetivo | Alto | `{hue: 'warm', color: 'orange', mood: 'energetic'}` |
| **Feedback Textual** | VIÁVEL | Template engine | - | Baixo | `{feedback: ['Excelente dinâmica', 'Considere...'], priority: 'high'}` |

---

## D. Bibliotecas candidatas

### Análise Principal

**essentia.js-wasm** (Recomendada para métricas avançadas)
- **Prós:** LUFS real, onset detection, spectral analysis completo
- **Contras:** 15MB bundle, curva de aprendizado
- **Licença:** AGPLv3 (open source)
- **Versão:** 2.1-beta

**@ffmpeg/ffmpeg** (Para oversampling/decode)
- **Prós:** True peak, suporte a formatos, qualidade profissional
- **Contras:** 25MB bundle, lento inicialização
- **Licença:** LGPL (open source)
- **Versão:** 0.12.x

### DSP & Features

**meyda** (Features espectrais)
- **Prós:** 13 features prontas, bem documentado, leve
- **Contras:** Limitado para análise avançada
- **Licença:** MIT
- **Size:** ~50KB
- **Versão:** 5.x

**music-tempo** (BPM detection)
- **Prós:** Algoritmo maduro, preciso
- **Contras:** Apenas BPM
- **Licença:** MIT
- **Size:** ~30KB

**dsp.js** (Filtros/processamento)
- **Prós:** Filtros, janelas, FFT otimizada
- **Contras:** API complexa
- **Licença:** MIT
- **Size:** ~80KB

### Utilitários

**music-metadata** (Metadados)
- **Prós:** Suporte completo a tags
- **Contras:** Node.js focused
- **Licença:** MIT
- **Size:** ~200KB

**audiobuffer-to-wav** (Export/debug)
- **Prós:** Útil para debugging
- **Licença:** MIT
- **Size:** ~10KB

### Estratégia de carregamento

1. **Core sempre:** Web Audio API nativa
2. **Sob demanda:** essentia.js-wasm (flag ADVANCED_METRICS)
3. **Progressive:** Carregar bibliotecas por feature solicitada
4. **Cache agressivo:** Service Worker para libs grandes

---

## E. Contrato de IDs no Front

### IDs existentes (manter compatibilidade)

```javascript
// Modal principal
#audioAnalysisModal, #audioUploadArea, #audioAnalysisLoading, #audioAnalysisResults
#modalTechnicalData, #audioProgressFill, #audioProgressText

// Input
#modalAudioFileInput
```

### IDs canônicos propostos

#### Resumo (sempre visível)
```javascript
#peakValue          // Peak level em dB
#truePeakValue      // True Peak com oversampling  
#rmsValue           // RMS level em dB
#lufsIntValue       // LUFS integrado
#durationValue      // Duração em segundos
#dominantFreqValue  // Frequência dominante principal
```

#### Loudness & Headroom
```javascript
#lufsCard           // Card container
#lufsIntegrated     // LUFS integrado (-14.2 LUFS)
#lufsShort          // LUFS short-term
#lufsMomentary      // LUFS momentary
#headroomCard       // Headroom analysis
#headroomValue      // Headroom disponível
#truePeakCard       // True peak analysis
```

#### Tonal Balance
```javascript
#tbSubRms           // Sub-bass RMS (20-60Hz)
#tbLowRms           // Low RMS (60-250Hz)
#tbMidRms           // Mid RMS (250-4kHz)
#tbHighRms          // High RMS (4k-20kHz)
#tbChart            // Canvas para gráfico
```

#### Dinâmica
```javascript
#crestFactor        // Crest factor
#dynamicRange       // DR14/LUFS range
#lraValue           // Loudness Range (LRA)
#transientStrength  // Força dos transientes
```

#### Frequência & Timbre
```javascript
#centroid           // Spectral centroid
#rolloff            // Rolloff frequency
#spectralFlux       // Flux temporal
#keyValue           // Tonalidade detectada
#scaleValue         // Escala (major/minor)
#spectrumChart      // Canvas para spectrum
```

#### Mascaramento Kick-Bass
```javascript
#maskIndex          // Índice de mascaramento (0-1)
#maskOverlap        // Overlap percentage
#sidechain          // Sugestão de sidechain
#maskTimes          // Tempos críticos
#maskSuggestion     // Texto da sugestão
```

#### Novos (compatibilidade futura)
```javascript
#bpmValue           // BPM detectado
#stereoCorrelation  // Correlação estéreo
#balanceLR          // Balance L/R
#dcOffset           // DC offset
#clippingEvents     // Eventos de clipping
#sibilanceIndex     // Índice de sibilância
#noiseFloor         // Ruído de fundo
#colorHue           // Cor musical
#qualityScore       // Score 0-100
#finalFeedback      // Feedback textual
```

### Backwards Compatibility Strategy

```javascript
// Manter IDs antigos funcionando
const LEGACY_MAPPING = {
  // Antigo → Novo
  '#modalTechnicalData': '#summaryCard',
  // Adicionar outros conforme necessário
};
```

---

## F. Novo Visual - Especificação

### Tema: Futurista/Tecnológico

**Paleta de cores:**
```css
:root {
  --primary-neon: #00d4ff;           /* Azul neon principal */
  --secondary-neon: #b066ff;         /* Roxo neon secundário */
  --accent-green: #00ff88;           /* Verde neon (destaque) */
  --glass-bg: rgba(26, 26, 26, 0.7); /* Glassmorphism background */
  --glass-border: rgba(0, 212, 255, 0.3);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --surface-dark: #1a1a1a;
  --surface-darker: #0d0d0d;
}
```

**Glassmorphism:**
```css
.glass-card {
  background: rgba(26, 26, 26, 0.8);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### Layout dos Cards

**Grid System:**
```css
.analyzer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  padding: 24px;
}

.metric-card {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
```

**Responsive Breakpoints:**
```css
/* Mobile first */
@media (max-width: 768px) {
  .analyzer-grid { grid-template-columns: 1fr; }
}
@media (min-width: 1200px) {
  .analyzer-grid { grid-template-columns: repeat(3, 1fr); }
}
```

### Gráficos Canvas

**Spectrum Analyzer:**
```javascript
// Visualização do espectro em tempo real
const spectrumCanvas = {
  bars: true,         // Barras estilo DJ
  gradient: true,     // Gradiente neon
  reactive: true,     // Animação suave
  logarithmic: true   // Escala log
};
```

**Waveform:**
```javascript
const waveformCanvas = {
  style: 'oscilloscope', // Estilo vintage tech
  color: 'var(--primary-neon)',
  glow: true             // Efeito glow
};
```

### Acessibilidade

**Contraste WCAG AA:**
- Texto principal: 4.5:1 mínimo
- Texto secundário: 3:1 mínimo
- Elementos interativos: 3:1 mínimo

**Focus/Keyboard:**
```css
.focusable:focus {
  outline: 2px solid var(--primary-neon);
  outline-offset: 2px;
}
```

### CSS Escopo Zero-Conflito

```css
/* Escopo raiz */
.audio-analyzer-modal {
  /* Todos os estilos dentro deste escopo */
  --local-primary: var(--primary-neon, #00d4ff);
  
  /* Reset local para evitar heranças */
  font-family: 'Poppins', sans-serif;
  box-sizing: border-box;
}

.audio-analyzer-modal *,
.audio-analyzer-modal *::before,
.audio-analyzer-modal *::after {
  box-sizing: inherit;
}
```

---

## G. Plano de implementação por fases

### Fase 1 — Infra & Contrato (2-3 dias)

**Objetivos:**
- Novo endpoint `api/analyze-audio-v2.js`
- Schema JSON padronizado com Zod
- Validação robusta (MIME real, limites, rate limiting)
- Feature flags no config

**Deliverables:**
```javascript
// api/analyze-audio-v2.js
export default async function handler(req, res) {
  // Validação + processamento + resposta padronizada
}

// schemas/audio-analysis.js
const AudioAnalysisSchema = z.object({
  metadata: z.object({...}),
  metrics: z.object({...}),
  diagnostics: z.object({...})
});
```

**Rollback:** Endpoint antigo permanece ativo

### Fase 2 — Features Core (3-4 dias)

**Objetivos:**
- Implementar métricas NATIVAS/VIÁVEIS
- Web Workers para processamento pesado
- Cache de análises
- Feature flags: `FEATURE_ANALYZER_V2=true`

**Métricas implementadas:**
- ✅ Peak/RMS/Dynamic Range (melhorado)
- ✅ True Peak (com oversampling básico)
- ✅ Spectral Centroid/Rolloff (meyda)
- ✅ Stereo Analysis (correlação, width, balance)
- ✅ DC Offset, Clipping detection
- ✅ Quality Score Algorithm

**Rollback:** Feature flag desativa novas métricas

### Fase 3 — UI/Modal V2 (2-3 dias)

**Objetivos:**
- Novo CSS glassmorphism escopado
- Cards responsivos com métricas
- Manter IDs antigos + novos
- Toggle visual antigo/novo

**Implementation:**
```javascript
// Dual rendering
if (FEATURE_NEW_UI) {
  renderNewModal(analysis);
} else {
  renderLegacyModal(analysis);
}
```

**Rollback:** Toggle reverte para UI antiga sem redeploy

### Fase 4 — Performance (2 dias)

**Objetivos:**
- Web Workers para FFT pesada
- Downmix inteligente (mono quando possível)
- Resample para 48kHz padrão
- Streaming para arquivos >5MB

**Optimizations:**
```javascript
// Worker pool para análises paralelas
const workerPool = new WorkerPool('audio-analyzer-worker.js', 2);

// Smart downmix
if (!needsStereoAnalysis) {
  audioBuffer = downmixToMono(audioBuffer);
}
```

### Fase 5 — Advanced Metrics (3-4 dias)

**Objetivos:**
- Integrar essentia.js-wasm (LUFS real)
- BPM detection
- Key detection básica
- Mascaramento kick-bass

**Load strategy:**
```javascript
// Lazy loading para advanced
const loadAdvancedAnalyzer = async () => {
  if (!window.EssentiaWASM) {
    await loadScript('essentia-wasm.js');
  }
};
```

### Fase 6 — QA & Telemetria (1-2 dias)

**Objetivos:**
- Testes automatizados (Jest)
- Testes de contrato (Zod validation)
- Logs de performance
- Métricas de erro

**Tests:**
```javascript
// Unit tests
test('Peak calculation accuracy', () => {
  const synthetic = generateSine(1000, 0.5, 1.0);
  const analysis = analyzeAudio(synthetic);
  expect(analysis.peak).toBeCloseTo(-6.02, 0.5);
});
```

### Cronograma Total: ~15-18 dias

**Week 1:** Fases 1-3 (Infra + Features + UI)  
**Week 2:** Fases 4-6 (Performance + Advanced + QA)

### Rollback Strategy

**Global Flag:** `ANALYZER_VERSION=v1|v2`
```javascript
const config = {
  ANALYZER_VERSION: process.env.ANALYZER_VERSION || 'v1',
  FEATURE_NEW_UI: process.env.FEATURE_NEW_UI === 'true',
  FEATURE_ADVANCED_METRICS: process.env.FEATURE_ADVANCED_METRICS === 'true'
};
```

**Instant rollback:** Mudar env var, sem redeploy necessário

---

## H. Testes e validação

### Testes unitários

**Synthetic Audio Tests:**
```javascript
describe('Core Metrics', () => {
  test('1kHz sine @ -6dB', () => {
    const signal = generateSine(1000, 0.5, 44100, 1.0);
    const analysis = analyzeAudio(signal);
    
    expect(analysis.peak).toBeCloseTo(-6.02, 0.5);
    expect(analysis.rms).toBeCloseTo(-9.03, 0.5);
    expect(analysis.dominantFreq).toBeCloseTo(1000, 50);
  });
  
  test('Clipping detection', () => {
    const signal = generateSine(1000, 1.0, 44100, 1.0); // 0dB
    const analysis = analyzeAudio(signal);
    
    expect(analysis.problems).toContainEqual(
      expect.objectContaining({ type: 'clipping' })
    );
  });
});
```

**Real Audio Tests:**
```javascript
// Assets de teste
const testAssets = [
  'test-kick-bass.wav',      // Mascaramento
  'test-wide-stereo.wav',    // Stereo analysis
  'test-dynamic.wav',        // DR test
  'test-compressed.wav',     // Over-compression
  'test-sine-440.wav'        // Frequency accuracy
];
```

### Testes de contrato

**Schema Validation:**
```javascript
import { AudioAnalysisSchema } from '../schemas/audio-analysis.js';

test('API response schema', async () => {
  const response = await fetch('/api/analyze-audio-v2', {
    method: 'POST',
    body: testAudioFormData
  });
  
  const data = await response.json();
  
  // Validate with Zod
  expect(() => AudioAnalysisSchema.parse(data)).not.toThrow();
  
  // Validate specific fields
  expect(data.metrics.peak).toBeNumber();
  expect(data.metrics.rms).toBeNumber();
  expect(data.diagnostics.problems).toBeArray();
});
```

### Testes E2E

**Full Flow Tests:**
```javascript
describe('Upload → Analysis → DOM', () => {
  test('Complete analysis workflow', async () => {
    // 1. Upload file
    const file = new File([wavData], 'test.wav', { type: 'audio/wav' });
    await uploadToModal(file);
    
    // 2. Wait for analysis
    await waitForElement('#audioAnalysisResults');
    
    // 3. Verify all IDs populated
    expect(document.getElementById('peakValue').textContent).toBeTruthy();
    expect(document.getElementById('rmsValue').textContent).toBeTruthy();
    expect(document.getElementById('qualityScore').textContent).toBeTruthy();
    
    // 4. Test chat integration
    await clickSendToChat();
    expect(getChatInput().value).toContain('Análise técnica');
  });
});
```

### Casos extremos

**Edge Cases:**
```javascript
const edgeCases = [
  {
    name: 'Silent audio',
    generator: () => generateSilence(10.0),
    expects: { rms: -Infinity, problems: ['no_signal'] }
  },
  {
    name: 'Very long (300s)',
    file: 'test-long-300s.wav',
    expects: { duration: 300, timeout: false }
  },
  {
    name: '192kHz sample rate',
    file: 'test-192k.wav',
    expects: { resample: true, analysis: true }
  },
  {
    name: 'Mono file',
    file: 'test-mono.wav',
    expects: { stereoWidth: null, correlation: null }
  },
  {
    name: 'Heavily clipped',
    generator: () => generateClipped(0.95),
    expects: { clippingEvents: '>100', severity: 'high' }
  }
];
```

### Performance Benchmarks

**Timing Tests:**
```javascript
const benchmarks = [
  { file: '3min-song.wav', maxTime: 15000 },  // 15s max
  { file: '10s-snippet.wav', maxTime: 3000 }, // 3s max
  { file: 'large-20mb.wav', maxTime: 30000 }  // 30s max
];

benchmarks.forEach(({ file, maxTime }) => {
  test(`Performance: ${file}`, async () => {
    const start = performance.now();
    await analyzeAudio(loadFile(file));
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(maxTime);
  });
});
```

### Exemplos cURL/Postman

**Basic Analysis:**
```bash
curl -X POST https://prod-ai-teste.vercel.app/api/analyze-audio-v2 \
  -H "Content-Type: multipart/form-data" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -F "audio=@test-song.wav" \
  -F "options={\"features\":[\"core\",\"spectral\"]}"
```

**Advanced Analysis:**
```bash
curl -X POST https://prod-ai-teste.vercel.app/api/analyze-audio-v2 \
  -H "Content-Type: multipart/form-data" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -F "audio=@master.wav" \
  -F "options={\"features\":[\"all\"],\"lufs\":true,\"truePeak\":true}"
```

**Postman Collection:**
```json
{
  "name": "Audio Analyzer V2 API",
  "requests": [
    {
      "name": "Basic Analysis",
      "method": "POST",
      "url": "{{baseUrl}}/api/analyze-audio-v2",
      "headers": {"Authorization": "Bearer {{token}}"},
      "body": {"audio": "{{audioFile}}"}
    }
  ]
}
```

---

## I. Checklist de PR (Fase 2)

### Arquivos criados/alterados

**Novos arquivos:**
```
✅ api/analyze-audio-v2.js              # Novo endpoint
✅ schemas/audio-analysis.js             # Schema Zod
✅ public/audio-analyzer-v2.js           # Motor V2
✅ public/audio-analyzer-v2.css          # Estilos glassmorphism
✅ workers/audio-analyzer-worker.js      # Web Worker
✅ tests/audio-analyzer.test.js          # Unit tests
✅ tests/fixtures/                       # Test assets
✅ docs/api-v2-reference.md              # API docs
```

**Arquivos alterados:**
```
📝 public/index.html                     # Feature flags + novo modal
📝 public/audio-analyzer-integration.js  # Integração V2
📝 vercel.json                          # Configuração API
📝 package.json                         # Novas dependências
📝 .env.example                         # Variáveis de ambiente
```

### Migrações necessárias

**Variáveis de ambiente:**
```bash
# Feature flags
ANALYZER_VERSION=v2                    # v1|v2
FEATURE_NEW_UI=true                   # true|false
FEATURE_ADVANCED_METRICS=false       # true|false (false initially)

# Performance
AUDIO_MAX_FILE_SIZE=25MB             # Increased from 20MB
AUDIO_PROCESSING_TIMEOUT=45000       # 45s timeout
WORKER_POOL_SIZE=2                   # Concurrent workers
```

**Schema migrations:**
```sql
-- Se usar banco de dados para analytics
ALTER TABLE audio_analyses ADD COLUMN version VARCHAR(10) DEFAULT 'v1';
ALTER TABLE audio_analyses ADD COLUMN advanced_metrics JSON;
```

### Dependências novas

```json
{
  "dependencies": {
    "zod": "^3.22.0",                  // Schema validation
    "meyda": "^5.6.3",                 // Spectral features
    "music-tempo": "^0.4.0"            // BPM detection
  },
  "devDependencies": {
    "jest": "^29.0.0",                 // Unit tests
    "@jest/globals": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```

### Instruções de build

```bash
# Setup
npm install

# Run tests
npm test

# Start dev server
npm run dev

# Deploy
vercel --prod
```

### Verificação de compatibilidade

**Checklist:**
- ✅ Login/auth não afetado
- ✅ Chatbot funcionando normal
- ✅ Header/navigation intacto
- ✅ Modal antigo acessível via feature flag
- ✅ Performance não degradada (página principal)
- ✅ Mobile responsividade mantida
- ✅ Acessibilidade não comprometida

### Screenshots/GIFs

**Comparação lado a lado:**
1. `modal-v1-current.gif` - Modal atual
2. `modal-v2-glassmorphism.gif` - Novo modal glassmorphism
3. `mobile-responsive-v2.gif` - Responsividade mobile
4. `integration-chat-v2.gif` - Integração com chat
5. `performance-comparison.png` - Métricas de performance

### Code Review Points

**Pontos críticos para review:**
1. **Schema validation** - Zod types corretos
2. **Error handling** - Graceful fallbacks
3. **Memory leaks** - Web Workers cleanup
4. **Security** - File validation robusta
5. **Performance** - Profiling de operações custosas
6. **Accessibility** - ARIA labels, keyboard navigation
7. **Cross-browser** - Compatibilidade Safari/Firefox

### Deploy Strategy

**Staged rollout:**
1. **Stage 1:** Deploy com `ANALYZER_VERSION=v1` (safe)
2. **Stage 2:** A/B test com 10% users `v2`
3. **Stage 3:** Full rollout se metrics OK
4. **Rollback:** Env var change apenas

---

## Resumo Executivo

### Métricas atuais vs. novas

**Implementadas (5 métricas):**
- ✅ Peak, RMS, Dynamic Range, Dominant Frequencies, Duration

**Adicionáveis facilmente (12 métricas):**
- 🟡 True Peak, Spectral Centroid/Rolloff, Stereo Width/Correlation, DC Offset, Clipping Events, Crest Factor, Balance L/R, Noise Floor, Quality Score

**Complexas mas viáveis (8 métricas):**
- 🟠 LUFS, LRA, BPM, Key Detection, Mascaramento Kick-Bass, Sibilância, Transient Strength

**Muito complexas (5 métricas):**
- 🔴 Onset Detection, Chord Analysis, Harmonic Ratio, Coloração Musical

### Bibliotecas recomendadas e impacto

1. **meyda** (~50KB) - Features espectrais básicas → Baixo impacto
2. **essentia.js-wasm** (~15MB) - LUFS profissional → Alto impacto, lazy load
3. **music-tempo** (~30KB) - BPM detection → Médio impacto
4. **@ffmpeg/ffmpeg** (~25MB) - True Peak/decode → Alto impacto, opcional

**Total bundle increase:** ~200KB core, +40MB advanced (lazy loaded)

### Tempo estimado por fase

- **Fase 1** (Infra): 2-3 dias
- **Fase 2** (Features): 3-4 dias  
- **Fase 3** (UI): 2-3 dias
- **Fase 4** (Performance): 2 dias
- **Fase 5** (Advanced): 3-4 dias
- **Fase 6** (QA): 1-2 dias

**Total: 13-18 dias** (2-3 sprints)

### Principais riscos e mitigação

**Risco 1: Performance degradation**
- Mitigação: Web Workers, feature flags, lazy loading

**Risco 2: Bundle size explosion**
- Mitigação: Progressive loading, service worker cache

**Risco 3: Quebrar integração existente**
- Mitigação: Dual rendering, IDs compatibility layer

**Risco 4: Complexidade excessiva**  
- Mitigação: Phased rollout, graceful fallbacks

### Confirmação do visual escopado

✅ **Confirmado:** Novo visual será 100% escopado sob `.audio-analyzer-modal`

✅ **Zero impacto:** Nenhuma alteração em `index.html` fora do modal

✅ **Backwards compatible:** IDs antigos mantidos funcionando

✅ **Toggle disponível:** Usuário pode alternar entre visual antigo/novo

✅ **Mobile-first:** Design responsivo desde o início

---

**🎵 Auditoria completa concluída. Sistema atual bem estruturado e preparado para upgrade seguro.**

**Próximo passo:** Aguardando sua confirmação para iniciar Fase 2 (implementação com PR).
