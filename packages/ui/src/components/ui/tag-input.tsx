'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@repo/ui/components/ui/badge';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';

export const addChips = (current: string[], raw: string): string[] => {
  const next = [...current];
  for (const candidate of raw.split(',')) {
    const trimmed = candidate.trim();
    if (trimmed.length === 0 || next.includes(trimmed)) continue;
    next.push(trimmed);
  }
  return next;
};

export type TagInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export const TagInput = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  'aria-label': ariaLabel,
}: TagInputProps): React.ReactNode => {
  const [draft, setDraft] = useState('');

  const commitDraft = (raw: string): void => {
    const next = addChips(value, raw);
    if (next.length !== value.length) onChange(next);
    setDraft('');
  };

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {value.map((item, index) => (
        <Badge key={item} variant="secondary" className="gap-1 pr-1">
          {item}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove ${item}`}
              className="rounded-full outline-none hover:bg-muted-foreground/20 focus-visible:ring-[2px] focus-visible:ring-ring/50"
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      <Input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (draft.trim().length > 0) commitDraft(draft);
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text.includes(',')) {
            e.preventDefault();
            commitDraft(draft + text);
          }
        }}
        onBlur={() => {
          if (draft.trim().length > 0) commitDraft(draft);
        }}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-6 w-auto min-w-24 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
};
