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
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { useDeleteProject, useProject } from '../../../../queries/projects';
import {
  makeDeleteProjectFormSchema,
  type DeleteProjectFormValues,
} from '../../../../schemas/projects';

type Props = {
  projectId: string;
};

export const DeleteProjectForm = ({ projectId }: Props): React.ReactNode => {
  const { data: project } = useProject(projectId);

  if (!project) return null;

  return (
    <DeleteProjectFormFields projectId={projectId} projectName={project.name} />
  );
};

type DeleteProjectFormFieldsProps = {
  projectId: string;
  projectName: string;
};

const DeleteProjectFormFields = ({
  projectId,
  projectName,
}: DeleteProjectFormFieldsProps): React.ReactNode => {
  const router = useRouter();
  const mutation = useDeleteProject();

  const form = useForm<DeleteProjectFormValues>({
    resolver: effectTsResolver(makeDeleteProjectFormSchema(projectName)),
    defaultValues: { confirmation: '' },
  });

  const onSubmit = (): void => {
    mutation.mutate(projectId, {
      onSuccess: () => router.push('/dashboard'),
    });
  };

  return (
    <section className="space-y-3 rounded-md border border-red-200 p-4">
      <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
      <p className="text-sm text-gray-600">
        Deleting this project is permanent. All environments, flags, and members
        will be removed. Type{' '}
        <span className="font-mono font-semibold">{projectName}</span> to
        confirm.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="confirmation"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder={projectName} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="destructive"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete project'}
          </Button>
          {mutation.isError && (
            <p className="text-sm text-red-700">{mutation.error.message}</p>
          )}
        </form>
      </Form>
    </section>
  );
};
