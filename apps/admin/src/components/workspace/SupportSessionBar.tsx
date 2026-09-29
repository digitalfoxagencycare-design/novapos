import { useEffect, useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
export function SupportSessionBar({storeName,expiresAt,onExit}:{storeName:string;expiresAt:string;onExit:()=>Promise<void>}){
 const [now,setNow]=useState(Date.now());const [busy,setBusy]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const seconds=Math.max(0,Math.floor((Date.parse(expiresAt)-now)/1000));const remaining=Number.isFinite(seconds)?seconds:0;
 return <div className="store-workspace"><aside role="status" className="sticky top-0 z-50 flex min-h-[48px] flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900"><span className="flex items-center gap-2"><ShieldCheck size={17}/><strong>Active Support session</strong><span>· {storeName}</span></span><span className="flex items-center gap-4"><span className="font-mono text-xs">{remaining?`Auto-expires in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Session expired · exit to continue'}</span><button disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold" onClick={async()=>{setBusy(true);try{await onExit();}finally{setBusy(false);}}}><LogOut size={13}/>Exit support view</button></span></aside></div>;
}
