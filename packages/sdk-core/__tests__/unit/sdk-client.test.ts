import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ClientNotConnected,
  ConnectFailed,
  createClient,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Hoisted mock — must run before any module is imported
// ---------------------------------------------------------------------------
const mockES = vi.hoisted(() => {
  let lastInstance: {
    url: string;
    readyState: number;
    fireEvent: (type: string, data: string) => void;
    fireError: (code?: number) => void;
    close: () => void;
    isClosed: () => boolean;
  } | null = null;

  class MockEventSource extends EventTarget {
    static CONNECTING = 0 as const;
    static OPEN = 1 as const;
    static CLOSED = 2 as const;

    readonly url: string;
    readyState: number = MockEventSource.CONNECTING;

    constructor(url: string, _opts?: unknown) {
      super();
      this.url = url;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastInstance = this;
    }

    fireEvent(type: string, data: string): void {
      this.dispatchEvent(new MessageEvent(type, { data }));
    }

    fireError(code?: number): void {
      this.dispatchEvent(Object.assign(new Event('error'), { code }));
    }

    close(): void {
      this.readyState = MockEventSource.CLOSED;
    }

    isClosed(): boolean {
      return this.readyState === MockEventSource.CLOSED;
    }
  }

  return {
    MockEventSource,
    get current() {
      return lastInstance;
    },
    reset() {
      lastInstance = null;
    },
  };
});

vi.mock('eventsource', () => ({ EventSource: mockES.MockEventSource }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeClient = (opts?: { connectTimeout?: number }) =>
  createClient({
    apiUrl: 'http://api:3001',
    apiKey: 'env_test.secret',
    ...opts,
  });

const makeSnapshot = (
  flags: {
    key: string;
    enabled: boolean;
    type: string;
    rollout: number;
    rules?: unknown[];
  }[],
): string => JSON.stringify({ flags: flags.map((f) => ({ rules: [], ...f })) });

beforeEach(() => {
  mockES.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// isEnabled() — before connect
// ---------------------------------------------------------------------------
describe('isEnabled()', () => {
  it('throws ClientNotConnected before connect() is called', async () => {
    const client = makeClient();
    await expect(client.isEnabled('some-flag')).rejects.toThrow(
      ClientNotConnected,
    );
  });
});

// ---------------------------------------------------------------------------
// connect()
// ---------------------------------------------------------------------------
describe('connect()', () => {
  it('resolves after the first snapshot SSE event is received', async () => {
    const client = makeClient();
    const connectPromise = client.connect();

    await Promise.resolve();

    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        { key: 'flag-a', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );

    await connectPromise;

    expect(await client.isEnabled('flag-a')).toBe(true);
  });

  it('rejects with ConnectFailed when an HTTP error fires (event.code set)', async () => {
    const client = makeClient();
    const connectPromise = client.connect();

    await Promise.resolve();
    mockES.current!.fireError(401);

    await expect(connectPromise).rejects.toThrow(ConnectFailed);
  });

  it('rejects with ConnectFailed when connectTimeout elapses before snapshot', async () => {
    vi.useFakeTimers();
    const client = makeClient({ connectTimeout: 100 });
    const connectPromise = client.connect();

    // Attach rejection handler before advancing time to avoid unhandled-rejection warning
    const assertion = expect(connectPromise).rejects.toThrow(ConnectFailed);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
  });

  it('closes the EventSource when rejecting due to HTTP error', async () => {
    const client = makeClient();
    const connectPromise = client.connect();

    await Promise.resolve();
    mockES.current!.fireError(403);

    await expect(connectPromise).rejects.toThrow(ConnectFailed);
    expect(mockES.current!.isClosed()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// disconnect()
// ---------------------------------------------------------------------------
describe('disconnect()', () => {
  it('closes the EventSource and subsequent isEnabled() throws ClientNotConnected', async () => {
    const client = makeClient();
    const connectPromise = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        { key: 'flag-a', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );
    await connectPromise;

    client.disconnect();

    await expect(client.isEnabled('flag-a')).rejects.toThrow(
      ClientNotConnected,
    );
    expect(mockES.current!.isClosed()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isEnabled() — after connect
// ---------------------------------------------------------------------------
describe('isEnabled() — boolean flag', () => {
  it('returns true for an active boolean flag in the snapshot', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        { key: 'dark-mode', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );
    await cp;
    expect(await client.isEnabled('dark-mode')).toBe(true);
  });

  it('returns false for an inactive boolean flag', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        { key: 'dark-mode', enabled: false, type: 'boolean', rollout: 0 },
      ]),
    );
    await cp;
    expect(await client.isEnabled('dark-mode')).toBe(false);
  });

  it('returns false for a key absent from the snapshot', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent('snapshot', makeSnapshot([]));
    await cp;
    expect(await client.isEnabled('nonexistent')).toBe(false);
  });
});

describe('isEnabled() — percentage_rollout flag', () => {
  // WebCrypto SHA-256 of 'rollout-flag/user-0' → first uint32 big-endian % 100 = 15
  // WebCrypto SHA-256 of 'rollout-flag/user-1' → first uint32 big-endian % 100 = 94

  it('returns true when user bucket is below the rollout percentage', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );
    await cp;
    // user-0 has bucket 15 < 50
    expect(await client.isEnabled('rollout-flag', { userId: 'user-0' })).toBe(
      true,
    );
  });

  it('returns false when user bucket is at or above the rollout percentage', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );
    await cp;
    // user-1 has bucket 94 >= 50
    expect(await client.isEnabled('rollout-flag', { userId: 'user-1' })).toBe(
      false,
    );
  });

  it('returns false when userId is absent from context', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );
    await cp;
    expect(await client.isEnabled('rollout-flag')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 'change' CustomEvent
// ---------------------------------------------------------------------------
describe("'change' CustomEvent", () => {
  const connectAndGetClient = async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent('snapshot', makeSnapshot([]));
    await cp;
    return client;
  };

  it('dispatches change with detail.key on flag_created', async () => {
    const client = await connectAndGetClient();
    const changes: string[] = [];
    client.addEventListener('change', (e) => {
      changes.push((e as CustomEvent<{ key: string }>).detail.key);
    });

    mockES.current!.fireEvent(
      'flag_created',
      JSON.stringify({
        key: 'new-flag',
        enabled: false,
        type: 'boolean',
        rollout: 0,
        rules: [],
      }),
    );

    expect(changes).toEqual(['new-flag']);
    expect(await client.isEnabled('new-flag')).toBe(false);
  });

  it('dispatches change with detail.key on flag_updated and updates the flag', async () => {
    const client = await connectAndGetClient();
    const changes: string[] = [];
    client.addEventListener('change', (e) => {
      changes.push((e as CustomEvent<{ key: string }>).detail.key);
    });

    mockES.current!.fireEvent(
      'flag_updated',
      JSON.stringify({
        key: 'some-flag',
        enabled: true,
        type: 'boolean',
        rollout: 0,
        rules: [],
      }),
    );

    expect(changes).toEqual(['some-flag']);
    expect(await client.isEnabled('some-flag')).toBe(true);
  });

  it('dispatches change with detail.key on flag_archived and removes the flag', async () => {
    // Start with a flag in the snapshot
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        { key: 'bye-flag', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );
    await cp;

    const changes: string[] = [];
    client.addEventListener('change', (e) => {
      changes.push((e as CustomEvent<{ key: string }>).detail.key);
    });

    mockES.current!.fireEvent(
      'flag_archived',
      JSON.stringify({ key: 'bye-flag' }),
    );

    expect(changes).toEqual(['bye-flag']);
    expect(await client.isEnabled('bye-flag')).toBe(false);
  });

  it('dispatches change with detail.key on flag_unarchived and restores the flag', async () => {
    const client = await connectAndGetClient();
    const changes: string[] = [];
    client.addEventListener('change', (e) => {
      changes.push((e as CustomEvent<{ key: string }>).detail.key);
    });

    mockES.current!.fireEvent(
      'flag_unarchived',
      JSON.stringify({
        key: 'restored-flag',
        enabled: true,
        type: 'boolean',
        rollout: 0,
        rules: [],
      }),
    );

    expect(changes).toEqual(['restored-flag']);
    expect(await client.isEnabled('restored-flag')).toBe(true);
  });

  it('dispatches change with detail.key on flag_deleted and removes the flag', async () => {
    const client = makeClient();
    const cp = client.connect();
    await Promise.resolve();
    mockES.current!.fireEvent(
      'snapshot',
      makeSnapshot([
        { key: 'gone-flag', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );
    await cp;

    const changes: string[] = [];
    client.addEventListener('change', (e) => {
      changes.push((e as CustomEvent<{ key: string }>).detail.key);
    });

    mockES.current!.fireEvent(
      'flag_deleted',
      JSON.stringify({ key: 'gone-flag' }),
    );

    expect(changes).toEqual(['gone-flag']);
    expect(await client.isEnabled('gone-flag')).toBe(false);
  });
});
