import { useState, useRef, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { runVoicePipeline, playAudioBase64, LLMAction } from '@/lib/voicePipeline';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';

const SUPPORTED_RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

const MIN_AUDIO_BYTES = 1024;

function getPreferredRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return SUPPORTED_RECORDING_MIME_TYPES.find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType)
  );
}

export default function MicButton() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { addTask, addAppointment, addInboxItem } = useAppStore();

  const executeAction = useCallback(
    (action: LLMAction) => {
      const today = new Date().toISOString().split('T')[0];
      switch (action.acao) {
        case 'criar_tarefa':
          addTask({
            title: action.titulo,
            priority: action.prioridade,
            category: action.categoria,
            dueDate: action.data || today,
          });
          break;
        case 'criar_compromisso':
          addAppointment({
            title: action.titulo,
            date: action.data || today,
            time: action.hora || '09:00',
            duration: 60,
          });
          break;
        case 'inbox':
          addInboxItem(action.titulo);
          break;
        default:
          break;
      }
    },
    [addTask, addAppointment, addInboxItem]
  );

  const startRecording = async () => {
    if (recording || processing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getPreferredRecordingMimeType();
      const mr = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || mr.mimeType || preferredMimeType || 'audio/webm',
        });

        if (blob.size < MIN_AUDIO_BYTES) {
          toast.error('Áudio muito curto. Segure o botão e fale antes de soltar.');
          return;
        }

        setProcessing(true);
        try {
          const result = await runVoicePipeline(blob);
          toast.info(`Transcrito: "${result.transcript}"`);
          executeAction(result.action);
          toast.success(result.confirmacao);
          if (result.audio) {
            playAudioBase64(result.audio);
          }
        } catch (err: any) {
          toast.error(err.message || 'Erro no pipeline de voz');
        } finally {
          setProcessing(false);
        }
      };
      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (!mediaRef.current || mediaRef.current.state !== 'recording') return;

    mediaRef.current.stop();
    setRecording(false);
  };

  return (
    <button
      onPointerDown={startRecording}
      onPointerUp={stopRecording}
      onPointerLeave={stopRecording}
      disabled={processing}
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
        recording
          ? 'bg-destructive animate-pulse-recording'
          : processing
            ? 'bg-muted cursor-wait'
            : 'bg-primary hover:bg-primary/90'
      }`}
      aria-label="Gravar comando de voz"
    >
      <Mic size={22} className={recording ? 'text-destructive-foreground' : 'text-primary-foreground'} />
    </button>
  );
}
