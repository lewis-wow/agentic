import { LockKeyhole } from 'lucide-react';

import { ErrorPage } from '../components/ErrorPage';

export default function Unauthorized(): React.ReactNode {
  return (
    <ErrorPage
      code="401"
      message="This app relies on your reverse proxy (oauth2-proxy, Authelia, Pomerium, or similar) to authenticate you before requests reach here. Contact your administrator if you keep seeing this page."
      icon={LockKeyhole}
    />
  );
}
