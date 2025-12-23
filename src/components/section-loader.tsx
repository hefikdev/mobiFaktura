import React from 'react';
import { Loader2 } from 'lucide-react';

export function SectionLoader({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-6 ${className || ''}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
