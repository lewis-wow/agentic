'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Button } from '@repo/ui/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import { useForm } from 'react-hook-form';

import { useCreateProject } from '../../../queries/projects';
import {
  CreateProjectFormSchema,
  type CreateProjectFormValues,
} from '../../../schemas/projects';

export const CreateProjectForm = (): React.ReactNode => {
  const mutation = useCreateProject();

  const form = useForm<CreateProjectFormValues>({
    resolver: effectTsResolver(CreateProjectFormSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = (values: CreateProjectFormValues): void => {
    mutation.mutate(values, {
      onSuccess: () => form.reset(),
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex items-start gap-2"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input placeholder="New project name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create'}
        </Button>
        {mutation.isError && (
          <p className="text-sm text-red-700">{mutation.error.message}</p>
        )}
      </form>
    </Form>
  );
};
