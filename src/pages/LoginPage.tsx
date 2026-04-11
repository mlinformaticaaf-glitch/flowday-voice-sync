import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { signInWithGoogleProductivity } from '@/lib/googleOAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAuthRedirectUrl } from '@/lib/authRedirect';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    const result = await signInWithGoogleProductivity();
    setLoadingGoogle(false);

    if (result.error) {
      toast.error('Erro ao fazer login com Google');
      return;
    }

    if (result.redirected) {
      return;
    }
  };

  const handleEmailLogin = async () => {
    if (!normalizedEmail || !password) {
      toast.error('Preencha e-mail e senha para entrar.');
      return;
    }

    setLoadingEmail(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setLoadingEmail(false);

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        toast.error('Credenciais inválidas. Se sua conta foi criada com Google, use Entrar com Google. Se acabou de se cadastrar, confirme o e-mail.');
      } else {
        toast.error(error.message || 'Não foi possível entrar com e-mail e senha.');
      }
      return;
    }

    toast.success('Login realizado com sucesso.');
  };

  const handleEmailSignUp = async () => {
    if (!normalizedEmail || !password || !confirmPassword) {
      toast.error('Preencha e-mail, senha e confirmação.');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoadingEmail(true);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/'),
      },
    });
    setLoadingEmail(false);

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        toast.error('Já existe uma conta com este e-mail. Tente entrar ou redefinir a senha.');
      } else {
        toast.error(error.message || 'Não foi possível criar a conta.');
      }
      return;
    }

    if (data.session) {
      toast.success('Cadastro concluído e acesso liberado.');
      return;
    }

    toast.info('Cadastro criado. Se a confirmação por e-mail estiver ativa no Supabase, confirme seu e-mail para entrar.');
  };

  const handleResetPassword = async () => {
    if (!normalizedEmail) {
      toast.error('Informe seu e-mail para redefinir a senha.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getAuthRedirectUrl('/login'),
    });

    if (error) {
      toast.error(error.message || 'Não foi possível enviar o e-mail de recuperação.');
      return;
    }

    toast.success('Enviamos o link de recuperação de senha para seu e-mail.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 text-center px-6">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">FlowDay</h1>
          <p className="text-sm text-muted-foreground mt-2">Produtividade inteligente com voz</p>
        </div>

        <Tabs defaultValue="entrar" className="text-left">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar" className="space-y-3 mt-4">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Seu e-mail"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => void handleEmailLogin()}
              disabled={loadingEmail}
              className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {loadingEmail ? 'Entrando...' : 'Entrar com e-mail'}
            </button>
            <button
              onClick={() => void handleResetPassword()}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            >
              Esqueci minha senha
            </button>
          </TabsContent>

          <TabsContent value="cadastrar" className="space-y-3 mt-4">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Seu e-mail"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Crie uma senha"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirme a senha"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => void handleEmailSignUp()}
              disabled={loadingEmail}
              className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {loadingEmail ? 'Cadastrando...' : 'Criar conta'}
            </button>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <button
            onClick={() => void handleGoogleLogin()}
            disabled={loadingGoogle}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loadingGoogle ? 'Abrindo Google...' : 'Entrar com Google'}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Você pode criar conta com e-mail/senha e depois vincular Google nas configurações para sincronização.
        </p>
      </div>
    </div>
  );
}
