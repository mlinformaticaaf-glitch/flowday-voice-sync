import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { runTextPipeline, LLMAction } from '@/lib/voicePipeline';
import { toast } from 'sonner';

export function useInboxAI() {
  const { inbox } = useAppStore();
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<LLMAction[] | null>(null);

  const processInboxWithAI = async () => {
    if (inbox.length === 0) {
      toast.info('Inbox não possui itens para processar.');
      return;
    }

    setIsProcessingAI(true);
    try {
      const itemsText = inbox.map((i) => i.text).join('; ');
      const prompt = `Analise detalhadamente os seguintes itens e crie as ações apropriadas (tarefas, compromissos, hábitos). Itens: ${itemsText}`;
      
      const result = await runTextPipeline(prompt);
      
      if (result.acoes && result.acoes.length > 0) {
        setAiSuggestions(result.acoes);
        toast.success(`IA sugeriu ${result.acoes.length} ações.`);
      } else {
        toast.info('IA não retornou sugestões claras.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao processar com IA.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const clearSuggestions = () => {
    setAiSuggestions(null);
  };

  return {
    isProcessingAI,
    aiSuggestions,
    processInboxWithAI,
    clearSuggestions,
  };
}
