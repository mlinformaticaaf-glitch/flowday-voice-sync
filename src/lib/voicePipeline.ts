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

async function callPipeline(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('voice-pipeline', { body });
  if (error) throw new Error(error.message || 'Edge function error');
  return data;
}

export async function speechToText(audioBlob: Blob): Promise<string> {
  const buffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const audioBase64 = btoa(binary);

  const data = await callPipeline({ action: 'stt', audioBase64 });
  return data.text;
}

export async function processCommand(text: string): Promise<LLMAction> {
  const data = await callPipeline({ action: 'process', text });
  return data.result;
}

export async function textToSpeech(text: string): Promise<void> {
  const data = await callPipeline({ action: 'tts', text });
  if (!data.audio) return;

  const binary = atob(data.audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
}
