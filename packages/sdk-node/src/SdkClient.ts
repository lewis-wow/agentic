import {
  type FlagType,
  FLAG_TYPE,
  FlagSnapshotResponseSchema,
} from '@repo/api';
import { Schema } from 'effect';

import { bucket } from './bucket.js';
import { ClientNotConnected } from './exceptions/ClientNotConnected.js';
import { ConnectFailed } from './exceptions/ConnectFailed.js';

export type SdkClientOptions = {
  apiUrl: string;
  apiKey: string;
};

type FlagEntry = {
  enabled: boolean;
  type: FlagType;
  rollout: number;
};

export class SdkClient {
  private connected: boolean = false;
  private flags: Map<string, FlagEntry> = new Map();

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

    this.flags = new Map(
      snapshot.flags.map((f) => [
        f.key,
        { enabled: f.enabled, type: f.type, rollout: f.rollout },
      ]),
    );
    this.connected = true;
  }

  isEnabled(key: string, context?: Record<string, string>): boolean {
    if (!this.connected) {
      throw new ClientNotConnected();
    }

    const flag = this.flags.get(key);
    if (!flag) return false;
    if (!flag.enabled) return false;

    if (flag.type === FLAG_TYPE.PERCENTAGE_ROLLOUT) {
      const userId = context?.['userId'];
      if (!userId) return false;
      return bucket(key, userId) < flag.rollout;
    }

    return flag.enabled;
  }
}
