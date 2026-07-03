import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

type Props = {
  code: string;
  message: string;
  icon: LucideIcon;
  action?: { label: string; href: string };
};

export const ErrorPage = ({
  code,
  message,
  icon: Icon,
  action,
}: Props): React.ReactNode => {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent>
          <Empty className="border-none p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-full">
                <Icon />
              </EmptyMedia>
              <EmptyTitle className="text-4xl font-bold">{code}</EmptyTitle>
              <EmptyDescription>{message}</EmptyDescription>
            </EmptyHeader>
            {action && (
              <EmptyContent>
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
};
