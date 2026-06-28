import { Slot } from '@radix-ui/react-slot';
import { cn } from '@repo/ui/lib/utils';
import type { ValueOfEnum } from '@repo/types';
import type { ReactNode } from 'react';

export const STACK_PREDEFINED_GAP = {
  BETWEEN: 'BETWEEN',
  AROUND: 'AROUND',
  EVENLY: 'EVENLY',
} as const;

export type StackPredefinedGap = ValueOfEnum<typeof STACK_PREDEFINED_GAP>;

export type StackProps = {
  direction: 'row' | 'column';
  gap: StackPredefinedGap | (string & Record<never, never>);
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
};

export const Stack = ({
  children,
  className,
  direction,
  gap,
  asChild,
  ...props
}: StackProps) => {
  const Component = asChild ? Slot : 'div';

  return (
    <Component
      className={cn(
        'flex h-full w-full',
        {
          'flex-col': direction === 'column',
          'flex-row': direction === 'row',
          'justify-between': gap === STACK_PREDEFINED_GAP.BETWEEN,
          'justify-around': gap === STACK_PREDEFINED_GAP.AROUND,
          'justify-evenly': gap === STACK_PREDEFINED_GAP.EVENLY,
        },
        className,
      )}
      style={{
        gap: (Object.values(STACK_PREDEFINED_GAP) as string[]).includes(gap)
          ? undefined
          : gap,
      }}
      {...props}
    >
      {children}
    </Component>
  );
};
