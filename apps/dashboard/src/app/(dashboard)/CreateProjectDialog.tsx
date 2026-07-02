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
  DialogTrigger,
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
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateProject } from '../../queries/projects';
import {
  CreateProjectFormSchema,
  type CreateProjectFormValues,
} from '../../schemas/projects';

type Props = {
  trigger?: React.ReactNode;
};

const DEFAULT_TRIGGER = (
  <Button>
    <Plus />
    New Project
  </Button>
);

export const CreateProjectDialog = ({
  trigger = DEFAULT_TRIGGER,
}: Props): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const mutation = useCreateProject();

  const form = useForm<CreateProjectFormValues>({
    resolver: effectTsResolver(CreateProjectFormSchema),
    defaultValues: { name: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    setOpen(next);
  };

  const onSubmit = (values: CreateProjectFormValues): void => {
    mutation.mutate(values, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>
                Projects group environments, feature flags, and members
                together.
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
                        <Input
                          id="project-name"
                          placeholder="e.g. Web App"
                          autoFocus
                          {...field}
                        />
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
                {mutation.isPending ? 'Creating…' : 'Create'}
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
