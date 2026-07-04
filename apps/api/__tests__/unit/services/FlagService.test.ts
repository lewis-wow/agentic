import { prisma } from '@repo/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupProject,
  cleanupUser,
  createTestEnvironment,
  createTestProject,
  createTestUser,
} from '../../helpers/fixtures.js';

import {
  FlagKeyConflict,
  FlagKeyRequired,
  FlagNameRequired,
  FlagNotFound,
  InvalidFlagKey,
} from '../../../src/exceptions/index.js';
import { FlagService } from '../../../src/services/FlagService.js';

let projectId: string;
let userId: string;
let emitFlagEvent: ReturnType<typeof vi.fn>;
let service: FlagService;

beforeEach(async () => {
  const project = await createTestProject();
  const user = await createTestUser();
  projectId = project.id;
  userId = user.id;
  emitFlagEvent = vi.fn();
  service = new FlagService({ prisma, emitFlagEvent });
});

afterEach(async () => {
  await cleanupProject(projectId);
  await cleanupUser(userId);
});

describe('FlagService.create', () => {
  it('creates a flag with an inactive boolean FlagState per existing environment', async () => {
    await createTestEnvironment(projectId, 'development');
    await createTestEnvironment(projectId, 'production');

    const { flag } = await service.create({
      projectId,
      userId,
      key: 'dark-mode',
      name: 'Dark Mode',
    });

    expect(flag.key).toBe('dark-mode');
    expect(flag.name).toBe('Dark Mode');

    const states = await prisma.flagState.findMany({ where: { flagId: flag.id } });
    expect(states).toHaveLength(2);
    expect(states.every((s) => s.status === 'inactive' && s.type === 'boolean')).toBe(true);
  });

  it('writes a flag.created audit event', async () => {
    const { flag } = await service.create({
      projectId,
      userId,
      key: 'dark-mode',
      name: 'Dark Mode',
    });

    const events = await prisma.auditEvent.findMany({ where: { flagId: flag.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'flag.created', userId });
  });

  it('emits a flag_created event', async () => {
    await service.create({ projectId, userId, key: 'dark-mode', name: 'Dark Mode' });

    expect(emitFlagEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        environmentId: null,
        type: 'flag_created',
        payload: expect.objectContaining({ key: 'dark-mode', enabled: false }),
      }),
    );
  });

  it('throws FlagKeyRequired when key is missing', async () => {
    await expect(
      service.create({ projectId, userId, key: '', name: 'Dark Mode' }),
    ).rejects.toBeInstanceOf(FlagKeyRequired);
  });

  it('throws FlagNameRequired when name is missing', async () => {
    await expect(
      service.create({ projectId, userId, key: 'dark-mode', name: '' }),
    ).rejects.toBeInstanceOf(FlagNameRequired);
  });

  it('throws InvalidFlagKey for an uppercase or otherwise invalid key', async () => {
    await expect(
      service.create({ projectId, userId, key: 'Dark_Mode', name: 'Dark Mode' }),
    ).rejects.toBeInstanceOf(InvalidFlagKey);
  });

  it('throws FlagKeyConflict when the key already exists in the project', async () => {
    await service.create({ projectId, userId, key: 'dark-mode', name: 'Dark Mode' });

    await expect(
      service.create({ projectId, userId, key: 'dark-mode', name: 'Another' }),
    ).rejects.toBeInstanceOf(FlagKeyConflict);
  });
});

describe('FlagService.get', () => {
  it('returns the flag with its states, one per environment', async () => {
    await createTestEnvironment(projectId, 'development');
    const { flag: created } = await service.create({
      projectId,
      userId,
      key: 'dark-mode',
      name: 'Dark Mode',
    });

    const { flag } = await service.get({ projectId, flagId: created.id });

    expect(flag.key).toBe('dark-mode');
    expect(flag.states).toHaveLength(1);
    expect(flag.states[0]).toMatchObject({
      environmentName: 'development',
      status: 'inactive',
      type: 'boolean',
      rollout: 0,
      rules: [],
    });
  });

  it('throws FlagNotFound for a flag id that does not exist', async () => {
    await expect(
      service.get({ projectId, flagId: 'does-not-exist' }),
    ).rejects.toBeInstanceOf(FlagNotFound);
  });

  it('throws FlagNotFound when the flag belongs to a different project', async () => {
    const { flag } = await service.create({
      projectId,
      userId,
      key: 'dark-mode',
      name: 'Dark Mode',
    });
    const otherProject = await createTestProject();

    try {
      await expect(
        service.get({ projectId: otherProject.id, flagId: flag.id }),
      ).rejects.toBeInstanceOf(FlagNotFound);
    } finally {
      await cleanupProject(otherProject.id);
    }
  });
});
