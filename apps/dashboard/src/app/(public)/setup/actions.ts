'use server';

import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

import { auth, MEMBER_ROLE } from '../../../lib/auth.js';

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

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return { error: 'Setup has already been completed. Please log in.' };
  }

  const result = await auth.api.signUpEmail({
    body: {
      name: name.trim(),
      email: email.trim(),
      password,
      role: MEMBER_ROLE.OWNER,
    },
  });

  if (!result?.user) {
    return { error: 'Failed to create account. Please try again.' };
  }

  await prisma.project.create({
    data: { name: projectName.trim() },
  });

  redirect('/login?setup=done');
};
