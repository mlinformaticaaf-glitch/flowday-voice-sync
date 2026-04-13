import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { runVoicePipeline, playAudioBase64, LLMAction } from '@/lib/voicePipeline';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';
import type { Category } from '@/lib/appTypes';
import ATLASVoiceModal from './ATLASVoiceModal';

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

export type AtlasState = 'idle' | 'listening' | 'processing' | 'speaking';

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
  const [atlasState, setAtlasState] = useState<AtlasState>('idle');
  const [modalOpen, setModalOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
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
    [addTask, addAppointment, addInboxItem],
  );

  const cleanupMicAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    setAnalyserNode(null);
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== 'recording') return;
    const startedAt = recordingStartedAtRef.current;
    const tooShort = !startedAt || Date.now() - startedAt < MIN_RECORDING_MS;
    if (tooShort) {
      mediaRef.current.stop();
      cleanupMicAudio();
      toast.error('Segure o botão por mais tempo e fale antes de soltar.');
      return;
    }
    mediaRef.current.stop();
    cleanupMicAudio();
  }, [cleanupMicAudio]);

  const startRecording = async () => {
    // Segundo clique para qualquer estado ativo: cancela
    if (atlasState !== 'idle') {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Web Audio API — analyser do microfone
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      // NÃO conectar ao destination — evita eco

      audioCtxRef.current = audioCtx;
      micAnalyserRef.current = analyser;
      setAnalyserNode(analyser);

      // VAD — detecção de silêncio automático
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;

      const checkSilence = () => {
        analyser.getByteFrequencyData(dataArray);
        const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length);
        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart >= SILENCE_DURATION_MS) {
            stopRecording();
            return;
          }
        } else {
          silenceStart = null;
        }
        animFrameRef.current = requestAnimationFrame(checkSilence);
      };
      animFrameRef.current = requestAnimationFrame(checkSilence);

      // MediaRecorder
      const preferredMimeType = getPreferredRecordingMimeType();
      const mr = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (evt) => {
        if (evt.data.size > 0) chunksRef.current.push(evt.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;

        const recordedMs = recordingStartedAtRef.current
          ? Date.now() - recordingStartedAtRef.current
          : 0;
        recordingStartedAtRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || mr.mimeType || preferredMimeType || 'audio/webm',
        });

        if (recordedMs < MIN_RECORDING_MS || blob.size < MIN_AUDIO_BYTES) {
          if (mountedRef.current) {
            setAtlasState('idle');
            setModalOpen(false);
          }
          return;
        }

        if (mountedRef.current) {
          setAtlasState('processing');
          setAnalyserNode(null); // sem ondas durante processing
        }

        try {
          const result = await runVoicePipeline(blob);
          if (mountedRef.current) setTranscript(result.transcript);

          const acoes = result.acoes?.length
            ? result.acoes
            : result.action
              ? [result.action]
              : [];
          await executeActions(acoes);

          if (result.audio) {
            if (mountedRef.current) setAtlasState('speaking');
            playAudioBase64(
              result.audio,
              (ttsAnalyser) => {
                if (mountedRef.current) setAnalyserNode(ttsAnalyser);
              },
              () => {
                if (mountedRef.current) {
                  setAtlasState('idle');
                  setModalOpen(false);
                  setAnalyserNode(null);
                  setTranscript('');
                }
              },
            );
          } else {
            toast.success(result.confirmacao);
            if (mountedRef.current) {
              setAtlasState('idle');
              setModalOpen(false);
              setTranscript('');
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erro no pipeline de voz';
          toast.error(msg);
          if (mountedRef.current) {
            setAtlasState('idle');
            setModalOpen(false);
            setTranscript('');
            setAnalyserNode(null);
          }
        }
      };

      mr.start(250);
      mediaRef.current = mr;
      recordingStartedAtRef.current = Date.now();
      setAtlasState('listening');
      setModalOpen(true);
      setTranscript('');
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const handleModalClose = () => {
    stopRecording();
    setAtlasState('idle');
    setModalOpen(false);
    setTranscript('');
    setAnalyserNode(null);
    cleanupMicAudio();
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (mediaRef.current && mediaRef.current.state === 'recording') {
        mediaRef.current.stop();
      }
      cleanupMicAudio();
    };
  }, [cleanupMicAudio]);

  return (
    <>
      <ATLASVoiceModal
        open={modalOpen}
        state={atlasState}
        transcript={transcript}
        analyserNode={analyserNode}
        onClose={handleModalClose}
      />
      <button
        onClick={startRecording}
        disabled={atlasState === 'processing'}
        className={`fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-50 w-14 h-14
          rounded-full flex items-center justify-center shadow-lg transition-all ${
            atlasState === 'listening'
              ? 'bg-destructive animate-pulse'
              : atlasState === 'processing'
                ? 'bg-muted cursor-wait'
                : 'bg-primary hover:bg-primary/90'
          }`}
        aria-label={atlasState === 'listening' ? 'Parar gravação' : 'Gravar comando de voz'}
      >
        {atlasState === 'listening' ? (
          <MicOff size={22} className="text-destructive-foreground" />
        ) : (
          <Mic size={22} className="text-primary-foreground" />
        )}
      </button>
    </>
  );
}
