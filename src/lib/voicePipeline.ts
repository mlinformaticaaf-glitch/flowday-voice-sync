import { supabase } from '@/integrations/supabase/client';

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'video/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

function getAudioFileName(audioBlob: Blob): string {
  const normalizedMimeType = audioBlob.type.split(';')[0]?.trim().toLowerCase();
  const extension = MIME_TYPE_TO_EXTENSION[normalizedMimeType] ?? 'webm';
  return `audio.${extension}`;
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

export interface PipelineResult {
  ok: true;
  transcript: string;
  action: LLMAction;
  confirmacao: string;
  audio: string | null;
}

interface PipelineErrorResult {
  ok: false;
  error: string;
  code?: string;
  retryable?: boolean;
}

type PipelineResponse = PipelineResult | PipelineErrorResult;

export async function runVoicePipeline(audioBlob: Blob): Promise<PipelineResult> {
  if (audioBlob.size === 0) {
    throw new Error('Áudio vazio. Tente gravar novamente.');
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, getAudioFileName(audioBlob));

  const { data, error } = await supabase.functions.invoke<PipelineResponse>('voice-pipeline', {
    body: formData,
  });

  if (error) throw new Error(error.message || 'Erro na pipeline de voz');
  if (!data) throw new Error('Resposta vazia do pipeline de voz.');
  if ('error' in data) throw new Error(data.error);

  return data;
}

export function playAudioBase64(base64Mp3: string): void {
  const binary = atob(base64Mp3);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const audioCtx = new AudioContext();
  audioCtx
    .decodeAudioData(bytes.buffer)
    .then((buffer) => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    })
    .catch(() => {
      void audioCtx.close();
    });
}
