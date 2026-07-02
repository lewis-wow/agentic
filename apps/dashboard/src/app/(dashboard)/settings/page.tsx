import { requireSession } from '../../../lib/guards';
import { SiteHeader } from '../SiteHeader';
import { AppearanceSettings } from './AppearanceSettings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage(): Promise<React.ReactNode> {
  await requireSession();

  return (
    <>
      <SiteHeader crumbs={[{ label: 'Settings' }]} />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your preferences for this dashboard.
          </p>
        </div>

        <AppearanceSettings />
      </div>
    </>
  );
}
