import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Calendar, BarChart, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id || !id) return;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) {
        toast.error('Erro ao carregar projeto.');
      } else {
        setProject(data);
        // Note: checking for 'notas' field dynamically based on our migration
        setNotes((data as any).notas || '');
      }
      setLoading(false);
    })();
  }, [id, user?.id]);

  const handleSaveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from('projects').update({ notas: notes }).eq('id', id);
    if (error) {
      toast.error('Erro ao salvar anotações.');
    } else {
      toast.success('Anotações salvas.');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-4 text-muted-foreground text-sm text-center py-10">Carregando detalhes...</div>;
  if (!project) return <div className="p-4 text-muted-foreground text-sm text-center py-10">Projeto não encontrado.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/projetos')} className="p-2.5 bg-card border border-border/60 rounded-xl hover:text-cyan-400 hover:border-cyan-500/30 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{project.description || 'Sem descrição definida'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <BarChart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Progresso</p>
            <p className="text-lg font-bold text-foreground">{project.progress}% concluído</p>
          </div>
        </div>
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Status</p>
            <p className="text-lg font-bold text-foreground capitalize">{project.status.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Prazo</p>
            <p className="text-lg font-bold text-foreground">{project.due_date ? new Date(project.due_date).toLocaleDateString() : 'Nenhum'}</p>
          </div>
        </div>
      </div>

      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div>
            <h2 className="text-base font-semibold text-foreground">Anotações e Materiais</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Visão geral do projeto, links úteis e referências rápidas.</p>
          </div>
          <button 
            onClick={handleSaveNotes} 
            disabled={saving}
            className="flex items-center gap-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm shadow-cyan-500/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar notas'}
          </button>
        </div>
        
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Escreva anotações, links, ou recursos deste projeto..."
          className="w-full min-h-[400px] bg-secondary/20 border border-border/30 rounded-xl px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:bg-secondary/40 transition-all resize-y leading-relaxed"
        />
      </div>
    </div>
  );
}
