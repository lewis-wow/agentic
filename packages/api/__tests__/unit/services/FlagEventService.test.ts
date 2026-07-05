import { prisma } from '@repo/prisma';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FlagEventService,
  nextEventId,
} from '../../../src/services/FlagEventService.js';
import {
  cleanupProject,
  createTestEnvironment,
  createTestProject,
} from '../../helpers/fixtures.js';

describe('nextEventId', () => {
  it('returns strictly increasing values across calls', async () => {
    const ids = await prisma.$transaction(async (tx) => {
      const first = await nextEventId(tx);
      const second = await nextEventId(tx);
      const third = await nextEventId(tx);
      return [first, second, third];
    });

    expect(ids[1]).toBeGreaterThan(ids[0]);
    expect(ids[2]).toBeGreaterThan(ids[1]);
  });
});

describe('FlagEventService.getReplayEvents', () => {
  let projectId: string;
  let environmentId: string;
  let service: FlagEventService;

  beforeEach(async () => {
    const project = await createTestProject();
    const environment = await createTestEnvironment(project.id, 'production');
    projectId = project.id;
    environmentId = environment.id;
    service = new FlagEventService({ prisma });
  });

  afterEach(async () => {
    await cleanupProject(projectId);
  });

  it('includes a FlagState change when sinceId is older, excludes it when sinceId has caught up', async () => {
    const flag = await prisma.flag.create({
      data: { projectId, key: 'dark-mode', name: 'Dark Mode' },
    });
    const initial = await prisma.flagState.create({
      data: { flagId: flag.id, environmentId, status: 'inactive' },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const eventId = await nextEventId(tx);
      return tx.flagState.update({
        where: { id: initial.id },
        data: { status: 'active', eventId },
      });
    });

    const stillBehind = await service.getReplayEvents({
      projectId,
      environmentId,
      sinceId: initial.eventId,
    });
    expect(stillBehind).toContainEqual(
      expect.objectContaining({
        id: updated.eventId,
        type: 'flag_updated',
        payload: expect.objectContaining({ key: 'dark-mode', enabled: true }),
      }),
    );

    const caughtUp = await service.getReplayEvents({
      projectId,
      environmentId,
      sinceId: updated.eventId,
    });
    expect(caughtUp).toEqual([]);
  });

  it('surfaces a FlagDeletion tombstone as a removal, regardless of which environment is asked', async () => {
    const otherEnvironment = await createTestEnvironment(projectId, 'staging');

    const before = await nextEventId(prisma);
    const deletion = await prisma.flagDeletion.create({
      data: { projectId, key: 'old-flag' },
    });

    for (const envId of [environmentId, otherEnvironment.id]) {
      const events = await service.getReplayEvents({
        projectId,
        environmentId: envId,
        sinceId: before,
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          id: deletion.id,
          type: 'flag_deleted',
          payload: { key: 'old-flag' },
        }),
      );
    }
  });

  it('merges FlagState changes and FlagDeletion tombstones sorted by id', async () => {
    const before = await nextEventId(prisma);

    const flag = await prisma.flag.create({
      data: { projectId, key: 'kept-flag', name: 'Kept Flag' },
    });
    const state = await prisma.flagState.create({
      data: { flagId: flag.id, environmentId, status: 'active' },
    });
    const deletion = await prisma.flagDeletion.create({
      data: { projectId, key: 'removed-flag' },
    });

    const events = await service.getReplayEvents({
      projectId,
      environmentId,
      sinceId: before,
    });

    expect(events.map((e) => e.id)).toEqual([state.eventId, deletion.id]);
  });
});
