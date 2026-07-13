import type { SystemRole } from '@repo/auth/roles';
import type { PrismaClient, User } from '@repo/prisma';

export type UserServiceOptions = {
  prisma: PrismaClient;
};

export type UpsertUserArgs = {
  email: string;
  role: SystemRole;
};

export class UserService {
  constructor(private readonly options: UserServiceOptions) {}

  // Empty `update` clause: JIT-provisions a new user on first sight without
  // ever overwriting an existing user's role on subsequent sightings.
  upsert(args: UpsertUserArgs): Promise<User> {
    const { email, role } = args;

    return this.options.prisma.user.upsert({
      where: { email },
      create: { email, name: email, role },
      update: {},
    });
  }
}
