'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

type Props = {
  fullKey: string;
  label: string;
};

export const ApiKeyReveal = ({ fullKey, label }: Props): React.ReactNode => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
      <div className="flex-1 space-y-1">
        <p className="text-xs font-medium text-green-800">
          {label} — copy your API key now. It won&apos;t be shown again.
        </p>
        <pre className="overflow-x-auto rounded bg-white px-2 py-1.5 font-mono text-xs text-gray-800">
          {fullKey}
        </pre>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 border-green-300 bg-white text-green-800 hover:bg-green-100"
        onClick={handleCopy}
      >
        {copied ? <Check /> : <Copy />}
        <span className="sr-only">{copied ? 'Copied' : 'Copy API key'}</span>
      </Button>
    </div>
  );
};
