import { EventEmitter } from 'node:events';

export type FlagStreamEvent = {
  id: bigint;
  projectId: string;
  environmentId: string | null;
  type:
    | 'flag_created'
    | 'flag_updated'
    | 'flag_archived'
    | 'flag_unarchived'
    | 'flag_deleted';
  payload: {
    key: string;
    enabled?: boolean;
    type?: string;
    rollout?: number;
    rules?: unknown[];
  };
};

type TypedFlagEmitter = {
  on(
    event: 'flag-event',
    listener: (e: FlagStreamEvent) => void,
  ): TypedFlagEmitter;
  off(
    event: 'flag-event',
    listener: (e: FlagStreamEvent) => void,
  ): TypedFlagEmitter;
  emit(event: 'flag-event', e: FlagStreamEvent): boolean;
};

// Live in-process broadcast to already-connected SSE clients — a bare
// EventEmitter singleton with no injected dependencies. See
// docs/adr/0021-flag-event-bus-lives-in-packages-api.md for why this stays a
// singleton rather than following the constructor-injected services
// convention: there's nothing here to swap, and constructing one instance
// per route file would silently fragment the bus, since events emitted on
// one instance would never reach listeners registered on another.
export const flagEmitter = new EventEmitter() as EventEmitter &
  TypedFlagEmitter;

// `event.id` must already be allocated (via FlagEventService) and persisted
// before this is called — see docs/adr/0020-durable-sse-replay-via-postgres.md.
export const emitFlagEvent = (event: FlagStreamEvent): void => {
  flagEmitter.emit('flag-event', event);
};
