import React, { useState, useMemo } from 'react';
import {
  Store,
  Users,
  Database,
  ShieldAlert,
} from 'lucide-react';
import { db } from '@/data/db';
import { SettingsService } from '@/services/settings.service';
import { BackupService } from '@/services/backup.service';
import { AuditService } from '@/services/audit.service';
import { StoreSettingsTab } from './StoreSettingsTab';
import { UserManagementTab } from './UserManagementTab';
import { BackupRestoreTab } from './BackupRestoreTab';
import { AuditViewerTab } from './AuditViewerTab';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'store' | 'users' | 'backup' | 'audit'>('store');

  const settingsService = useMemo(() => new SettingsService(db), []);
  const backupService = useMemo(() => new BackupService(db), []);
  const auditService = useMemo(() => new AuditService(db), []);

  return (
    <div className="space-y-6">
      {/* Segmented Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="inline-flex p-1 bg-muted rounded-pill border border-border/40 text-xs font-medium">
          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-pill transition-all ${
              activeTab === 'store'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Store className="size-3.5" />
            <span>Identitas & Kebijakan</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-pill transition-all ${
              activeTab === 'users'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="size-3.5" />
            <span>Pengguna & Peran</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-pill transition-all ${
              activeTab === 'backup'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="size-3.5" />
            <span>Backup & Restore</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-pill transition-all ${
              activeTab === 'audit'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="size-3.5" />
            <span>Jejak Audit</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'store' && <StoreSettingsTab settingsService={settingsService} />}
        {activeTab === 'users' && <UserManagementTab settingsService={settingsService} />}
        {activeTab === 'backup' && <BackupRestoreTab backupService={backupService} />}
        {activeTab === 'audit' && <AuditViewerTab auditService={auditService} />}
      </div>
    </div>
  );
};
