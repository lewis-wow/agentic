'use client';

import { Button } from '@repo/ui/components/ui/button';
import { LogOut } from 'lucide-react';

type Props = {
  logoutUrl: string;
};

/**
 * Logout is the reverse proxy's job, not this app's — signing out means
 * navigating to the proxy's own sign-out endpoint (e.g. oauth2-proxy's
 * /oauth2/sign_out), which clears its session and re-prompts for auth.
 */
export const LogoutButton = ({ logoutUrl }: Props): React.ReactNode => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        window.location.href = logoutUrl;
      }}
      aria-label="Sign out"
    >
      <LogOut />
    </Button>
  );
};
