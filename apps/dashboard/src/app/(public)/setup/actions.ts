'use server';

import { generateApiKey } from '@repo/auth/api-key';
import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

import { auth } from '../../../lib/auth';

export type SetupActionState = {
  error?: string;
};

export const setupAction = async (
  _prev: SetupActionState,
  formData: FormData,
): Promise<SetupActionState> => {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const projectName = formData.get('projectName');

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof projectName !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    !password.trim() ||
    !projectName.trim()
  ) {
    return { error: 'All fields are required.' };
  }

  // Guard against a second owner being created via a race or replay.
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return { error: 'Setup has already been completed. Please log in.' };
  }

  // Sign-up creates the user (defaults to MEMBER) and an active session cookie
  // via the nextCookies plugin — this signs the owner in.
  const result = await auth.api.signUpEmail({
    body: {
      name: name.trim(),
      email: email.trim(),
      password,
    },
  });

  if (!result?.user) {
    return { error: 'Failed to create account. Please try again.' };
  }

  // Promote the first user to the system OWNER role (role is never trusted
  // from client input, so it is set server-side here).
  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: SYSTEM_ROLE.OWNER },
  });

  const [devKey, prodKey] = await Promise.all([
    generateApiKey(),
    generateApiKey(),
  ]);

  await prisma.project.create({
    data: {
      name: projectName.trim(),
      environments: {
        create: [
          {
            name: 'development',
            apiKeyId: devKey.apiKeyId,
            apiKeyHash: devKey.apiKeyHash,
          },
          {
            name: 'production',
            apiKeyId: prodKey.apiKeyId,
            apiKeyHash: prodKey.apiKeyHash,
          },
        ],
      },
    },
  });

  redirect('/dashboard');
};
