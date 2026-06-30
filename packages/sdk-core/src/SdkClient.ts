import {
  type FlagType,
  type TargetingRule,
  FLAG_TYPE,
  FlagSnapshotResponseSchema,
} from '@repo/api';
import { Schema } from 'effect';
import { type EventSourceFetchInit, EventSource } from 'eventsource';

import { ClientNotConnected } from './exceptions/ClientNotConnected.js';
import { ConnectFailed } from './exceptions/ConnectFailed.js';

export type SdkClientOptions = {
  apiUrl: string;
  apiKey: string;
  connectTimeout?: number;
};

export type FlagChangeDetail = { key: string };

type FlagEntry = {
  enabled: boolean;
  type: FlagType;
  rollout: number;
  rules: TargetingRule[];
};

type SSEPayload = {
  key: string;
  enabled?: boolean;
  type?: string;
  rollout?: number;
  rules?: unknown[];
};

const evaluateRule = (
  rule: TargetingRule,
  context: Record<string, string>,
): boolean => {
  const actual = context[rule.attribute];
  if (actual === undefined) return false;

  switch (rule.operator) {
    case 'EQ':
      return actual === rule.value[0];
    case 'NEQ':
      return actual !== rule.value[0];
    case 'IN':
      return rule.value.includes(actual);
    case 'NOT_IN':
      return !rule.value.includes(actual);
    case 'CONTAINS':
      return actual.includes(rule.value[0] ?? '');
  }
};

const toFlagType = (raw: string | undefined): FlagType => {
  if (raw === 'percentage_rollout') return 'percentage_rollout';
  if (raw === 'targeted') return 'targeted';
  return 'boolean';
};

export class SdkClient extends EventTarget {
  private es: InstanceType<typeof EventSource> | null = null;
  private flags: Map<string, FlagEntry> = new Map();
  private connected: boolean = false;

  constructor(private readonly options: SdkClientOptions) {
    super();
  }

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const { apiUrl, apiKey, connectTimeout = 10_000 } = this.options;

      const es = new EventSource(`${apiUrl}/v1/flags/stream`, {
        fetch: (url: string | URL, init: EventSourceFetchInit) =>
          globalThis.fetch(url, {
            ...init,
            headers: {
              ...(init.headers ?? {}),
              Authorization: `Bearer ${apiKey}`,
            },
          }),
      });

      let settled = false;

      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn();
      };

      const timeoutId = setTimeout(() => {
        settle(() => {
          es.close();
          reject(new ConnectFailed());
        });
      }, connectTimeout);

      es.addEventListener('error', (rawEvent: Event) => {
        const event = rawEvent as Event & { code?: number };
        if (event.code !== undefined) {
          settle(() => {
            es.close();
            reject(new ConnectFailed());
          });
        }
      });

      es.addEventListener('snapshot', (rawEvent: Event) => {
        const event = rawEvent as MessageEvent;
        settle(() => {
          try {
            const json: unknown = JSON.parse(event.data as string);
            const snapshot = Schema.decodeUnknownSync(
              FlagSnapshotResponseSchema,
            )(json);
            this.flags = new Map(
              snapshot.flags.map((f) => [
                f.key,
                {
                  enabled: f.enabled,
                  type: f.type,
                  rollout: f.rollout,
                  rules: f.rules as TargetingRule[],
                },
              ]),
            );
            this.connected = true;
            this.es = es;
            this.registerLiveHandlers(es);
            resolve();
          } catch (cause) {
            es.close();
            reject(new ConnectFailed({ cause }));
          }
        });
      });
    });
  }

  private registerLiveHandlers(es: InstanceType<typeof EventSource>): void {
    const patch = (rawEvent: Event): void => {
      const event = rawEvent as MessageEvent;
      const payload = JSON.parse(event.data as string) as SSEPayload;
      const { key } = payload;

      switch (event.type) {
        case 'flag_created':
        case 'flag_updated':
        case 'flag_unarchived':
          this.flags.set(key, {
            enabled: payload.enabled ?? false,
            type: toFlagType(payload.type),
            rollout: payload.rollout ?? 0,
            rules: (payload.rules as TargetingRule[]) ?? [],
          });
          break;
        case 'flag_archived':
        case 'flag_deleted':
          this.flags.delete(key);
          break;
      }

      this.dispatchEvent(
        new CustomEvent<FlagChangeDetail>('change', { detail: { key } }),
      );
    };

    es.addEventListener('flag_created', patch);
    es.addEventListener('flag_updated', patch);
    es.addEventListener('flag_archived', patch);
    es.addEventListener('flag_unarchived', patch);
    es.addEventListener('flag_deleted', patch);
  }

  disconnect(): void {
    this.es?.close();
    this.es = null;
    this.flags.clear();
    this.connected = false;
  }

  async isEnabled(
    key: string,
    context?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.connected) {
      throw new ClientNotConnected();
    }

    const flag = this.flags.get(key);
    if (!flag) return false;
    if (!flag.enabled) return false;

    if (flag.type === FLAG_TYPE.TARGETED) {
      if (flag.rules.length === 0) return false;
      return flag.rules.every((rule) => evaluateRule(rule, context ?? {}));
    }

    if (flag.type === FLAG_TYPE.PERCENTAGE_ROLLOUT) {
      const userId = context?.['userId'];
      if (!userId) return false;
      return (await bucket(key, userId)) < flag.rollout;
    }

    return flag.enabled;
  }
}

const bucket = async (flagKey: string, userId: string): Promise<number> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${flagKey}/${userId}`);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const view = new DataView(hashBuffer);
  return view.getUint32(0) % 100;
};
