import { ShieldAlert } from 'lucide-react';

import { ErrorPage } from '../components/ErrorPage';

export default function Forbidden(): React.ReactNode {
  return (
    <ErrorPage
      code="403"
      message="You don't have permission to view this page."
      icon={ShieldAlert}
      action={{ label: 'Back to dashboard', href: '/dashboard' }}
    />
  );
}
