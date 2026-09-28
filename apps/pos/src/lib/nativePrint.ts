import { registerPlugin } from '@capacitor/core';

export interface NovaPrintPluginType {
  requestBluetoothPermissions(): Promise<{ granted: boolean; requested?: boolean }>;
  listPairedDevices(): Promise<{ devices: Array<{ name: string; address: string }> }>;
  connectBluetooth(options: { address: string }): Promise<{ connected: boolean; address: string; name: string }>;
  disconnectBluetooth(): Promise<{ connected: boolean }>;
  isBluetoothConnected(): Promise<{ connected: boolean; address?: string; name?: string }>;
  printRawEscPos(options: { data: string }): Promise<{ success: boolean; bytesPrinted: number }>;
  printHtml(options: { html: string; title?: string }): Promise<void>;
}

export const NovaPrint = registerPlugin<NovaPrintPluginType>('NovaPrint');

