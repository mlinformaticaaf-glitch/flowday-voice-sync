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
  acao: 'criar_tarefa' | 'criar_habito' | 'criar_compromisso' | 'inbox' | 'desconhecido';
  titulo: string;
  data: string | null;
  hora: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  categoria: string;
  recorrencia: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface VoicePipelineResult {
  ok: true;
  transcript: string;
  acoes: LLMAction[];
  action: LLMAction | null;
  confirmacao: string;
  audio: string | null;
}

export type PipelineResult = VoicePipelineResult;

interface PipelineErrorResult {
  ok: false;
  error: string;
  code?: string;
  retryable?: boolean;
}

type PipelineResponse = VoicePipelineResult | PipelineErrorResult;

export async function runVoicePipeline(audioBlob: Blob): Promise<VoicePipelineResult> {
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

/**
 * Reproduz áudio base64 e expõe o AnalyserNode via onAnalyser
 * para que o modal visualize as frequências em tempo real.
 * Chama onEnded quando a reprodução terminar.
 */
export function playAudioBase64(
  base64Mp3: string,
  onAnalyser?: (analyser: AnalyserNode) => void,
  onEnded?: () => void,
): void {
  const binary = atob(base64Mp3);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const audioCtx = new AudioContext();

  audioCtx
    .decodeAudioData(bytes.buffer)
    .then((buffer) => {
      const source = audioCtx.createBufferSource();

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      if (onAnalyser) onAnalyser(analyser);

      source.onended = () => {
        void audioCtx.close();
        if (onEnded) onEnded();
      };

      source.start();
    })
    .catch(() => {
      void audioCtx.close();
      if (onEnded) onEnded?.();
    });
}
