export interface WorkspaceOutlet { id:string; name:string; code:string; country:string; currency:string|null; locale:string|null; timezone?:string; phone?:string; taxId?:string; addressLines?:string[]; extraIds?:string[] }
export interface DateRange { preset:'Today'|'Yesterday'|'Last 7 Days'|'This Month'|'Custom Range'; from:string; to:string }
export interface SaleDay { day:string; orders:number; grossMinor:number; netMinor:number; taxMinor:number; discountMinor:number }
export interface MenuVariant { id:string; name:string; priceMinor:number|null; priceDeltaMinor:number; isDefault:boolean; isActive?:boolean }
export interface MenuModifier { id:string; name:string; priceMinor:number; isActive:boolean }
export interface MenuModifierGroup {
 id:string; groupId?:string; name:string; minSelect:number; maxSelect:number; sortOrder?:number; isActive?:boolean; modifiers:MenuModifier[];
}
export interface MenuItem {
 id:string; name:string; code?:string; description?:string|null; categoryId:string; priceMinor:number;
 packagingChargeMinor:number; taxSlabId:string; hsnSac?:string|null; isActive:boolean; isVeg?:boolean|null;
 imageUrl?:string|null;
 variants?:MenuVariant[]; modifierGroups?:MenuModifierGroup[];
}
export interface Category { id:string; name:string; itemCount?:number }
export const money=(minor:number,currency='INR')=>new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(minor/100);
export function dayInZone(now:Date,zone='Asia/Kolkata'){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');}
export function shiftDay(day:string,days:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function presetRange(preset:DateRange['preset'],zone='Asia/Kolkata'):DateRange {const today=dayInZone(new Date(),zone);return {preset,from:preset==='Yesterday'?shiftDay(today,-1):preset==='Last 7 Days'?shiftDay(today,-6):preset==='This Month'?today.slice(0,8)+'01':today,to:preset==='Yesterday'?shiftDay(today,-1):today};}
export function rangeBounds(range:DateRange,zone='Asia/Kolkata') {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(range.from)||!/^\d{4}-\d{2}-\d{2}$/.test(range.to)||range.from>range.to)throw new Error('Choose a valid start and end date.');
 const midnight=(day:string)=>{const target=Date.parse(day+'T00:00:00Z');if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==day)throw new Error('Invalid calendar date.');let t=target;for(let i=0;i<3;i++){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t));const n=(k:string)=>Number(p.find(v=>v.type===k)?.value);const local=Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'));t+=target-local;}return new Date(t).toISOString();};
 return {from:midnight(range.from),to:midnight(shiftDay(range.to,1))};
}
