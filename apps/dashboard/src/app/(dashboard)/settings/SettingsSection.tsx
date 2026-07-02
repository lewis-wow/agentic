import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export const SettingsSection = ({
  title,
  description,
  children,
}: Props): React.ReactNode => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
