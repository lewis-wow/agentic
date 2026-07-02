'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Input } from '@repo/ui/components/ui/input';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Switch } from '@repo/ui/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { MoreHorizontal, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export type FlagTableStatus = 'active' | 'inactive' | 'archived';

export type FlagTableRow = {
  id: string;
  name: string;
  key: string;
  status: FlagTableStatus;
  rollout: string;
};

export type FlagTableProps = {
  flags: FlagTableRow[];
  canManage: boolean;
  onToggle: (flag: FlagTableRow) => void;
  onEdit: (flag: FlagTableRow) => void;
  onViewHistory: (flag: FlagTableRow) => void;
  onArchiveToggle: (flag: FlagTableRow) => void;
  onDelete: (flag: FlagTableRow) => void;
  isToggling?: (flag: FlagTableRow) => boolean;
  /** Extra filter controls rendered directly next to the search input. */
  filters?: React.ReactNode;
  /** Actions (e.g. a "Create flag" button) rendered on the right of the toolbar. */
  actions?: React.ReactNode;
  /** Renders skeleton rows instead of `flags` while the flag list is loading. */
  loading?: boolean;
};

const FLAG_ROW_SKELETON_COUNT = 4;

const FlagRowSkeleton = (): React.ReactNode => (
  <TableRow>
    <TableCell>
      <Skeleton className="h-4 w-32" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-20" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-16 rounded-full" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-10" />
    </TableCell>
    <TableCell>
      <div className="flex items-center justify-center">
        <Skeleton className="h-5 w-9 rounded-full" />
      </div>
    </TableCell>
    <TableCell className="text-right">
      <Skeleton className="ml-auto size-8 rounded-md" />
    </TableCell>
  </TableRow>
);

const STATUS_VARIANT: Record<
  FlagTableStatus,
  'default' | 'secondary' | 'outline'
> = {
  active: 'default',
  inactive: 'secondary',
  archived: 'outline',
};

export const FlagTable = ({
  flags,
  canManage,
  onToggle,
  onEdit,
  onViewHistory,
  onArchiveToggle,
  onDelete,
  isToggling,
  filters,
  actions,
  loading = false,
}: FlagTableProps): React.ReactNode => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter(
      (flag) =>
        flag.name.toLowerCase().includes(q) ||
        flag.key.toLowerCase().includes(q),
    );
  }, [flags, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {filters}
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search flags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search feature flags"
          />
        </div>
        {actions && (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flag</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rollout</TableHead>
              <TableHead className="text-center">Toggle</TableHead>
              <TableHead className="w-12 text-right sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: FLAG_ROW_SKELETON_COUNT }).map((_, i) => (
                <FlagRowSkeleton key={i} />
              ))}
            {!loading &&
              filtered.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell>
                    <span className="font-medium">{flag.name}</span>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                      {flag.key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[flag.status]}>
                      {flag.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {flag.rollout}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={flag.status === 'active'}
                        onCheckedChange={() => onToggle(flag)}
                        disabled={
                          !canManage ||
                          flag.status === 'archived' ||
                          (isToggling?.(flag) ?? false)
                        }
                        aria-label={`Toggle ${flag.name}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => onEdit(flag)}>
                            Edit flag
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onViewHistory(flag)}>
                            View history
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem
                              onClick={() => onArchiveToggle(flag)}
                            >
                              {flag.status === 'archived'
                                ? 'Unarchive'
                                : 'Archive'}
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDelete(flag)}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No flags match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
