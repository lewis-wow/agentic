import { EventEmitter } from 'node:events';

export type FlagStreamEvent = {
  id: number;
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

export const flagEmitter = new EventEmitter() as EventEmitter &
  TypedFlagEmitter;

let nextEventId = 0;

const ringBuffers = new Map<string, FlagStreamEvent[]>();

export const emitFlagEvent = (
  event: Omit<FlagStreamEvent, 'id'>,
): FlagStreamEvent => {
  const id = ++nextEventId;
  const fullEvent: FlagStreamEvent = { ...event, id };

  const buf = ringBuffers.get(fullEvent.projectId) ?? [];
  buf.push(fullEvent);
  if (buf.length > 500) buf.shift();
  ringBuffers.set(fullEvent.projectId, buf);

  flagEmitter.emit('flag-event', fullEvent);
  return fullEvent;
};

export const getRingBuffer = (projectId: string): readonly FlagStreamEvent[] =>
  ringBuffers.get(projectId) ?? [];

export const _resetForTesting = (): void => {
  nextEventId = 0;
  ringBuffers.clear();
};
