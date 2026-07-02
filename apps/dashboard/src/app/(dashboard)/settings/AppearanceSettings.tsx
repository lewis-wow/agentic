import { SettingsSection } from './SettingsSection';
import { ThemeToggle } from './ThemeToggle';

export const AppearanceSettings = (): React.ReactNode => (
  <SettingsSection
    title="Appearance"
    description="Customize how the dashboard looks on this device."
  >
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Theme</p>
        <p className="text-sm text-muted-foreground">
          Choose a light, dark, or system-matched theme.
        </p>
      </div>
      <ThemeToggle />
    </div>
  </SettingsSection>
);
