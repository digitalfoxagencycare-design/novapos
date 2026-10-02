import { Capacitor } from '@capacitor/core';
import { ApiClient, type Tokens } from './api';

const KEY = 'novapos:cloud_tokens';
export const resolvePosApiBase = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/api/v1`;
  }
  if (Capacitor.isNativePlatform()) {
    return 'https://api.novasaas.net/api/v1';
  }
  if (typeof window !== 'undefined' && window.location?.hostname && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'https://api.novasaas.net/api/v1';
  }
  return '/api/v1';
};

export const cloudApi = new ApiClient(
  resolvePosApiBase(),
  tokens => {
    if (tokens) localStorage.setItem(KEY, JSON.stringify(tokens));
    else localStorage.removeItem(KEY);
  },
);
try {
  const raw = localStorage.getItem(KEY);
  const tokens: Tokens | null = raw ? JSON.parse(raw) : null;
  if (tokens?.accessToken && tokens?.refreshToken) cloudApi.setTokens(tokens);
} catch { localStorage.removeItem(KEY); }
