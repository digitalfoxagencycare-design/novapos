export interface Actor { sub: string; role: 'SUPER_ADMIN' | 'DEALER'; name: string; dealerCode?: string }
const key = 'novapos:platform:token';
const base = `${(import.meta.env.VITE_API_URL || 'https://api.novasaas.net').replace(/\/$/,'')}/api/v1`;
export const platformApi = {
 hasSession: () => Boolean(sessionStorage.getItem(key)),
 logout: () => sessionStorage.removeItem(key),
 async request(path: string, method = 'GET', body?: unknown) {
   const token = sessionStorage.getItem(key);
   const res = await fetch(base + path, { method, headers: { 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
   const data = await res.json().catch(() => ({}));
   if (!res.ok) { if (res.status === 401) sessionStorage.removeItem(key); throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || data.error?.message || `Request failed (${res.status})`); }
   return data;
 },
 async login(identifier: string, password: string): Promise<Actor> {
   const data = await this.request('/admin/auth/login','POST',{identifier,password});
   sessionStorage.setItem(key,data.accessToken); return data.actor;
 }
};
