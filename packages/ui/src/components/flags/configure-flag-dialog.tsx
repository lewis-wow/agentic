'use client';

import { FlagValueInput } from '@/components/flags/flag-value-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useStore, useProjectEnvironments } from '@/lib/store';
import type { FeatureFlag, FlagValue } from '@/lib/types';
import * as React from 'react';
import { toast } from 'sonner';

interface Draft {
  enabled: boolean;
  value: FlagValue;
}

export function ConfigureFlagDialog({
  flag,
  open,
  onOpenChange,
}: {
  flag: FeatureFlag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const environments = useProjectEnvironments(flag.projectId);
  const { toggleFlag, setFlagValue } = useStore();

  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});

  // Reset drafts whenever the dialog opens for a flag.
  React.useEffect(() => {
    if (!open) return;
    const next: Record<string, Draft> = {};
    for (const env of environments) {
      const state = flag.states[env.id] ?? { enabled: false, value: '' };
      next[env.id] = {
        enabled: state.enabled,
        value:
          flag.type === 'json'
            ? JSON.stringify(state.value ?? {}, null, 2)
            : state.value,
      };
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flag.id]);

  function updateDraft(envId: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [envId]: { ...d[envId], ...patch } }));
  }

  const jsonErrors = React.useMemo(() => {
    if (flag.type !== 'json') return {};
    const errs: Record<string, boolean> = {};
    for (const [envId, draft] of Object.entries(drafts)) {
      try {
        JSON.parse(typeof draft.value === 'string' ? draft.value : '{}');
        errs[envId] = false;
      } catch {
        errs[envId] = true;
      }
    }
    return errs;
  }, [drafts, flag.type]);

  const hasJsonError = Object.values(jsonErrors).some(Boolean);

  function handleSave() {
    if (hasJsonError) return;
    for (const env of environments) {
      const draft = drafts[env.id];
      if (!draft) continue;
      let value: FlagValue = draft.value;
      if (flag.type === 'json') {
        value = JSON.parse(
          typeof draft.value === 'string' ? draft.value : '{}',
        );
      } else if (flag.type === 'number') {
        value = Number(draft.value) || 0;
      } else if (flag.type === 'boolean') {
        value = Boolean(draft.value);
      }
      setFlagValue(flag.id, env.id, value);
      toggleFlag(flag.id, env.id, draft.enabled);
    }
    toast.success('Flag updated', { description: flag.key });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {flag.name}
            <Badge variant="secondary" className="font-mono text-xs">
              {flag.type}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Configure the rollout state and served value per environment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto py-2">
          {environments.map((env, i) => {
            const draft = drafts[env.id];
            if (!draft) return null;
            return (
              <div key={env.id} className="flex flex-col gap-3">
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: env.color }}
                    />
                    <span className="text-sm font-medium">{env.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {env.key}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {draft.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={draft.enabled}
                      onCheckedChange={(c) =>
                        updateDraft(env.id, { enabled: c })
                      }
                    />
                  </div>
                </div>
                {flag.type !== 'boolean' && (
                  <Field data-invalid={jsonErrors[env.id] || undefined}>
                    <FieldLabel className="text-xs text-muted-foreground">
                      Served value
                    </FieldLabel>
                    <FlagValueInput
                      type={flag.type}
                      value={draft.value}
                      invalid={jsonErrors[env.id]}
                      onChange={(value) => updateDraft(env.id, { value })}
                    />
                  </Field>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={hasJsonError}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
