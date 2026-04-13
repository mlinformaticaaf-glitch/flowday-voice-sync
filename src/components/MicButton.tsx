import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { runVoicePipeline, playAudioBase64, LLMAction } from '@/lib/voicePipeline';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';
import type { Category } from '@/lib/appTypes';

const SUPPORTED_RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

const MIN_AUDIO_BYTES = 1024;
const MIN_RECORDING_MS = 900;
const SILENCE_THRESHOLD = 8;
const SILENCE_DURATION_MS = 1800;

function getPreferredRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return SUPPORTED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function normalizeCategory(value: string): Category {
  if (value === 'codigo' || value === 'comunicacao' || value === 'pesquisa' || value === 'geral') {
    return value;
  }

  return 'geral';
}

export default function MicButton() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const autoStopRef = useRef(false);
  const mountedRef = useRef(true);

  const { addTask, addAppointment, addInboxItem } = useAppStore();

  const executeActions = useCallback(
    async (acoes: LLMAction[]) => {
      const today = new Date().toISOString().split('T')[0];
      for (const action of acoes) {
        switch (action.acao) {
          case 'criar_tarefa':
            await addTask({
              title: action.titulo,
              priority: action.prioridade,
              category: normalizeCategory(action.categoria),
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
              category: normalizeCategory(action.categoria),
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
      }
    },
    [addTask, addAppointment, addInboxItem]
  );

  const cleanupAudioResources = useCallback(() => {
    if (vadFrameRef.current !== null) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }

    silenceStartRef.current = null;
    analyserRef.current = null;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== 'recording') return;

    const startedAt = recordingStartedAtRef.current;
    discardRecordingRef.current = !startedAt || Date.now() - startedAt < MIN_RECORDING_MS;
    mediaRef.current.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || processing) return;

    discardRecordingRef.current = false;
    autoStopRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
        cleanupAudioResources();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRef.current = null;
        if (mountedRef.current) {
          setRecording(false);
        }

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
        if (mountedRef.current) {
          setProcessing(true);
        }
        toast.info('Processando...');
        try {
          const result = await runVoicePipeline(blob);
          const acoes = result.acoes?.length ? result.acoes : result.action ? [result.action] : [];
          await executeActions(acoes);
          toast.success(result.confirmacao);
          if (result.audio) {
            playAudioBase64(result.audio);
          }
        } catch (err: any) {
          toast.error(err.message || 'Erro no pipeline de voz');
        } finally {
          if (mountedRef.current) {
            setProcessing(false);
          }
        }
      };

      mr.start(250);
      mediaRef.current = mr;
      recordingStartedAtRef.current = Date.now();
      setRecording(true);

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      silenceStartRef.current = null;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkSilence = () => {
        if (!mediaRef.current || mediaRef.current.state !== 'recording') {
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        const rms = Math.sqrt(dataArray.reduce((sum, value) => sum + value * value, 0) / dataArray.length);

        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
            autoStopRef.current = true;
            stopRecording();
            return;
          }
        } else {
          silenceStartRef.current = null;
        }

        vadFrameRef.current = requestAnimationFrame(checkSilence);
      };

      vadFrameRef.current = requestAnimationFrame(checkSilence);
    } catch {
      cleanupAudioResources();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      toast.error('Não foi possível acessar o microfone');
    }
  }, [cleanupAudioResources, executeActions, processing, recording, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (processing) return;

    if (recording) {
      stopRecording();
      return;
    }

    void startRecording();
  }, [processing, recording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (mediaRef.current && mediaRef.current.state === 'recording') {
        mediaRef.current.stop();
      }

      cleanupAudioResources();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cleanupAudioResources]);

  return (
    <>
      {(recording || processing) && (
        <div className="fixed bottom-40 lg:bottom-20 right-4 lg:right-6 z-50 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground shadow-md">
          {recording ? 'Ouvindo... clique para parar' : 'Processando...'}
        </div>
      )}

      <button
        onClick={toggleRecording}
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
        {processing ? (
          <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
        ) : recording ? (
          <MicOff size={22} className="text-destructive-foreground" />
        ) : (
          <Mic size={22} className="text-primary-foreground" />
        )}
      </button>
    </>
  );
}
