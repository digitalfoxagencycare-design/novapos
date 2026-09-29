// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ItemEditor } from './CatalogWorkspace';
import type { MenuItem } from './types';

const item: MenuItem = {
  id: 'item-1',
  name: 'Bakery Box',
  description: 'Fresh daily',
  categoryId: 'category-1',
  priceMinor: 12000,
  packagingChargeMinor: 500,
  taxSlabId: 'gst-5',
  hsnSac: '996331',
  isActive: true,
  variants: [{
    id: 'variant-1', name: 'Large', priceMinor: 15000, priceDeltaMinor: 0, isDefault: true, isActive: true,
  }],
  modifierGroups: [{
    id: 'link-1',
    groupId: 'group-1',
    name: 'Addons',
    minSelect: 0,
    maxSelect: 2,
    isActive: true,
    modifiers: [{ id: 'modifier-1', name: 'Extra sauce', priceMinor: 200, isActive: true }],
  }],
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('submits item, packaging, variant, and modifier changes together', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  await act(async () => root.render(<ItemEditor
    item={item}
    categories={[{ id: 'category-1', name: 'Bakery' }]}
    onClose={onClose}
    onSave={onSave}
  />));
  await act(async () => {
    host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(onSave).toHaveBeenCalledWith({
    name: 'Bakery Box',
    description: 'Fresh daily',
    categoryId: 'category-1',
    priceMinor: 12000,
    packagingChargeMinor: 500,
    taxSlabId: 'gst-5',
    hsnSac: '996331',
    isActive: true,
    variants: [{ id: 'variant-1', name: 'Large', priceMinor: 15000, priceDeltaMinor: 0, isDefault: true }],
    modifierGroups: [{
      id: 'group-1',
      name: 'Addons',
      minSelect: 0,
      maxSelect: 2,
      modifiers: [{ id: 'modifier-1', name: 'Extra sauce', priceMinor: 200 }],
    }],
  });
  expect(onClose).toHaveBeenCalledOnce();
});

it('keeps the editor open and shows a clear error when the API rejects the save', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('Connection refused'));
  await act(async () => root.render(<ItemEditor
    item={item}
    categories={[{ id: 'category-1', name: 'Bakery' }]}
    onClose={vi.fn()}
    onSave={onSave}
  />));
  await act(async () => {
    host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Connection refused');
  expect(host.textContent).toContain('Couldn’t save item changes.');
});
