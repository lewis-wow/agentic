import { beforeEach, describe, expect, it } from 'vitest';

import {
  _resetForTesting,
  emitFlagEvent,
  getRingBuffer,
} from '../../src/events/emitter.js';

describe('ring buffer', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it('never exceeds 500 events per project', () => {
    for (let i = 0; i < 550; i++) {
      emitFlagEvent({
        projectId: 'proj-1',
        environmentId: null,
        type: 'flag_created',
        payload: { key: `flag-${i}`, enabled: false },
      });
    }

    const buf = getRingBuffer('proj-1');
    expect(buf.length).toBe(500);
  });

  it('evicts oldest events on overflow, keeping most recent', () => {
    for (let i = 0; i < 502; i++) {
      emitFlagEvent({
        projectId: 'proj-1',
        environmentId: null,
        type: 'flag_created',
        payload: { key: `flag-${i}`, enabled: false },
      });
    }

    const buf = getRingBuffer('proj-1');
    // First 2 events (i=0, i=1) should have been evicted
    expect(buf[0].payload.key).toBe('flag-2');
    expect(buf[buf.length - 1].payload.key).toBe('flag-501');
  });

  it('keeps separate ring buffers per project', () => {
    for (let i = 0; i < 3; i++) {
      emitFlagEvent({
        projectId: 'proj-1',
        environmentId: null,
        type: 'flag_created',
        payload: { key: `p1-flag-${i}`, enabled: false },
      });
    }
    for (let i = 0; i < 2; i++) {
      emitFlagEvent({
        projectId: 'proj-2',
        environmentId: null,
        type: 'flag_created',
        payload: { key: `p2-flag-${i}`, enabled: false },
      });
    }

    expect(getRingBuffer('proj-1')).toHaveLength(3);
    expect(getRingBuffer('proj-2')).toHaveLength(2);
  });
});
