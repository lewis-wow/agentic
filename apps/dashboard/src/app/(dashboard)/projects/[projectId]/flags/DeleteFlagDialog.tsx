'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import { useForm } from 'react-hook-form';

import { useDeleteFlag } from '../../../../../queries/flags';
import {
  makeDeleteFlagFormSchema,
  type DeleteFlagFormValues,
} from '../../../../../schemas/flags';

type Props = {
  projectId: string;
  flagId: string;
  flagName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const DeleteFlagDialog = ({
  projectId,
  flagId,
  flagName,
  open,
  onOpenChange,
}: Props): React.ReactNode => {
  const mutation = useDeleteFlag(projectId);

  const form = useForm<DeleteFlagFormValues>({
    resolver: effectTsResolver(makeDeleteFlagFormSchema(flagName)),
    defaultValues: { confirmation: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    onOpenChange(next);
  };

  const onSubmit = (): void => {
    mutation.mutate(flagId, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete flag</DialogTitle>
          <DialogDescription>
            Type <span className="font-mono font-semibold">{flagName}</span> to
            confirm. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex items-start gap-2"
          >
            <FormField
              control={form.control}
              name="confirmation"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder={flagName} {...field} />
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
              {mutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </form>
        </Form>
        {mutation.isError && (
          <p className="text-sm text-red-700">{mutation.error.message}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
