import React from 'react';
import { HardDriveDownload, WifiOff, Loader2 } from 'lucide-react';

export type SyncState = 'saved_local' | 'offline' | 'saving';

interface SyncStatusChipProps {
  status?: SyncState;
}

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({ status = 'saved_local' }) => {
  if (status === 'saving') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-info text-info text-xs font-medium border border-border"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Menyimpan...</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-info text-info text-xs font-medium border border-border"
        role="status"
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline: data tersimpan lokal</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-success text-success text-xs font-medium border border-border"
      role="status"
    >
      <HardDriveDownload className="w-3.5 h-3.5" />
      <span>Tersimpan di perangkat</span>
    </div>
  );
};
