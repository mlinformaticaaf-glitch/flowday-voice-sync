import { supabase } from '@/integrations/supabase/client';

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
  transcript: string;
  action: LLMAction;
  confirmacao: string;
  audio: string; // base64 MP3
}

export async function runVoicePipeline(audioBlob: Blob): Promise<PipelineResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  const { data, error } = await supabase.functions.invoke('voice-pipeline', {
    body: formData,
  });

  if (error) throw new Error(error.message || 'Erro na pipeline de voz');
  if (data?.error) throw new Error(data.error);
  return data as PipelineResult;
}

export function playAudioBase64(base64Mp3: string): void {
  const binary = atob(base64Mp3);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const audioCtx = new AudioContext();
  audioCtx.decodeAudioData(bytes.buffer).then((buffer) => {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  });
}
