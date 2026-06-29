'use client';

import { useRouter } from 'next/navigation';

import { authClient } from '../../lib/auth-client.js';

export const LogoutButton = (): React.ReactNode => {
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button onClick={handleLogout} className="text-gray-500 hover:text-black">
      Sign out
    </button>
  );
};
