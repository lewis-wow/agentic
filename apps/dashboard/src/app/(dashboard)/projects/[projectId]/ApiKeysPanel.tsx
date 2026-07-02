'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { ApiKeyReveal } from '../../../../components/ApiKeyReveal';
import { useRotateApiKey } from '../../../../queries/environments';
import { useProject, type Environment } from '../../../../queries/projects';

type Props = {
  projectId: string;
  canManage: boolean;
};

export const ApiKeysPanel = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const { data: project } = useProject(projectId);
  const environments = project?.environments ?? [];
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Keys authenticate SDKs against a specific environment. Full keys are
            shown once, at creation or rotation.
          </p>
        </div>
      </div>

      {revealedKey && (
        <ApiKeyReveal fullKey={revealedKey} label="API key rotated" />
      )}

      {environments.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>No API keys</EmptyTitle>
            <EmptyDescription>
              Create an environment to get its API key.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Key</TableHead>
                  {canManage && (
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {environments.map((env) => (
                  <ApiKeyRow
                    key={env.id}
                    projectId={projectId}
                    environment={env}
                    canManage={canManage}
                    onRotated={setRevealedKey}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

type ApiKeyRowProps = {
  projectId: string;
  environment: Environment;
  canManage: boolean;
  onRotated: (fullKey: string) => void;
};

const ApiKeyRow = ({
  projectId,
  environment,
  canManage,
  onRotated,
}: ApiKeyRowProps): React.ReactNode => {
  const rotateMutation = useRotateApiKey(projectId);

  return (
    <TableRow>
      <TableCell className="font-medium">{environment.name} key</TableCell>
      <TableCell>
        <Badge variant="outline">{environment.name}</Badge>
      </TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          env_{environment.apiKeyId}.••••••••
        </code>
      </TableCell>
      {canManage && (
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            disabled={rotateMutation.isPending}
            onClick={() =>
              rotateMutation.mutate(environment.id, {
                onSuccess: (data) => onRotated(data.fullKey),
              })
            }
          >
            <RefreshCw />
            <span className="sr-only">Rotate API key</span>
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
};
