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

function toTitleCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}


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
    const textPrompt = formData.get("text")

    const googleEvents = formData.get("google_events") ?? "[]"
    const googleTasks  = formData.get("google_tasks")  ?? "[]"
    const flowdayInbox = formData.get("flowday_inbox") ?? "[]"
    const habitosHoje  = formData.get("habitos_hoje")  ?? "[]"
    let history = []
    try {
      history = JSON.parse(String(formData.get("history") ?? "[]"))
    } catch {
      history = []
    }

    let transcript = ""

    if (audioFile && audioFile instanceof File && audioFile.size >= MIN_AUDIO_BYTES) {
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
      transcript = sttData.text?.trim()
    } else if (textPrompt) {
      transcript = String(textPrompt).trim()
    } else {
      if (audioFile && audioFile instanceof File && audioFile.size < MIN_AUDIO_BYTES) {
        return jsonResponse({
          ok: false,
          code: "audio_too_short",
          retryable: true,
          error: "Segure o botão por mais tempo e fale antes de soltar.",
        })
      }
      throw new Error("Áudio ausente/inválido e nenhum comando de texto fornecido")
    }

    if (!transcript) {
      throw new Error("Comando vazio — não reconhecido")
    }

    const hoje = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Sao_Paulo",
    })

    const systemPrompt = `Você é o ATLAS, assistente de voz do FlowDay.
Hoje é ${hoje}. Fale sempre em português do Brasil.

Ao receber um comando, retorne SOMENTE um JSON válido sem markdown:
{ "acoes": [ <uma ou mais ações> ], "confirmacao": "frase confirmando tudo" }

Cada ação dentro do array "acoes" segue este schema:
{
  "acao": "criar_tarefa" | "criar_habito" | "criar_compromisso" | "inbox" | "consultar_agenda" | "listar_tarefas" | "resumo_do_dia" | "marcar_concluido" | "reagendar" | "deletar_item",
  "titulo": "string obrigatório",
  "data": "YYYY-MM-DD ou null",
  "hora": "HH:MM ou null",
  "prioridade": "alta" | "media" | "baixa",
  "categoria": "codigo" | "comunicacao" | "pesquisa" | "geral",
  "recorrencia": "none" | "daily" | "weekly" | "monthly",
  "ref_titulo": "nome do item referenciado",
  "nova_data": "YYYY-MM-DD ou null para reagendar",
  "nova_hora": "HH:MM ou null para reagendar",
  "modulo": "tarefa" | "habito" | "inbox" | "compromisso"
}

CONTEXTO ATUAL DO USUÁRIO:
- Próximos eventos (Google Agenda): ${googleEvents}
- Tarefas pendentes (Google Tasks): ${googleTasks}
- Inbox FlowDay: ${flowdayInbox}
- Hábitos de hoje: ${habitosHoje}

Use essas informações para:
1. Responder perguntas sobre a agenda sem inventar dados
2. Evitar criar duplicatas de tarefas/eventos que já existem
3. Referenciar itens existentes pelo nome ao confirmar ações

REGRAS DE INTERPRETAÇÃO:

1. SEMPRE use array, mesmo para um único item.
   Exemplo: "adicionar tarefa reunião" →
   { "acoes": [{ "acao": "criar_tarefa", "titulo": "Reunião", ... }],
     "confirmacao": "Tarefa Reunião criada." }

2. LISTAS: quando o usuário listar vários itens, crie uma ação para cada.
   Exemplo: "inbox: ligar pro João, enviar relatório, revisar contrato" →
   { "acoes": [
       { "acao": "inbox", "titulo": "Ligar pro João", ... },
       { "acao": "inbox", "titulo": "Enviar relatório", ... },
       { "acao": "inbox", "titulo": "Revisar contrato", ... }
     ],
     "confirmacao": "3 itens adicionados ao inbox." }

3. COMANDOS COMPOSTOS: um comando pode criar itens em módulos diferentes.
   Exemplo: "tarefa reunião amanhã às 14h e hábito meditar todo dia" →
   { "acoes": [
       { "acao": "criar_compromisso", "titulo": "Reunião",
         "data": "YYYY-MM-DD", "hora": "14:00", ... },
       { "acao": "criar_habito", "titulo": "Meditar",
         "recorrencia": "daily", ... }
     ],
     "confirmacao": "Compromisso Reunião e hábito Meditar criados." }

4. DATAS RELATIVAS: interprete corretamente.
   "hoje" → data atual, "amanhã" → +1 dia, "semana que vem" → próxima
   segunda-feira, "todo dia" → recorrencia: daily,
   "toda semana" → recorrencia: weekly

5. MÓDULOS disponíveis:
   - criar_tarefa: tarefas únicas com ou sem data/prazo
   - criar_habito: rotinas recorrentes (recorrencia nunca é "none")
   - criar_compromisso: eventos com data e hora (hora é obrigatória)
   - inbox: captura rápida sem estrutura, processamento posterior

6. PRIORIDADE: inferir pelo contexto.
   "urgente", "importante", "crítico" → alta
   "quando puder", "sem pressa" → baixa
   padrão → media

7. Se não entender o comando, retorne:
   { "acoes": [], "confirmacao": "Não entendi o comando. Pode repetir?" }

8. CONSULTAS: quando o usuário perguntar sobre agenda, tarefas ou dia, use os dados
   do CONTEXTO ATUAL para responder com precisão. A "confirmacao" deve conter a resposta diretamente (não apenas "ok, consultei").

9. RESUMO DO DIA: quando o usuário pedir "o que tenho hoje", "meu dia", "resumo",
   retorne acao: "resumo_do_dia" e na "confirmacao" inclua:
   - Horário e nome dos compromissos do dia
   - Quantidade de tarefas pendentes e as de alta prioridade
   - Hábitos pendentes para hoje
   Exemplo de confirmacao: "Bom dia! Hoje você tem: reunião às 14h com o time, 3 tarefas pendentes sendo 1 urgente (Relatório Q2), e 2 hábitos para fazer (Meditação e Exercício)."

10. INBOX MÚLTIPLO: quando o usuário listar itens separados por vírgula, "e",
    ponto e vírgula ou pausa natural, SEMPRE crie uma ação inbox separada para
    cada item. Nunca agrupe múltiplos itens em um único titulo.`

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
          max_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            ...(Array.isArray(history) ? history : []),
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

    let parsed: any
    try {
      const clean = raw.replace(/```json|```/g, "").trim()
      parsed = JSON.parse(clean)
    } catch {
      throw new Error(`LLM retornou JSON inválido: ${raw}`)
    }

    // Suporte a array (novo) e objeto único (retrocompatibilidade)
    const rawAcoes = Array.isArray(parsed.acoes)
      ? parsed.acoes
      : parsed.acao
        ? [parsed] // formato antigo — envolve em array
        : []

    const validAcoes = rawAcoes.filter((a: unknown) => Boolean(a) && typeof a === "object") as Array<Record<string, unknown>>

    const acoes = validAcoes.map((a: any) => ({
      acao: a.acao ?? "desconhecido",
      titulo: a.titulo ?? transcript,
      data: a.data ?? null,
      hora: a.hora ?? null,
      prioridade: a.prioridade ?? "media",
      categoria: a.categoria ?? "geral",
      recorrencia: a.recorrencia ?? "none",
      ref_titulo: a.ref_titulo ?? null,
      nova_data: a.nova_data ?? null,
      nova_hora: a.nova_hora ?? null,
      modulo: a.modulo ?? null,
    }))

    const confirmacao = parsed.confirmacao ?? "Ação registrada."
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
      acoes,
      action: acoes[0] ?? null,
      confirmacao,
      audio: audioContent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno desconhecido"
    console.error("Voice pipeline error:", error)
    return jsonResponse(getFriendlyError(message))
  }
})
