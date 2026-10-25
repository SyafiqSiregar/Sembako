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
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-info text-info-text text-xs font-semibold border border-info-text/20 shadow-sm"
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
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-info text-info-text text-xs font-semibold border border-info-text/20 shadow-sm"
        role="status"
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Mode Offline: Data Lokal</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-success text-success-text text-xs font-semibold border border-success-text/20 shadow-sm"
      role="status"
      title="Data tersimpan 100% aman di IndexedDB perangkat ini"
    >
      <HardDriveDownload className="w-3.5 h-3.5 shrink-0" />
      <span>Tersimpan di perangkat</span>
    </div>
  );
};
