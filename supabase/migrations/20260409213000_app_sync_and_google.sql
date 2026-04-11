CREATE TYPE public.task_kind AS ENUM ('task', 'habit');
CREATE TYPE public.recurrence_pattern AS ENUM ('none', 'daily', 'weekly', 'monthly');
CREATE TYPE public.sync_source AS ENUM ('manual', 'voice', 'google');

CREATE TABLE public.google_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected BOOLEAN NOT NULL DEFAULT false,
  last_calendar_sync_at TIMESTAMP WITH TIME ZONE,
  last_tasks_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
  category TEXT NOT NULL DEFAULT 'geral' CHECK (category IN ('codigo', 'comunicacao', 'pesquisa', 'geral')),
  kind public.task_kind NOT NULL DEFAULT 'task',
  recurrence public.recurrence_pattern NOT NULL DEFAULT 'none',
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  source public.sync_source NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT tasks_user_external_id_key UNIQUE (user_id, external_id)
);

CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60 CHECK (duration > 0),
  recurrence public.recurrence_pattern NOT NULL DEFAULT 'none',
  source public.sync_source NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT appointments_user_external_id_key UNIQUE (user_id, external_id)
);

CREATE TABLE public.inbox_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source public.sync_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Google integration"
  ON public.google_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google integration"
  ON public.google_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google integration"
  ON public.google_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google integration"
  ON public.google_integrations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments"
  ON public.appointments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own inbox"
  ON public.inbox_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inbox"
  ON public.inbox_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inbox"
  ON public.inbox_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inbox"
  ON public.inbox_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_google_integrations_updated_at
  BEFORE UPDATE ON public.google_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inbox_items_updated_at
  BEFORE UPDATE ON public.inbox_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();