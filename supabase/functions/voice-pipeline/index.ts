import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
    const GOOGLE_TTS_KEY = Deno.env.get("GOOGLE_TTS_API_KEY") || Deno.env.get("GOOGLE_TTS_KEY")

    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY não configurada nos Secrets")
    }
    if (!GOOGLE_TTS_KEY) {
      throw new Error("GOOGLE_TTS_API_KEY não configurada nos Secrets")
    }

    const formData = await req.formData()
    const audioFile = formData.get("audio")

    if (!audioFile || !(audioFile instanceof File)) {
      throw new Error("Campo 'audio' ausente ou inválido no FormData")
    }

    // ── ETAPA 1: STT — Groq Whisper ──────────────────────────────
    const sttForm = new FormData()
    sttForm.append("file", audioFile, "audio.webm")
    sttForm.append("model", "whisper-large-v3")
    sttForm.append("language", "pt")
    sttForm.append("response_format", "json")

    const sttRes = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: sttForm,
      }
    )

    if (!sttRes.ok) {
      const err = await sttRes.text()
      throw new Error(`Groq STT falhou (${sttRes.status}): ${err}`)
    }

    const sttData = await sttRes.json()
    const transcript = sttData.text?.trim()

    if (!transcript) {
      throw new Error("Transcrição vazia — áudio não reconhecido")
    }

    // ── ETAPA 2: LLM — Groq Llama 3.3 70B ───────────────────────
    const systemPrompt = `Você é o FlowDay, assistente de produtividade pessoal. Fale sempre em português do Brasil, tom direto e profissional. Ao receber um comando, retorne SOMENTE JSON válido sem markdown e sem explicações:
{
  "acao": "criar_tarefa" | "criar_compromisso" | "listar_dia" | "listar_tarefas" | "inbox" | "desconhecido",
  "titulo": "texto do item ou null",
  "data": "YYYY-MM-DD ou null",
  "hora": "HH:MM ou null",
  "prioridade": "alta" | "media" | "baixa",
  "categoria": "codigo" | "comunicacao" | "pesquisa" | "geral",
  "confirmacao": "frase curta no passado confirmando a ação com os detalhes relevantes"
}`

    const llmRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 300,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: transcript },
          ],
        }),
      }
    )

    if (!llmRes.ok) {
      const err = await llmRes.text()
      throw new Error(`Groq LLM falhou (${llmRes.status}): ${err}`)
    }

    const llmData = await llmRes.json()
    const raw = llmData.choices?.[0]?.message?.content ?? ""

    let parsed
    try {
      const clean = raw.replace(/```json|```/g, "").trim()
      parsed = JSON.parse(clean)
    } catch {
      throw new Error(`LLM retornou JSON inválido: ${raw}`)
    }

    const confirmacao = parsed.confirmacao ?? "Ação registrada."

    // ── ETAPA 3: TTS — Google Cloud WaveNet ──────────────────────
    const ttsRes = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: confirmacao },
          voice: {
            languageCode: "pt-BR",
            name: "pt-BR-Wavenet-B",
            ssmlGender: "MALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: -2.0,
          },
        }),
      }
    )

    if (!ttsRes.ok) {
      const err = await ttsRes.text()
      throw new Error(`Google TTS falhou (${ttsRes.status}): ${err}`)
    }

    const ttsData = await ttsRes.json()
    const audioContent = ttsData.audioContent

    if (!audioContent) {
      throw new Error("Google TTS não retornou áudio")
    }

    return new Response(
      JSON.stringify({
        transcript,
        action: parsed,
        confirmacao,
        audio: audioContent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Voice pipeline error:", error)
    return new Response(
      JSON.stringify({ error: error.message ?? "Erro interno desconhecido" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
