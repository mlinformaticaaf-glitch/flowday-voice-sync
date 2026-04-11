function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getAuthRedirectBaseUrl(): string {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
  if (configured && configured.trim().length > 0) {
    return normalizeBaseUrl(configured.trim());
  }

  return normalizeBaseUrl(window.location.origin);
}

export function getAuthRedirectUrl(path = '/'): string {
  const baseUrl = getAuthRedirectBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}
