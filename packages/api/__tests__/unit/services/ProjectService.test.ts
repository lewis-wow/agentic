import { prisma } from '@repo/prisma';
import { describe, expect, it } from 'vitest';

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
