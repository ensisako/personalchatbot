import * as React from 'react';

export function Progress({ value = 0, className = '' }: { value?: number; className?: string }) {
  return (
    <div className={`h-2 w-full rounded bg-gray-200 ${className}`}>
      <div
        className="h-2 rounded bg-black"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        role="progressbar"
      />
    </div>
  );
}
