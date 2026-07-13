import { prisma } from '@repo/prisma';
import { describe, expect, it } from 'vitest';

import { EnvironmentNameConflict } from '../../../src/exceptions/index.js';
import { ProjectService } from '../../../src/services/ProjectService.js';
import { cleanupProject, createTestProject } from '../../helpers/fixtures.js';

describe('ProjectService.exists', () => {
  it('returns false when no projects exist', async () => {
    const service = new ProjectService({ prisma });

    await expect(service.exists()).resolves.toBe(false);
  });

  it('returns true when at least one project exists', async () => {
    const project = await createTestProject();
    const service = new ProjectService({ prisma });

    try {
      await expect(service.exists()).resolves.toBe(true);
    } finally {
      await cleanupProject(project.id);
    }
  });
});

describe('ProjectService.createWithEnvironments', () => {
  it('creates a project with all given environments in one call', async () => {
    const service = new ProjectService({ prisma });
    const name = `setup-project-${Date.now()}`;

    const { project } = await service.createWithEnvironments({
      name,
      environmentNames: ['development', 'production'],
    });

    try {
      expect(project.name).toBe(name);
      expect(project.environments.map((e) => e.name).sort()).toEqual([
        'development',
        'production',
      ]);
    } finally {
      await cleanupProject(project.id);
    }
  });

  it('rejects duplicate environment names without creating the project', async () => {
    const service = new ProjectService({ prisma });
    const name = `setup-rollback-${Date.now()}`;

    await expect(
      service.createWithEnvironments({
        name,
        environmentNames: ['development', 'development'],
      }),
    ).rejects.toBeInstanceOf(EnvironmentNameConflict);

    const projects = await prisma.project.findMany({ where: { name } });
    expect(projects).toHaveLength(0);
  });
});
