import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('stops a camera permission request that resolves after the scanner is closed', async () => {
  let finish!: (stream: MediaStream) => void;
  const stop = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(resolve => { finish = resolve; }) } });
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => { root.render(<CameraBarcodeScanner isOpen onClose={() => {}} onScan={() => {}} />); });
  await act(async () => { root.unmount(); });
  await act(async () => { finish({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
  expect(stop).toHaveBeenCalledOnce();
});
