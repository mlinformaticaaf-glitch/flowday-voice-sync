// @ts-ignore - Remote Deno URL imports are resolved at runtime by Supabase Edge.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: {
  env: {
    get: (name: string) => string | undefined
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const MIN_AUDIO_BYTES = 1024

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function getAudioExtension(mimeType?: string | null) {
  const normalized = mimeType?.split(";")[0].trim().toLowerCase()

  switch (normalized) {
    case "audio/mp4":
    case "video/mp4":
      return "m4a"
    case "audio/mpeg":
      return "mp3"
    case "audio/wav":
    case "audio/x-wav":
      return "wav"
    case "audio/ogg":
      return "ogg"
    default:
      return "webm"
  }
}

function getAudioFilename(file: File) {
  if (file.name && file.name.includes(".")) {
    return file.name
  }

  return `audio.${getAudioExtension(file.type)}`
}

function getFriendlyError(message: string) {
  if (message.includes("Audio file is too short") || message.includes("Áudio muito curto")) {
    return {
      ok: false as const,
      code: "audio_too_short",
      retryable: true,
      error: "Segure o botão por mais tempo e fale antes de soltar.",
    }
  }

  if (message.includes("could not process file")) {
    return {
      ok: false as const,
      code: "invalid_audio",
      retryable: true,
      error: "Não consegui processar esse áudio. Tente novamente falando por mais tempo.",
    }
  }

  if (message.includes("Transcrição vazia")) {
    return {
      ok: false as const,
      code: "empty_transcript",
      retryable: true,
      error: "Não consegui transcrever sua fala. Tente novamente em um lugar mais silencioso.",
    }
  }

  return {
    ok: false as const,
    code: "pipeline_failed",
    retryable: false,
    error: message || "Erro interno desconhecido",
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
    const GOOGLE_TTS_KEY = Deno.env.get("GOOGLE_TTS_API_KEY") || Deno.env.get("GOOGLE_TTS_KEY")

    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY não configurada nos Secrets")
    }

    const formData = await req.formData()
    const audioFile = formData.get("audio")

    if (!audioFile || !(audioFile instanceof File)) {
      throw new Error("Campo 'audio' ausente ou inválido no FormData")
    }

    if (audioFile.size < MIN_AUDIO_BYTES) {
      return jsonResponse({
        ok: false,
        code: "audio_too_short",
        retryable: true,
        error: "Segure o botão por mais tempo e fale antes de soltar.",
      })
    }

    const sttForm = new FormData()
    sttForm.append("file", audioFile, getAudioFilename(audioFile))
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

    const systemPrompt = `Você é o FlowDay, assistente de produtividade pessoal. Fale sempre em português do Brasil, tom direto e profissional. Ao receber um comando, retorne SOMENTE JSON válido sem markdown e sem explicações:
{
  "acao": "criar_tarefa" | "criar_habito" | "criar_compromisso" | "listar_dia" | "listar_tarefas" | "inbox" | "desconhecido",
  "titulo": "texto do item ou null",
  "data": "YYYY-MM-DD ou null",
  "hora": "HH:MM ou null",
  "prioridade": "alta" | "media" | "baixa",
  "categoria": "codigo" | "comunicacao" | "pesquisa" | "geral",
  "recorrencia": "none" | "daily" | "weekly" | "monthly",
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

    const normalizedAction = {
      acao: parsed.acao ?? "desconhecido",
      titulo: parsed.titulo ?? transcript,
      data: parsed.data ?? null,
      hora: parsed.hora ?? null,
      prioridade: parsed.prioridade ?? "media",
      categoria: parsed.categoria ?? "geral",
      recorrencia: parsed.recorrencia ?? "none",
      confirmacao: parsed.confirmacao ?? "Ação registrada.",
    }

    const confirmacao = normalizedAction.confirmacao
    let audioContent: string | null = null

    if (GOOGLE_TTS_KEY) {
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

      if (ttsRes.ok) {
        const ttsData = await ttsRes.json()
        audioContent = ttsData.audioContent ?? null
      } else {
        console.error(`Google TTS falhou (${ttsRes.status}): ${await ttsRes.text()}`)
      }
    }

    return jsonResponse({
      ok: true,
      transcript,
      action: normalizedAction,
      confirmacao,
      audio: audioContent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno desconhecido"
    console.error("Voice pipeline error:", error)
    return jsonResponse(getFriendlyError(message))
  }
})
