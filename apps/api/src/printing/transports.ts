import { Socket } from 'node:net';
import { Logger } from '@nestjs/common';

/**
 * Printer transports.
 *
 * The server can only reach network printers directly. Bluetooth and USB
 * printers are attached to a device (a phone, a tablet, a till PC), so those
 * jobs are queued and collected by that device — the mobile app and the POS
 * both poll for jobs addressed to their printers and do the actual writing.
 * This is why `PrintJob` stores the fully rendered payload rather than a
 * reference: the device that prints it may be a different machine entirely.
 */
export interface PrintTransport {
  send(bytes: Uint8Array): Promise<void>;
  probe(): Promise<boolean>;
}

const logger = new Logger('PrintTransport');

/**
 * Raw TCP on port 9100 — the near-universal protocol for network thermal
 * printers. There is no application-level acknowledgement in ESC/POS over
 * 9100: a successful write means the bytes left the socket, not that paper
 * moved. Real confirmation needs the printer's status-back channel (`DLE EOT`),
 * which only some models implement; `probe()` uses it where available.
 */
export class NetworkPrinterTransport implements PrintTransport {
  constructor(
    private readonly host: string,
    private readonly port = 9100,
    private readonly timeoutMs = 5000,
  ) {}

  send(bytes: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        err ? reject(err) : resolve();
      };

      socket.setTimeout(this.timeoutMs);
      socket.once('timeout', () =>
        done(new Error(`Printer at ${this.host}:${this.port} did not respond within ${this.timeoutMs}ms.`)));
      socket.once('error', (err) =>
        done(new Error(`Cannot reach printer at ${this.host}:${this.port} — ${err.message}`)));

      socket.connect(this.port, this.host, () => {
        socket.write(Buffer.from(bytes), (err) => {
          if (err) return done(err);
          // Give the printer a moment to drain before closing; some cheap
          // firmware truncates the tail if the socket shuts immediately.
          setTimeout(() => done(), 150);
        });
      });
    });
  }

  /** DLE EOT 1 — transmit printer status. Not every model answers. */
  async probe(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let answered = false;
      socket.setTimeout(2000);
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
      socket.once('data', () => { answered = true; socket.destroy(); resolve(true); });
      socket.connect(this.port, this.host, () => {
        socket.write(Buffer.from([0x10, 0x04, 0x01]));
        // Connecting at all is meaningful even without a status reply.
        setTimeout(() => { if (!answered) { socket.destroy(); resolve(true); } }, 1200);
      });
    });
  }
}

/**
 * A transport for printers physically attached to a client device.
 * The server never writes bytes here; it marks the job as awaiting collection.
 */
export class DeviceCollectedTransport implements PrintTransport {
  async send(): Promise<void> {
    throw new Error('DEVICE_COLLECTED');
  }
  async probe(): Promise<boolean> {
    return true;
  }
}

/** Records what it was asked to print. Used by tests and by `--dry-run`. */
export class InMemoryTransport implements PrintTransport {
  public readonly sent: Uint8Array[] = [];
  constructor(private readonly failTimes = 0) {}
  private attempts = 0;

  async send(bytes: Uint8Array): Promise<void> {
    this.attempts += 1;
    if (this.attempts <= this.failTimes) {
      throw new Error(`Simulated printer failure (attempt ${this.attempts})`);
    }
    this.sent.push(bytes);
  }
  async probe(): Promise<boolean> { return true; }
}

export function transportFor(printer: {
  connection: string; address: string | null; port: number;
}): PrintTransport {
  switch (printer.connection) {
    case 'NETWORK':
      if (!printer.address) throw new Error('A network printer needs an IP address or hostname.');
      return new NetworkPrinterTransport(printer.address, printer.port);
    case 'BLUETOOTH':
    case 'USB':
    case 'BROWSER':
      return new DeviceCollectedTransport();
    default:
      throw new Error(`Unknown printer connection type: ${printer.connection}`);
  }
}
