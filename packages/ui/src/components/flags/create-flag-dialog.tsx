'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { slugify, useStore, useProjectFlags } from '@/lib/store';
import type { FlagType } from '@/lib/types';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

const TYPE_LABELS: Record<FlagType, string> = {
  boolean: 'Boolean',
  string: 'String',
  number: 'Number',
  json: 'JSON',
};

export function CreateFlagDialog({ projectId }: { projectId: string }) {
  const { createFlag } = useStore();
  const existing = useProjectFlags(projectId);

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [key, setKey] = React.useState('');
  const [keyEdited, setKeyEdited] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<FlagType>('boolean');

  const finalKey = keyEdited ? slugify(key) : slugify(name);
  const duplicate = existing.some((f) => f.key === finalKey);

  function reset() {
    setName('');
    setKey('');
    setKeyEdited(false);
    setDescription('');
    setType('boolean');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !finalKey || duplicate) return;
    createFlag({
      projectId,
      key: finalKey,
      name: name.trim(),
      description: description.trim(),
      type,
    });
    toast.success('Flag created', { description: finalKey });
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" />
            New Flag
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create feature flag</DialogTitle>
            <DialogDescription>
              The flag is created disabled in every environment.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="flag-name">Name</FieldLabel>
              <Input
                id="flag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Checkout"
                autoFocus
              />
            </Field>
            <Field data-invalid={duplicate || undefined}>
              <FieldLabel htmlFor="flag-key">Key</FieldLabel>
              <Input
                id="flag-key"
                value={finalKey}
                aria-invalid={duplicate || undefined}
                onChange={(e) => {
                  setKeyEdited(true);
                  setKey(e.target.value);
                }}
                placeholder="new-checkout"
                className="font-mono"
              />
              <FieldDescription>
                {duplicate
                  ? 'A flag with this key already exists in this project.'
                  : 'Used by SDKs to reference this flag.'}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="flag-type">Type</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) => setType(v as FlagType)}
              >
                <SelectTrigger id="flag-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(TYPE_LABELS) as FlagType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="flag-description">Description</FieldLabel>
              <Textarea
                id="flag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this flag control?"
                rows={2}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={!name.trim() || !finalKey || duplicate}
            >
              Create flag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
