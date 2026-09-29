import { useEffect, useRef, useState } from 'react';
import {
  Check, Download, LayoutGrid, List, Minus, Package, Pencil, Plus, Search, SlidersHorizontal,
} from 'lucide-react';
import { type AdminApi, downloadCsv } from '../../lib/api';
import {
  button, primary, card, field, SlideOver, EmptyState, ErrorState, Skeleton, useResource,
} from './primitives';
import {
  type Category, type MenuItem, type WorkspaceOutlet, money,
} from './types';

type VariantInput = { id?: string; name: string; priceMinor: number | null; priceDeltaMinor: number; isDefault: boolean };
type ModifierInput = { id?: string; name: string; priceMinor: number };
type ModifierDraft = ModifierInput & { priceText: string };
type ModifierGroupInput = {
  id?: string; name: string; minSelect: number; maxSelect: number; modifiers: ModifierInput[];
};
type ModifierGroupDraft = Omit<ModifierGroupInput, 'modifiers'> & { modifiers: ModifierDraft[] };
export type ItemEditorUpdate = {
  name: string;
  description: string;
  categoryId: string;
  priceMinor: number;
  packagingChargeMinor: number;
  taxSlabId: string;
  hsnSac: string;
  isActive: boolean;
  variants: VariantInput[];
  modifierGroups: ModifierGroupInput[];
};

const gstSlabs = [
  { id: 'gst-0', label: '0% GST' },
  { id: 'gst-5', label: '5% GST' },
  { id: 'gst-12', label: '12% GST' },
  { id: 'gst-18', label: '18% GST' },
];

function amountText(minor: number) {
  return (minor / 100).toFixed(2);
}

function parseMinor(value: string, label: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error(`${label} must be a non-negative amount with up to two decimal places.`);
  const minor = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(minor) || minor > 2_147_483_647) throw new Error(`${label} is outside the supported amount range.`);
  return minor;
}

function getVariants(item: MenuItem): (VariantInput & { priceText: string })[] {
  return (item.variants ?? []).filter(variant => variant.isActive !== false).map(variant => ({
    id: variant.id,
    name: variant.name,
    priceMinor: variant.priceMinor,
    priceDeltaMinor: variant.priceDeltaMinor,
    isDefault: variant.isDefault,
    priceText: amountText(variant.priceMinor ?? item.priceMinor + variant.priceDeltaMinor),
  }));
}

function getGroups(item: MenuItem): ModifierGroupDraft[] {
  return (item.modifierGroups ?? []).filter(group => group.isActive !== false).map(group => ({
    id: group.groupId ?? group.id,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    modifiers: group.modifiers.filter(modifier => modifier.isActive).map(modifier => ({
      id: modifier.id,
      name: modifier.name,
      priceMinor: modifier.priceMinor,
      priceText: amountText(modifier.priceMinor),
    })),
  }));
}

export interface ItemEditorProps {
  item: MenuItem;
  categories: Category[];
  onClose: () => void;
  onSave: (updates: ItemEditorUpdate) => Promise<void>;
}

export function ItemEditor({ item, categories, onClose, onSave }: ItemEditorProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [price, setPrice] = useState(amountText(item.priceMinor));
  const [packaging, setPackaging] = useState(amountText(item.packagingChargeMinor ?? 0));
  const [tax, setTax] = useState(item.taxSlabId);
  const [hsn, setHsn] = useState(item.hsnSac ?? '');
  const [isActive, setIsActive] = useState(item.isActive);
  const [variants, setVariants] = useState(getVariants(item));
  const [groups, setGroups] = useState<ModifierGroupDraft[]>(getGroups(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateGroup = (index: number, patch: Partial<ModifierGroupDraft>) => {
    setGroups(rows => rows.map((group, rowIndex) => rowIndex === index ? { ...group, ...patch } : group));
  };
  const updateModifier = (groupIndex: number, modifierIndex: number, patch: Partial<ModifierDraft>) => {
    setGroups(rows => rows.map((group, rowIndex) => rowIndex === groupIndex
      ? { ...group, modifiers: group.modifiers.map((modifier, optionIndex) => optionIndex === modifierIndex ? { ...modifier, ...patch } : modifier) }
      : group));
  };

  return <SlideOver title="Edit menu item" subtitle={item.code || 'Catalog item'} onClose={onClose} busy={busy}>
    <form className="space-y-6" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      try {
        const cleanedName = name.trim();
        if (!cleanedName) throw new Error('Enter an item name.');
        if (!categoryId) throw new Error('Choose a category.');
        const normalizedVariants = variants.map(variant => ({
          id: variant.id,
          name: variant.name.trim(),
          priceMinor: parseMinor(variant.priceText, `Price for ${variant.name || 'variant'}`),
          priceDeltaMinor: 0,
          isDefault: variant.isDefault,
        }));
        if (normalizedVariants.some(variant => !variant.name)) throw new Error('Every variant needs a name.');
        const normalizedGroups = groups.map(group => ({
          id: group.id,
          name: group.name.trim(),
          minSelect: Number(group.minSelect),
          maxSelect: Number(group.maxSelect),
          modifiers: group.modifiers.map(modifier => ({
            id: modifier.id,
            name: modifier.name.trim(),
            priceMinor: parseMinor(modifier.priceText, `Price for ${modifier.name || 'modifier'}`),
          })),
        }));
        for (const group of normalizedGroups) {
          if (!group.name) throw new Error('Every modifier group needs a name.');
          if (!Number.isInteger(group.minSelect) || !Number.isInteger(group.maxSelect)
            || group.minSelect < 0 || group.maxSelect < 1 || group.minSelect > group.maxSelect || group.maxSelect > 20) {
            throw new Error(`Set a valid selection range for "${group.name}".`);
          }
          if (group.modifiers.some(modifier => !modifier.name)) throw new Error(`Every choice in "${group.name}" needs a name.`);
        }
        setBusy(true);
        setError('');
        await onSave({
          name: cleanedName,
          description: description.trim(),
          categoryId,
          priceMinor: parseMinor(price, 'Base price'),
          packagingChargeMinor: parseMinor(packaging, 'Packaging charge'),
          taxSlabId: tax,
          hsnSac: hsn.trim(),
          isActive,
          variants: normalizedVariants,
          modifierGroups: normalizedGroups,
        });
        onClose();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : String(saveError));
      } finally {
        setBusy(false);
      }
    }}>
      <section className="space-y-4">
        <label className="block text-xs font-semibold text-slate-600">Item name
          <input required maxLength={150} className={`${field} mt-2`} value={name} onChange={event => setName(event.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Description
          <textarea maxLength={2000} rows={3} className={`${field} mt-2`} value={description} onChange={event => setDescription(event.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Category
          <select required className={`${field} mt-2`} value={categoryId} onChange={event => setCategoryId(event.target.value)}>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-xs font-semibold text-slate-600">Base price (₹)
            <input inputMode="decimal" required className={`${field} mt-2 font-mono`} value={price} onChange={event => setPrice(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">GST slab
            <select className={`${field} mt-2`} value={tax} onChange={event => setTax(event.target.value)}>
              {!gstSlabs.some(slab => slab.id === tax) && <option value={tax}>{tax}</option>}
              {gstSlabs.map(slab => <option key={slab.id} value={slab.id}>{slab.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">Packaging charge (₹)
            <input inputMode="decimal" required className={`${field} mt-2 font-mono`} value={packaging} onChange={event => setPackaging(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">HSN / SAC code
            <input className={`${field} mt-2 font-mono`} maxLength={12} value={hsn} onChange={event => setHsn(event.target.value)} />
          </label>
        </div>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm font-semibold">
          <span>In stock <span className="block pt-1 text-xs font-normal text-slate-500">Turn off to 86 this item at the POS.</span></span>
          <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-sm font-bold"><Package size={16} />Variants</h3><p className="mt-1 text-xs text-slate-500">Set absolute prices for sizes or other item options.</p></div>
          <button type="button" className={button} onClick={() => setVariants(rows => [...rows, { name: '', priceMinor: null, priceDeltaMinor: 0, isDefault: false, priceText: price }])}><Plus size={14} />Add</button>
        </div>
        {variants.map((variant, index) => <div key={variant.id ?? `new-${index}`} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-end gap-2">
          <label className="text-xs font-semibold text-slate-600">Option<input className={`${field} mt-1`} maxLength={120} placeholder="Small, Medium…" value={variant.name} onChange={event => setVariants(rows => rows.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /></label>
          <label className="text-xs font-semibold text-slate-600">Price (₹)<input inputMode="decimal" className={`${field} mt-1 font-mono`} value={variant.priceText} onChange={event => setVariants(rows => rows.map((row, i) => i === index ? { ...row, priceText: event.target.value } : row))} /></label>
          <button type="button" className={button} aria-label={`Remove ${variant.name || 'variant'}`} onClick={() => setVariants(rows => rows.filter((_, i) => i !== index))}><Minus size={14} /></button>
        </div>)}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={16} />Modifier groups</h3><p className="mt-1 text-xs text-slate-500">Store-level groups shared by every item they are assigned to.</p></div>
          <button type="button" className={button} onClick={() => setGroups(rows => [...rows, { name: '', minSelect: 0, maxSelect: 1, modifiers: [] }])}><Plus size={14} />Add group</button>
        </div>
        {groups.map((group, groupIndex) => <div key={group.id ?? `new-group-${groupIndex}`} className="space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">Group name<input className={`${field} mt-1`} maxLength={120} placeholder="Size, Addons…" value={group.name} onChange={event => updateGroup(groupIndex, { name: event.target.value })} /></label>
            <button type="button" className={button} aria-label={`Remove ${group.name || 'modifier group'}`} onClick={() => setGroups(rows => rows.filter((_, index) => index !== groupIndex))}><Minus size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">Minimum selections<input type="number" min={0} max={20} className={`${field} mt-1`} value={group.minSelect} onChange={event => updateGroup(groupIndex, { minSelect: Number(event.target.value) })} /></label>
            <label className="text-xs font-semibold text-slate-600">Maximum selections<input type="number" min={1} max={20} className={`${field} mt-1`} value={group.maxSelect} onChange={event => updateGroup(groupIndex, { maxSelect: Number(event.target.value) })} /></label>
          </div>
          {group.modifiers.map((modifier, modifierIndex) => <div key={modifier.id ?? `new-option-${modifierIndex}`} className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">Choice<input className={`${field} mt-1`} maxLength={120} placeholder="Extra sauce…" value={modifier.name} onChange={event => updateModifier(groupIndex, modifierIndex, { name: event.target.value })} /></label>
            <label className="text-xs font-semibold text-slate-600">Price (₹)<input inputMode="decimal" className={`${field} mt-1 font-mono`} value={modifier.priceText} onChange={event => updateModifier(groupIndex, modifierIndex, { priceText: event.target.value })} /></label>
            <button type="button" className={button} aria-label={`Remove ${modifier.name || 'modifier'}`} onClick={() => updateGroup(groupIndex, { modifiers: group.modifiers.filter((_, index) => index !== modifierIndex) })}><Minus size={14} /></button>
          </div>)}
          <button type="button" className={button} onClick={() => updateGroup(groupIndex, { modifiers: [...group.modifiers, { name: '', priceMinor: 0, priceText: '0.00' }] })}><Plus size={14} />Add choice</button>
        </div>)}
      </section>

      <p className="text-xs leading-relaxed text-slate-500">Changes apply to new orders. Packaging charges are included in the item unit price for new orders; issued invoices keep their original price and tax snapshots.</p>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><strong>Couldn’t save item changes.</strong><p className="mt-1">{error}</p></div>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <button type="button" className={button} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={primary} disabled={busy}><Check size={16} />{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  </SlideOver>;
}

export function CatalogWorkspace({ api, outlet, canWrite }: { api: AdminApi; outlet: WorkspaceOutlet; canWrite: boolean }) {
  const resource = useResource(async () => {
    const [items, categories] = await Promise.all([api.items(), api.categories()]);
    if (!Array.isArray(items) || !Array.isArray(categories)) throw new Error('Catalog response is incomplete.');
    return { items: items as MenuItem[], categories: categories as Category[] };
  }, [outlet.id]);
  const [items, setItems] = useState<MenuItem[]>([]);
  useEffect(() => { if (resource.data) setItems(resource.data.items); }, [resource.data]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [grid, setGrid] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string[]>([]);
  const locks = useRef(new Set<string>());
  const toggle = async (item: MenuItem) => {
    if (!canWrite || locks.current.has(item.id)) return;
    locks.current.add(item.id);
    setSaving([...locks.current]);
    setError('');
    setItems(rows => rows.map(row => row.id === item.id ? { ...row, isActive: !item.isActive } : row));
    try {
      await api.updateItem(item.id, { isActive: !item.isActive });
    } catch (saveError) {
      setItems(rows => rows.map(row => row.id === item.id ? { ...row, isActive: item.isActive } : row));
      setError(`Availability was not saved: ${(saveError as Error).message}`);
    } finally {
      locks.current.delete(item.id);
      setSaving([...locks.current]);
    }
  };

  if (resource.error) return <ErrorState error={resource.error} retry={resource.retry} />;
  if (!resource.data) return <Skeleton />;
  const categories = resource.data.categories;
  const visible = items.filter(item => (!category || item.categoryId === category)
    && [item.name, item.code].some(value => value?.toLowerCase().includes(search.toLowerCase())));
  const format = (minor: number) => money(minor, outlet.currency ?? 'INR');
  const availability = (item: MenuItem) => <button
    role="switch"
    aria-label={`Availability for ${item.name}`}
    aria-checked={item.isActive}
    disabled={!canWrite || saving.includes(item.id)}
    onClick={() => void toggle(item)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${item.isActive ? 'bg-emerald-600' : 'bg-slate-300'}`}
  ><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${item.isActive ? 'translate-x-5' : 'translate-x-0'}`} /></button>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">Operations / Catalog</p><h1 className="text-2xl font-bold tracking-tight">Menu & Catalog</h1><p className="mt-2 text-sm text-slate-500">Keep every item ready for your next order.</p></div>
      <button className={button} disabled={!items.length} onClick={() => downloadCsv('catalog', items.map(item => ({
        name: item.name, code: item.code ?? '', price: (item.priceMinor / 100).toFixed(2), tax: item.taxSlabId, available: item.isActive,
      })))}><Download size={15} />Export catalog</button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className={`${card} self-start p-3`}>
        <h2 className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Categories</h2>
        {[{ id: '', name: 'All items' }, ...categories].map(row => <button key={row.id} aria-pressed={category === row.id} onClick={() => setCategory(row.id)} className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm ${category === row.id ? 'bg-emerald-50 font-semibold text-forest' : 'text-slate-600 hover:bg-slate-50'}`}>
          <span>{row.name}</span><span className="rounded bg-white px-1.5 font-mono text-xs text-slate-400">{row.id ? items.filter(item => item.categoryId === row.id).length : items.length}</span>
        </button>)}
      </aside>
      <section className={`${card} min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[180px] flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className={`${field} pl-9`} aria-label="Search catalog" placeholder="Search by name or item code" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <div className="flex gap-1"><button className={button} aria-label="Table view" aria-pressed={!grid} onClick={() => setGrid(false)}><List size={17} /></button><button className={button} aria-label="Grid view" aria-pressed={grid} onClick={() => setGrid(true)}><LayoutGrid size={17} /></button></div>
        </div>
        {!visible.length ? <EmptyState title="No items found" detail="Choose another category or clear your search." /> : grid
          ? <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex h-20 items-center justify-center rounded-lg bg-slate-50 text-slate-300"><UtensilTile name={item.name} /></div><h3 className="truncate text-sm font-bold">{item.name}</h3><p className="mt-1 font-mono text-lg font-bold text-forest">{format(item.priceMinor)}</p>
            <div className="mt-4 flex items-center justify-between">{availability(item)}<button disabled={!canWrite || saving.includes(item.id)} className={button} onClick={() => setEditing(item)}><Pencil size={14} />Edit Item</button></div>
          </article>)}</div>
          : <div className="overflow-x-auto"><table><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><tr>{['Item details', 'Category', 'Price', 'GST', 'Available', ''].map((value, index) => <th className="px-4 py-3 font-semibold" key={index}>{value}</th>)}</tr></thead><tbody>
            {visible.map(item => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/70">
              <td className="px-4 py-4"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}><Package size={15} /></span><div><strong className="text-sm font-semibold">{item.name}</strong><p className="mt-1 font-mono text-[11px] text-slate-400">{item.code || 'No code'}</p></div></div></td>
              <td className="px-4 py-4 text-xs text-slate-500">{categories.find(row => row.id === item.categoryId)?.name ?? '—'}</td><td className="whitespace-nowrap px-4 py-4 font-mono text-sm font-semibold">{format(item.priceMinor)}</td><td className="px-4 py-4 text-xs text-slate-500">{item.taxSlabId}</td><td className="px-4 py-4">{availability(item)}</td>
              <td className="px-4 py-4"><button className={button} disabled={!canWrite || saving.includes(item.id)} aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}><Pencil size={14} /><span className="sr-only">Edit Item</span></button></td>
            </tr>)}
          </tbody></table></div>}
        <footer className="border-t border-slate-100 p-4 text-xs text-slate-500">{visible.length} items · Availability is saved to the server. Terminals receive it on their next catalog sync.</footer>
      </section>
    </div>
    {editing && <ItemEditor
      key={editing.id}
      item={editing}
      categories={categories}
      onClose={() => setEditing(null)}
      onSave={async updates => {
        const before = items.find(item => item.id === editing.id);
        if (!before) throw new Error('This catalog item is no longer available. Refresh the page and try again.');
        const optimistic: MenuItem = {
          ...before,
          ...updates,
          variants: updates.variants.map((variant, index) => ({
            id: variant.id ?? `pending-variant-${index}`,
            name: variant.name,
            priceMinor: variant.priceMinor,
            priceDeltaMinor: variant.priceDeltaMinor,
            isDefault: variant.isDefault,
            isActive: true,
          })),
          modifierGroups: updates.modifierGroups.map((group, groupIndex) => ({
            id: group.id ?? `pending-group-${groupIndex}`,
            groupId: group.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: groupIndex,
            isActive: true,
            modifiers: group.modifiers.map((modifier, modifierIndex) => ({
              id: modifier.id ?? `pending-modifier-${groupIndex}-${modifierIndex}`,
              name: modifier.name,
              priceMinor: modifier.priceMinor,
              isActive: true,
            })),
          })),
        };
        setItems(rows => rows.map(item => item.id === editing.id ? optimistic : item));
        try {
          const saved = await api.updateItem(editing.id, updates) as MenuItem;
          setItems(rows => rows.map(item => item.id === editing.id ? { ...optimistic, ...saved } : item));
        } catch (saveError) {
          setItems(rows => rows.map(item => item.id === editing.id ? before : item));
          throw saveError;
        }
      }}
    />}
  </div>;
}

function UtensilTile({ name }: { name: string }) {
  return <span className="text-3xl font-bold tracking-tight">{name.trim().slice(0, 2).toUpperCase()}</span>;
}
