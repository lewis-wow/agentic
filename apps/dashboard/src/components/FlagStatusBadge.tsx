import { Badge } from '@repo/ui/components/ui/badge';

import type { FlagStatus } from '../queries/flags';

const STATUS_STYLES: Record<FlagStatus, string> = {
  active: 'bg-green-100 text-green-800 hover:bg-green-100',
  inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  archived: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
};

type Props = {
  status: FlagStatus;
};

export const FlagStatusBadge = ({ status }: Props): React.ReactNode => (
  <Badge variant="outline" className={STATUS_STYLES[status]}>
    {status}
  </Badge>
);
