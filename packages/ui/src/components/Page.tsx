'use client';

import { Stack } from '@repo/ui/components/Stack';
import type { ReactNode } from 'react';

export type PageProps = {
  children?: ReactNode;
};

export const Page = ({ children }: PageProps) => {
  return (
    <div className="container min-h-screen bg-background p-4 mx-auto">
      <div className="mx-auto max-w-4xl space-y-8">
        <Stack direction="column" gap="1rem" asChild>
          <main>{children}</main>
        </Stack>
      </div>
    </div>
  );
};
