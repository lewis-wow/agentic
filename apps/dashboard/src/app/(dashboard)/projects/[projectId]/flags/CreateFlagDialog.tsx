'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateFlag } from '../../../../../queries/flags';
import {
  CreateFlagFormSchema,
  type CreateFlagFormValues,
} from '../../../../../schemas/flags';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type Props = {
  projectId: string;
};

export const CreateFlagDialog = ({ projectId }: Props): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);

  const mutation = useCreateFlag(projectId);

  const form = useForm<CreateFlagFormValues>({
    resolver: effectTsResolver(CreateFlagFormSchema),
    defaultValues: { name: '', key: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      form.reset();
      setKeyTouched(false);
    }
    setOpen(next);
  };

  const onSubmit = (values: CreateFlagFormValues): void => {
    mutation.mutate(values, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Create flag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create flag</DialogTitle>
          <DialogDescription>
            Add a new feature flag to this project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My feature"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!keyTouched) {
                          form.setValue('key', slugify(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="my-feature"
                      className="font-mono"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setKeyTouched(true);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError && (
              <p className="text-sm text-red-700">{mutation.error.message}</p>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? 'Creating…' : 'Create flag'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
