'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export const ThemeToggle = (): React.ReactNode => {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the resolved theme after mount; render a
  // placeholder first so server and client markup match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Skeleton className="h-9 w-[228px]" />;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border p-1">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={isActive ? 'secondary' : 'ghost'}
            className="gap-1.5"
            onClick={() => setTheme(option.value)}
          >
            <Icon className="size-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};
