'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { FlagType, FlagValue } from '@/lib/types';

export function formatValue(type: FlagType, value: FlagValue): string {
  if (type === 'json') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (type === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export function FlagValueInput({
  id,
  type,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id?: string;
  type: FlagType;
  value: FlagValue;
  onChange: (value: FlagValue) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  if (type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(c)}
          disabled={disabled}
        />
        <Label htmlFor={id} className="text-sm text-muted-foreground">
          {value ? 'true' : 'false'}
        </Label>
      </div>
    );
  }

  if (type === 'number') {
    return (
      <Input
        id={id}
        type="number"
        value={String(value ?? '')}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) =>
          onChange(e.target.value === '' ? 0 : Number(e.target.value))
        }
      />
    );
  }

  if (type === 'json') {
    return (
      <Textarea
        id={id}
        rows={3}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="font-mono text-xs"
        value={
          typeof value === 'string' ? value : JSON.stringify(value, null, 2)
        }
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      id={id}
      value={String(value ?? '')}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
