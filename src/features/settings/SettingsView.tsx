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
    <div className="p-6 max-w-7xl mx-auto space-y-6">


      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('store')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
            activeTab === 'store'
              ? 'bg-[#14463C] text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Identitas & Kebijakan Toko</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
            activeTab === 'users'
              ? 'bg-[#14463C] text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengguna & Peran</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
            activeTab === 'backup'
              ? 'bg-[#14463C] text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Backup & Restore</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
            activeTab === 'audit'
              ? 'bg-[#14463C] text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Jejak Audit</span>
        </button>
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
