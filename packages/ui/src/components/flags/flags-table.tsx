'use client';

import { ConfigureFlagDialog } from '@/components/flags/configure-flag-dialog';
import { CreateFlagDialog } from '@/components/flags/create-flag-dialog';
import { EditFlagDialog } from '@/components/flags/edit-flag-dialog';
import { formatValue } from '@/components/flags/flag-value-input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore, useProjectEnvironments, useProjectFlags } from '@/lib/store';
import type { FeatureFlag, FlagType } from '@/lib/types';
import {
  Search,
  MoreHorizontal,
  Settings2,
  Pencil,
  Trash2,
  Flag,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

const TYPE_LABELS: Record<FlagType, string> = {
  boolean: 'Boolean',
  string: 'String',
  number: 'Number',
  json: 'JSON',
};

export function FlagsTable({ projectId }: { projectId: string }) {
  const flags = useProjectFlags(projectId);
  const environments = useProjectEnvironments(projectId);
  const { toggleFlag, deleteFlag } = useStore();

  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | FlagType>('all');
  const [envFilter, setEnvFilter] = React.useState<string>('all');

  const [configuring, setConfiguring] = React.useState<FeatureFlag | null>(
    null,
  );
  const [editing, setEditing] = React.useState<FeatureFlag | null>(null);
  const [deleting, setDeleting] = React.useState<FeatureFlag | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return flags.filter((f) => {
      const matchesQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || f.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [flags, query, typeFilter]);

  const selectedEnv =
    envFilter === 'all'
      ? null
      : (environments.find((e) => e.id === envFilter) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search flags..."
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All types</SelectItem>
                {(Object.keys(TYPE_LABELS) as FlagType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={envFilter} onValueChange={setEnvFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All environments</SelectItem>
                {environments.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <CreateFlagDialog projectId={projectId} />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flag</TableHead>
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead>
                {selectedEnv ? `Status · ${selectedEnv.name}` : 'Environments'}
              </TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 p-0">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Flag />
                      </EmptyMedia>
                      <EmptyTitle>No flags found</EmptyTitle>
                      <EmptyDescription>
                        {flags.length === 0
                          ? 'Create your first feature flag to get started.'
                          : 'No flags match your filters.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {flags.length === 0 && (
                      <CreateFlagDialog projectId={projectId} />
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((flag) => {
                const envState = selectedEnv
                  ? flag.states[selectedEnv.id]
                  : null;
                return (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{flag.name}</span>
                        <code className="text-xs text-muted-foreground">
                          {flag.key}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {TYPE_LABELS[flag.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {selectedEnv && envState ? (
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={envState.enabled}
                            onCheckedChange={(c) => {
                              toggleFlag(flag.id, selectedEnv.id, c);
                              toast.success(
                                `${flag.key} ${c ? 'enabled' : 'disabled'} in ${selectedEnv.name}`,
                              );
                            }}
                          />
                          {flag.type !== 'boolean' && (
                            <code className="max-w-[220px] truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                              {formatValue(flag.type, envState.value)}
                            </code>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {environments.map((env) => {
                            const st = flag.states[env.id];
                            const on = st?.enabled;
                            return (
                              <Badge
                                key={env.id}
                                variant={on ? 'default' : 'outline'}
                                className="gap-1 font-normal"
                              >
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{
                                    backgroundColor: on
                                      ? 'currentColor'
                                      : 'var(--muted-foreground)',
                                  }}
                                />
                                {env.name}
                              </Badge>
                            );
                          })}
                          {environments.length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              No environments
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                            >
                              <MoreHorizontal />
                              <span className="sr-only">Flag actions</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => setConfiguring(flag)}
                            >
                              <Settings2 />
                              Configure environments
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditing(flag)}>
                              <Pencil />
                              Edit details
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleting(flag)}
                          >
                            <Trash2 />
                            Delete flag
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {configuring && (
        <ConfigureFlagDialog
          flag={configuring}
          open={!!configuring}
          onOpenChange={(o) => !o && setConfiguring(null)}
        />
      )}
      {editing && (
        <EditFlagDialog
          flag={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flag?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  <code className="font-mono">{deleting.key}</code> will be
                  permanently removed from all environments. This cannot be
                  undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  deleteFlag(deleting.id);
                  toast.success('Flag deleted', { description: deleting.key });
                }
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
