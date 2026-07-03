import { TriangleAlert } from 'lucide-react';

import { ErrorPage } from '../components/ErrorPage';

export default function NotFound(): React.ReactNode {
  return (
    <ErrorPage
      code="404"
      message="Page not found"
      icon={TriangleAlert}
      action={{ label: 'Go home', href: '/' }}
    />
  );
}
