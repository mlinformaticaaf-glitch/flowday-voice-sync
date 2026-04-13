# FlowDay Voice Sync

## Configuracao da `voice-pipeline` no Supabase

Esta aplicacao usa uma Edge Function chamada `voice-pipeline` para:

1. Transcrever audio com Groq (Whisper)
2. Interpretar o comando com LLM
3. (Opcional) Gerar audio de confirmacao com Google TTS

### 1) Variaveis do frontend

No arquivo `.env` (baseado no `.env.example` da raiz), configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_AUTH_REDIRECT_URL`

### 2) Secrets da Edge Function

No Supabase, configure os secrets usados pela funcao:

```bash
supabase secrets set GROQ_API_KEY=seu_token_groq
supabase secrets set GOOGLE_TTS_API_KEY=sua_chave_google_tts
```

Observacoes:

- `GOOGLE_TTS_API_KEY` e opcional. Sem ela, a funcao continua funcionando, apenas sem audio de confirmacao.
- A funcao tambem aceita `GOOGLE_TTS_KEY` como fallback.

### 3) Rodar localmente a Edge Function

Crie um arquivo de ambiente local para funcoes:

`supabase/functions/.env`

Conteudo minimo:

```env
GROQ_API_KEY=seu_token_groq
GOOGLE_TTS_API_KEY=sua_chave_google_tts
```

Suba os servicos locais e rode a funcao:

```bash
supabase start
supabase functions serve voice-pipeline --env-file supabase/functions/.env
```

### 4) Deploy da Edge Function

```bash
supabase functions deploy voice-pipeline
```

### 5) Teste rapido

Com app autenticada, a chamada e feita via `supabase.functions.invoke('voice-pipeline')` enviando `FormData` com o campo `audio`.

Se quiser testar por CLI, envie um `multipart/form-data` para o endpoint da funcao com um arquivo de audio maior que 1KB.
