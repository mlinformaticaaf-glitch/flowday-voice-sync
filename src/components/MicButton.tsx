import { useState, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
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
const MIN_RECORDING_MS = 900;

function getPreferredRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return SUPPORTED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export default function MicButton() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pointerDownRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  const { addTask, addAppointment, addInboxItem } = useAppStore();

  const executeAction = useCallback(
    async (action: LLMAction) => {
      const today = new Date().toISOString().split('T')[0];
      switch (action.acao) {
        case 'criar_tarefa':
          await addTask({
            title: action.titulo,
            priority: action.prioridade,
            category: action.categoria,
            kind: 'task',
            recurrence: action.recorrencia,
            dueDate: action.data || today,
            source: 'voice',
          });
          break;
        case 'criar_habito':
          await addTask({
            title: action.titulo,
            priority: action.prioridade,
            category: action.categoria,
            kind: 'habit',
            recurrence: action.recorrencia === 'none' ? 'daily' : action.recorrencia,
            dueDate: action.data || today,
            source: 'voice',
          });
          break;
        case 'criar_compromisso':
          await addAppointment({
            title: action.titulo,
            date: action.data || today,
            time: action.hora || '09:00',
            duration: 60,
            recurrence: action.recorrencia,
            source: 'voice',
          });
          break;
        case 'inbox':
          await addInboxItem(action.titulo, 'voice');
          break;
        default:
          break;
      }
    },
    [addTask, addAppointment, addInboxItem]
  );

  const startRecording = async (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (recording || processing) return;

    pointerDownRef.current = true;
    discardRecordingRef.current = false;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // noop
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!pointerDownRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const preferredMimeType = getPreferredRecordingMimeType();
      const mr = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (evt) => {
        if (evt.data.size > 0) {
          chunksRef.current.push(evt.data);
        }
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRef.current = null;
        setRecording(false);

        const recordedMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
        recordingStartedAtRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || mr.mimeType || preferredMimeType || 'audio/webm',
        });

        if (discardRecordingRef.current || recordedMs < MIN_RECORDING_MS || blob.size < MIN_AUDIO_BYTES) {
          discardRecordingRef.current = false;
          toast.error('Segure o botão por mais tempo e fale antes de soltar.');
          return;
        }

        discardRecordingRef.current = false;
        setProcessing(true);
        try {
          const result = await runVoicePipeline(blob);
          toast.info(`Transcrito: "${result.transcript}"`);
          await executeAction(result.action);
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
      recordingStartedAtRef.current = Date.now();
      setRecording(true);
    } catch {
      pointerDownRef.current = false;
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = false;

    if (event) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // noop
      }
    }

    if (!mediaRef.current || mediaRef.current.state !== 'recording') return;

    const startedAt = recordingStartedAtRef.current;
    discardRecordingRef.current = !startedAt || Date.now() - startedAt < MIN_RECORDING_MS;
    mediaRef.current.stop();
  };

  return (
    <button
      onPointerDown={startRecording}
      onPointerUp={stopRecording}
      onPointerCancel={stopRecording}
      disabled={processing}
      className={`fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
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
