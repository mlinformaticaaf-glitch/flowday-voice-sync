import { useEffect, useMemo, useState } from 'react';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import ProjectCard from '@/components/ProjectCard';

type ProjectRow = Tables<'projects'>;

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setProjects([]);
      setLoading(false);
      return;
    }

    let active = true;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!active) return;

      if (error) {
        console.error('Failed to load projects', error);
        toast.error('Não foi possível carregar os projetos.');
        setLoading(false);
        return;
      }

      setProjects(data ?? []);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const summary = useMemo(() => ({
    active: projects.filter((project) => project.status === 'em_andamento').length,
    done: projects.filter((project) => project.status === 'concluido').length,
  }), [projects]);

  const handleCreateProject = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      toast.error('Informe o nome do projeto.');
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      toast.error(error?.message || 'Não foi possível criar o projeto.');
      return;
    }

    setProjects((current) => [data, ...current]);
    setName('');
    setDescription('');
    setDueDate('');
    setShowForm(false);
    toast.success('Projeto criado.');
  };

  const updateProject = async (projectId: string, updates: Partial<ProjectRow>) => {
    const { data, error } = await supabase.from('projects').update(updates).eq('id', projectId).select('*').single();
    if (error || !data) {
      toast.error(error?.message || 'Não foi possível atualizar o projeto.');
      return;
    }

    setProjects((current) => current.map((project) => (project.id === projectId ? data : project)));
  };

  const handleDeleteProject = async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast.error(error.message || 'Não foi possível remover o projeto.');
      return;
    }

    setProjects((current) => current.filter((project) => project.id !== projectId));
    toast.success('Projeto removido.');
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando projetos...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Projetos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe escopo, progresso e prazo dos seus projetos.</p>
        </div>
        <button onClick={() => setShowForm((current) => !current)} className="text-primary hover:text-primary/80 transition-colors">
          <Plus size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] text-muted-foreground">Em andamento</p>
          <p className="text-xl font-semibold text-foreground mt-1">{summary.active}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] text-muted-foreground">Concluídos</p>
          <p className="text-xl font-semibold text-foreground mt-1">{summary.done}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-secondary/50 rounded-lg p-3 border border-border space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do projeto"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Resumo ou próximo passo"
            className="w-full min-h-24 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
            />
            <button onClick={() => void handleCreateProject()} className="ml-auto rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium">
              Criar projeto
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project, index) => (
          <div key={project.id} className="animate-in fade-in-0 slide-in-from-top-1 duration-200" style={{ animationDelay: `${index * 40}ms` }}>
            <ProjectCard
              project={project}
              onUpdate={updateProject}
              onDelete={handleDeleteProject}
            />
          </div>
        ))}


        {projects.length === 0 && (
          <div className="bg-secondary/40 border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Nenhum projeto cadastrado ainda. Use este módulo para acompanhar entregas maiores.
          </div>
        )}
      </div>
    </div>
  );
}
