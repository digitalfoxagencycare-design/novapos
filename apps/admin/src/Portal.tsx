import { SupportSessionBar } from './components/workspace/SupportSessionBar';
import './styles/workspace.css';
import React, { useEffect, useState } from 'react';
import { App as TenantApp, adminApi } from './App';
import { MerchantsManagement } from './components/MerchantsManagement';
import { platformApi, type Actor, type ImpersonationAccess } from './lib/platformApi';
import './styles/platform.css';

interface ActiveImpersonation {
  sessionId: string;
  tenantName: string;
  tenantSlug: string;
  expiresAt: string;
}
const impersonationKey = 'novapos:platform:impersonation';

function readImpersonation(): ActiveImpersonation | null {
  try {
    const value = sessionStorage.getItem(impersonationKey);
    return value ? JSON.parse(value) as ActiveImpersonation : null;
  } catch {
    sessionStorage.removeItem(impersonationKey);
    return null;
  }
}

export function Portal() {
  const [mode, setMode] = useState(location.pathname.startsWith('/store') ? 'USER' : 'ADMIN');
  const [actor, setActor] = useState<Actor | null>(null);
  const [pending, setPending] = useState(platformApi.hasSession());
  const [error, setError] = useState('');
  const [impersonation, setImpersonation] = useState<ActiveImpersonation | null>(readImpersonation);
  const [supportWarning, setSupportWarning] = useState('');

  useEffect(() => {
    if (platformApi.hasSession()) {
      void platformApi.request('/admin/auth/me').then(setActor).catch(e => setError(e.message)).finally(() => setPending(false));
    }
  }, []);

  const logout = () => {
    platformApi.logout();
    setActor(null);
    history.replaceState(null, '', '/');
  };

  const beginImpersonation = (access: ImpersonationAccess) => {
    const active: ActiveImpersonation = {
      sessionId: access.sessionId,
      tenantName: access.tenant.name,
      tenantSlug: access.tenant.slug,
      expiresAt: access.expiresAt,
    };
    adminApi.beginImpersonation(access.accessToken);
    sessionStorage.setItem(impersonationKey, JSON.stringify(active));
    setSupportWarning('');
    setImpersonation(active);
    history.replaceState(null, '', '/store/support');
  };

  const exitImpersonation = async () => {
    if (!impersonation) return;
    try {
      await platformApi.request(`/admin/super/impersonation/${impersonation.sessionId}/end`, 'POST', {});
      setSupportWarning('');
    } catch (e) {
      setSupportWarning(`Server revocation was not confirmed: ${(e as Error).message}. The support token also expires automatically.`);
    } finally {
      await adminApi.logout();
      sessionStorage.removeItem(impersonationKey);
      setImpersonation(null);
      history.replaceState(null, '', actor?.role === 'SUPER_ADMIN' ? '/super-admin' : '/');
    }
  };

  if (impersonation) {
    return <>
      <SupportSessionBar storeName={impersonation.tenantName} expiresAt={impersonation.expiresAt} onExit={exitImpersonation}/>
      <TenantApp />
    </>;
  }

  if (actor) return <>
    {supportWarning && <p className="support-session-error" role="alert">{supportWarning}</p>}
    <MerchantsManagement actor={actor} onLogout={logout} onImpersonate={beginImpersonation} />
  </>;
  if (mode === 'USER') return <><button className="portal-role-back" onClick={() => { setMode('ADMIN'); history.replaceState(null, '', '/'); }}>Switch to Admin Portal →</button><TenantApp /></>;

  return <div className="platform-login">
    <section><small>NOVAPOS · OPERATIONS</small><h1>One workspace.<br />Every store connected.</h1><p>Manage partners, merchant access and license validity.</p></section>
    <form onSubmit={async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      setPending(true);
      setError('');
      try {
        const nextActor = await platformApi.login(String(f.get('identifier')), String(f.get('password')));
        setActor(nextActor);
        history.replaceState(null, '', nextActor.role === 'SUPER_ADMIN' ? '/super-admin' : '/dealer');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    }}>
      <h2>Admin Portal</h2>
      <p>Sign in as a platform administrator or dealer.</p>
      <label>User ID / Mobile Number<input name="identifier" autoComplete="username" required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <button disabled={pending} className="platform-primary">{pending ? 'Checking account…' : 'Sign in to Admin Portal'}</button>
      <button type="button" className="portal-mode-switch" onClick={() => { setMode('USER'); setError(''); history.replaceState(null, '', '/store/dashboard'); }}>Switch to Store Owner / Cashier Login →</button>
    </form>
  </div>;
}
