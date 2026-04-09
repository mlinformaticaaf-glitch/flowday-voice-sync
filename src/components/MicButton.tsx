import { useState, useRef, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { speechToText, processCommand, textToSpeech, LLMAction } from '@/lib/voicePipeline';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setProcessing(true);
        try {
          const text = await speechToText(blob);
          toast.info(`Transcrito: "${text}"`);
          const action = await processCommand(text);
          executeAction(action);
          await textToSpeech(action.confirmacao);
          toast.success(action.confirmacao);
        } catch (err: any) {
          toast.error(err.message || 'Erro no pipeline de voz');
        } finally {
          setProcessing(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
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
