import React, { useEffect, useState } from 'react';
import { App as TenantApp } from './App';
import { MerchantsManagement } from './components/MerchantsManagement';
import { platformApi, type Actor } from './lib/platformApi';
import './styles/platform.css';
export function Portal() {
 const [mode,setMode] = useState(location.pathname.startsWith('/store')?'TENANT':'SUPER_ADMIN');
 const [actor,setActor] = useState<Actor|null>(null); const [pending,setPending] = useState(platformApi.hasSession()); const [error,setError] = useState('');
 useEffect(()=>{if(platformApi.hasSession())void platformApi.request('/admin/auth/me').then(setActor).catch(e=>setError(e.message)).finally(()=>setPending(false));},[]);
 const logout = ()=>{platformApi.logout();setActor(null);history.replaceState(null,'','/');};
 if(actor)return <MerchantsManagement actor={actor} onLogout={logout}/>;
 if(mode==='TENANT')return <><button className="portal-role-back" onClick={()=>{setMode('SUPER_ADMIN');history.replaceState(null,'','/');}}>← Platform / Dealer login</button><TenantApp/></>;
 return <div className="platform-login"><section><small>NOVAPOS · OPERATIONS</small><h1>One workspace.<br/>Every store connected.</h1><p>Manage partners, merchant access and license validity.</p></section><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setPending(true);setError('');try{const a=await platformApi.login(String(f.get('identifier')),String(f.get('password')));setActor(a);history.replaceState(null,'',a.role==='SUPER_ADMIN'?'/super-admin':'/dealer');}catch(e){setError((e as Error).message);}finally{setPending(false);}}}>
 <h2>Welcome back</h2><div className="platform-login-tabs">{[['SUPER_ADMIN','Super Admin'],['DEALER','Dealer'],['TENANT','Store Owner']].map(([key,label])=><button type="button" key={key} aria-pressed={mode===key} onClick={()=>{setMode(key);setError('');if(key==='TENANT')history.replaceState(null,'','/store/dashboard');}}>{label}</button>)}</div>
 <label>Email or phone<input name="identifier" autoComplete="username" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>{error&&<p role="alert" className="error-banner">{error}</p>}<button disabled={pending} className="platform-primary">{pending?'Checking account…':`Sign in as ${mode==='DEALER'?'Dealer':'Super Admin'}`}</button><p>Your verified account determines your access.</p></form></div>;
}
