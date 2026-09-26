import { Capacitor } from '@capacitor/core';
import { ApiClient, type Tokens } from './api';

const KEY = 'novapos:cloud_tokens';
export const cloudApi = new ApiClient(
  import.meta.env.VITE_API_BASE_URL || (Capacitor.isNativePlatform() ? 'https://api.novasaas.net/api/v1' : '/api/v1'),
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
