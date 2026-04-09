const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const TTS_KEY = import.meta.env.VITE_GOOGLE_TTS_KEY as string | undefined;

export async function speechToText(audioBlob: Blob): Promise<string> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY não configurada');
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-large-v3');
  form.append('language', 'pt');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`STT falhou: ${res.status}`);
  const data = await res.json();
  return data.text;
}

export interface LLMAction {
  acao: 'criar_tarefa' | 'criar_compromisso' | 'listar_dia' | 'listar_tarefas' | 'inbox' | 'desconhecido';
  titulo: string;
  data: string | null;
  hora: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  categoria: 'codigo' | 'comunicacao' | 'pesquisa' | 'geral';
  confirmacao: string;
}

const SYSTEM_PROMPT = `Você é o FlowDay, um assistente de produtividade. Fale sempre em português do Brasil, tom direto e profissional. Ao receber um comando, retorne SOMENTE JSON válido sem markdown: {acao: 'criar_tarefa'|'criar_compromisso'|'listar_dia'|'listar_tarefas'|'inbox'|'desconhecido', titulo: string, data: 'YYYY-MM-DD'|null, hora: 'HH:MM'|null, prioridade: 'alta'|'media'|'baixa', categoria: 'codigo'|'comunicacao'|'pesquisa'|'geral', confirmacao: 'frase curta no passado confirmando a ação executada com os detalhes relevantes'}`;

export async function processCommand(text: string): Promise<LLMAction> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY não configurada');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`LLM falhou: ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

export async function textToSpeech(text: string): Promise<void> {
  if (!TTS_KEY) {
    console.warn('VITE_GOOGLE_TTS_KEY não configurada, pulando TTS');
    return;
  }
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', ssmlGender: 'MALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: -2.0 },
    }),
  });
  if (!res.ok) throw new Error(`TTS falhou: ${res.status}`);
  const data = await res.json();
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ctx = new AudioContext();
  const buffer = await ctx.decodeAudioData(bytes.buffer);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}
