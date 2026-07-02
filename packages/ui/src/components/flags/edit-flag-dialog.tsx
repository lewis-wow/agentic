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
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/lib/store';
import type { FeatureFlag } from '@/lib/types';
import * as React from 'react';
import { toast } from 'sonner';

export function EditFlagDialog({
  flag,
  open,
  onOpenChange,
}: {
  flag: FeatureFlag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateFlag } = useStore();
  const [name, setName] = React.useState(flag.name);
  const [description, setDescription] = React.useState(flag.description);

  React.useEffect(() => {
    if (open) {
      setName(flag.name);
      setDescription(flag.description);
    }
  }, [open, flag.name, flag.description]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    updateFlag(flag.id, { name: name.trim(), description: description.trim() });
    toast.success('Flag details updated');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit flag details</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {flag.key}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="edit-flag-name">Name</FieldLabel>
              <Input
                id="edit-flag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-flag-description">
                Description
              </FieldLabel>
              <Textarea
                id="edit-flag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
