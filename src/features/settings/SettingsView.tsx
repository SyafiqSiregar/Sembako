import React, { useState, useMemo, useEffect } from 'react';
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
import { useAuthStore } from '@/features/auth/authStore';
import { hasPermission } from '@/domain/permissions';
import { StoreSettingsTab } from './StoreSettingsTab';
import { UserManagementTab } from './UserManagementTab';
import { BackupRestoreTab } from './BackupRestoreTab';
import { AuditViewerTab } from './AuditViewerTab';

type SettingsTabId = 'store' | 'users' | 'backup' | 'audit';

export const SettingsView: React.FC = () => {
  const { roleCodes } = useAuthStore();

  const canManageStore = useMemo(() => hasPermission(roleCodes, 'settings.manage'), [roleCodes]);
  const canManageUsers = useMemo(() => hasPermission(roleCodes, 'users.manage'), [roleCodes]);
  const canManageBackup = useMemo(() => hasPermission(roleCodes, 'backup.create'), [roleCodes]);
  const canViewAudit = useMemo(() => hasPermission(roleCodes, 'audit.view'), [roleCodes]);

  const availableTabs = useMemo(() => {
    const tabs: { id: SettingsTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
    if (canManageStore) tabs.push({ id: 'store', label: 'Identitas & Kebijakan', icon: Store });
    if (canManageUsers) tabs.push({ id: 'users', label: 'Pengguna & Peran', icon: Users });
    if (canManageBackup) tabs.push({ id: 'backup', label: 'Backup & Restore', icon: Database });
    if (canViewAudit) tabs.push({ id: 'audit', label: 'Jejak Audit', icon: ShieldAlert });
    return tabs;
  }, [canManageStore, canManageUsers, canManageBackup, canViewAudit]);

  const [activeTab, setActiveTab] = useState<SettingsTabId>(() =>
    canManageStore ? 'store' : 'backup'
  );

  useEffect(() => {
    const firstTab = availableTabs[0];
    if (firstTab && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(firstTab.id);
    }
  }, [availableTabs, activeTab]);

  const settingsService = useMemo(() => new SettingsService(db), []);
  const backupService = useMemo(() => new BackupService(db), []);
  const auditService = useMemo(() => new AuditService(db), []);

  return (
    <div className="space-y-6">
      {/* Segmented Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="inline-flex p-1 bg-muted rounded-pill border border-border/40 text-xs font-medium">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-pill transition-all ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'store' && canManageStore && (
          <StoreSettingsTab settingsService={settingsService} />
        )}
        {activeTab === 'users' && canManageUsers && (
          <UserManagementTab settingsService={settingsService} />
        )}
        {activeTab === 'backup' && canManageBackup && (
          <BackupRestoreTab backupService={backupService} />
        )}
        {activeTab === 'audit' && canViewAudit && (
          <AuditViewerTab auditService={auditService} />
        )}
      </div>
    </div>
  );
};
