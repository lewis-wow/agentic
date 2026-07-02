'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useRenameProject } from '../../../../queries/projects';
import {
  RenameProjectFormSchema,
  type RenameProjectFormValues,
} from '../../../../schemas/projects';

type Props = {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const RenameProjectDialog = ({
  projectId,
  projectName,
  open,
  onOpenChange,
}: Props): React.ReactNode => {
  const mutation = useRenameProject(projectId);

  const form = useForm<RenameProjectFormValues>({
    resolver: effectTsResolver(RenameProjectFormSchema),
    defaultValues: { name: projectName },
  });

  useEffect(() => {
    if (open) form.reset({ name: projectName });
  }, [open, projectName, form]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset({ name: projectName });
    onOpenChange(next);
  };

  const onSubmit = (values: RenameProjectFormValues): void => {
    mutation.mutate(values, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Rename project</DialogTitle>
              <DialogDescription>
                Choose a new name for this project.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input id="project-name" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
            {mutation.isError && (
              <p className="mt-2 text-sm text-red-700">
                {mutation.error.message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
