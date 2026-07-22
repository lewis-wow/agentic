'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

export type DisabledButtonTooltipProps = {
  reason: string;
  children: React.ReactElement;
};

export const DisabledButtonTooltip = ({
  reason,
  children,
}: DisabledButtonTooltipProps): React.ReactNode => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
