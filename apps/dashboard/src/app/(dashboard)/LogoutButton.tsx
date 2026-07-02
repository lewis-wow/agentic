'use client';

import { Button } from '@repo/ui/components/ui/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { authClient } from '../../lib/auth-client';

export const LogoutButton = (): React.ReactNode => {
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => void handleLogout()}
      aria-label="Sign out"
    >
      <LogOut />
    </Button>
  );
};
