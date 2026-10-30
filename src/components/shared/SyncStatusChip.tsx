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
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-pill bg-info text-info-text text-xs font-semibold border border-info-text/20 shadow-xs whitespace-nowrap shrink-0"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">Menyimpan...</span>
        <span className="inline sm:hidden">Simpan...</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-pill bg-info text-info-text text-xs font-semibold border border-info-text/20 shadow-xs whitespace-nowrap shrink-0"
        role="status"
      >
        <WifiOff className="size-3.5" />
        <span className="hidden sm:inline">Offline (Lokal)</span>
        <span className="inline sm:hidden">Offline</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-pill bg-success text-success-text text-xs font-semibold border border-success-text/20 shadow-xs whitespace-nowrap shrink-0"
      role="status"
      title="Data tersimpan 100% aman di IndexedDB perangkat ini"
    >
      <HardDriveDownload className="size-3.5 shrink-0" />
      <span className="hidden sm:inline">Tersimpan lokal</span>
      <span className="inline sm:hidden">Lokal</span>
    </div>
  );
};
