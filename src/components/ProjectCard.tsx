import { FolderKanban, Trash2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

type ProjectRow = Tables<'projects'>;

const STATUS_LABELS: Record<ProjectRow['status'], string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
};

interface ProjectCardProps {
  project: ProjectRow;
  onUpdate: (projectId: string, updates: Partial<ProjectRow>) => void;
  onDelete: (projectId: string) => void;
}

export default function ProjectCard({ project, onUpdate, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-xl p-5 space-y-4 hover:border-cyan-500/30 hover:bg-card/80 transition-all shadow-sm group">
      <div className="flex items-start justify-between gap-3">
        <div 
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => navigate(`/projetos/${project.id}`)}
        >
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <FolderKanban size={16} />
            </div>
            <h2 className="text-base font-semibold text-foreground tracking-tight truncate group-hover:text-cyan-400 transition-colors">
              {project.name}
            </h2>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }} 
          className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="bg-secondary px-2 py-0.5 rounded-full">{STATUS_LABELS[project.status]}</span>
          <span className="text-cyan-400">{project.progress}% concluído</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500" 
            style={{ width: `${project.progress}%` }} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center pt-2">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={project.progress}
          onChange={(event) => onUpdate(project.id, { progress: Number(event.target.value) })}
          className="w-full accent-cyan-500 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
        />
        <select
          value={project.status}
          onChange={(event) => onUpdate(project.id, { status: event.target.value })}
          className="bg-card border border-border/60 hover:border-white/20 rounded-lg px-3 py-1.5 text-xs text-foreground font-medium transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {project.due_date && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-1 border-t border-border/40">
          <span>Prazo: {project.due_date}</span>
        </div>
      )}
    </div>
  );
}
