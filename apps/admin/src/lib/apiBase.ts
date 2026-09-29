export const resolveApiBase = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/api/v1`;
  }
  if (typeof window !== 'undefined' && window.location?.hostname && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'https://api.novasaas.net/api/v1';
  }
  return '/api/v1';
};

