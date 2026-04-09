const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_KEY = Deno.env.get('GROQ_API_KEY')!;
const TTS_KEY = Deno.env.get('GOOGLE_TTS_API_KEY');

const SYSTEM_PROMPT = `Você é o FlowDay, um assistente de produtividade. Fale sempre em português do Brasil, tom direto e profissional. Ao receber um comando, retorne SOMENTE JSON válido sem markdown: {acao: 'criar_tarefa'|'criar_compromisso'|'listar_dia'|'listar_tarefas'|'inbox'|'desconhecido', titulo: string, data: 'YYYY-MM-DD'|null, hora: 'HH:MM'|null, prioridade: 'alta'|'media'|'baixa', categoria: 'codigo'|'comunicacao'|'pesquisa'|'geral', confirmacao: 'frase curta no passado confirmando a ação executada com os detalhes relevantes'}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, audioBase64, text } = await req.json();

    if (action === 'stt') {
      if (!GROQ_KEY) throw new Error('GROQ_API_KEY not configured');
      // Decode base64 audio
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/webm' });

      const form = new FormData();
      form.append('file', blob, 'audio.webm');
      form.append('model', 'whisper-large-v3');
      form.append('language', 'pt');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: form,
      });
      if (!res.ok) throw new Error(`STT failed: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify({ text: data.text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'process') {
      if (!GROQ_KEY) throw new Error('GROQ_API_KEY not configured');
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
      if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
      const data = await res.json();
      const content = data.choices[0].message.content;
      return new Response(JSON.stringify({ result: JSON.parse(content) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'tts') {
      if (!TTS_KEY) {
        return new Response(JSON.stringify({ audio: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify({ audio: data.audioContent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
