'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/ui/alert-dialog';
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

import { useDeleteProject } from '../../../../queries/projects';
import {
  makeDeleteProjectFormSchema,
  type DeleteProjectFormValues,
} from '../../../../schemas/projects';

type Props = {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const DeleteProjectDialog = ({
  projectId,
  projectName,
  open,
  onOpenChange,
}: Props): React.ReactNode => {
  const router = useRouter();
  const mutation = useDeleteProject();

  const form = useForm<DeleteProjectFormValues>({
    resolver: effectTsResolver(makeDeleteProjectFormSchema(projectName)),
    defaultValues: { confirmation: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    onOpenChange(next);
  };

  const onSubmit = (): void => {
    mutation.mutate(projectId, {
      onSuccess: () => router.push('/dashboard'),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this project?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{projectName}</strong> and all of its environments,
                flags, and members will be permanently removed. Type{' '}
                <span className="font-mono font-semibold text-foreground">
                  {projectName}
                </span>{' '}
                to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
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
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-700">{mutation.error.message}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
