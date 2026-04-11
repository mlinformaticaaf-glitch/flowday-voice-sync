import { supabase } from '@/integrations/supabase/client';
import { getAuthRedirectUrl } from '@/lib/authRedirect';

export const GOOGLE_PRODUCTIVITY_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
] as const;

export async function signInWithGoogleProductivity() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl('/'),
      scopes: GOOGLE_PRODUCTIVITY_SCOPES.join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      },
    },
  });

  return {
    data,
    error,
    redirected: Boolean(data?.url),
  };
}