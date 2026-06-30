import { FlagSnapshotResponseSchema } from '@repo/api';
import { Schema } from 'effect';

import { ClientNotConnected } from './exceptions/ClientNotConnected.js';
import { ConnectFailed } from './exceptions/ConnectFailed.js';

export type SdkClientOptions = {
  apiUrl: string;
  apiKey: string;
};

export class SdkClient {
  private connected: boolean = false;
  private flags: Map<string, boolean> = new Map();

  constructor(private readonly options: SdkClientOptions) {}

  async connect(): Promise<void> {
    const { apiUrl, apiKey } = this.options;

    let response: Response;

    try {
      response = await fetch(`${apiUrl}/v1/flags`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (cause) {
      throw new ConnectFailed({ cause });
    }

    if (!response.ok) {
      throw new ConnectFailed();
    }

    const json: unknown = await response.json();
    const snapshot = Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(json);

    this.flags = new Map(snapshot.flags.map((f) => [f.key, f.enabled]));
    this.connected = true;
  }

  isEnabled(key: string, _context?: Record<string, string>): boolean {
    if (!this.connected) {
      throw new ClientNotConnected();
    }

    return this.flags.get(key) ?? false;
  }
}
