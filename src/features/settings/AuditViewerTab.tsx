import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';
import { AuditService, type AuditLogItem } from '@/services/audit.service';

interface AuditViewerTabProps {
  auditService: AuditService;
}

export const AuditViewerTab: React.FC<AuditViewerTabProps> = ({ auditService }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await auditService.listAuditLogs({
        action: actionFilter || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch (e) {
      console.error('Error loading audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchUser = l.userName?.toLowerCase().includes(q) || l.user_id.toLowerCase().includes(q);
    const matchReason = l.reason?.toLowerCase().includes(q);
    const matchEntity = l.entity_type?.toLowerCase().includes(q) || l.entity_id?.toLowerCase().includes(q);
    return matchUser || matchReason || matchEntity;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('void') || action.includes('restore') || action.includes('write_off')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-destructive/20 border border-destructive/40 text-destructive-foreground">
          {action}
        </span>
      );
    }
    if (action.includes('adjust') || action.includes('lockout') || action.includes('reset_pin')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-800">
          {action}
        </span>
      );
    }
    if (action.includes('create') || action.includes('update')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-success/20 border border-success/40 text-success-foreground">
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-muted border border-border/60 text-foreground">
        {action}
      </span>
    );
  };

  return (
    <div className="bg-card border border-border rounded-card shadow-xs overflow-hidden">
      {/* Card Header Toolbar with Search & Action Filter */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-pill bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-serif font-bold text-foreground">Jejak Audit Sistem</h2>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-pill bg-muted text-muted-foreground border border-border/50">
                {filteredLogs.length} entri
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Log aktivitas sistem mencatat seluruh aksi sensitif: koreksi stok, void, retur, dan akses.
            </p>
          </div>
        </div>

        {/* Search, Filter, and Reload toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari aktor, alasan, entitas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-background border border-input rounded-pill text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="relative w-full sm:w-44">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full h-8 pl-3 pr-7 bg-background border border-input rounded-pill text-xs text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Semua Aksi</option>
              <option value="system.restore">system.restore</option>
              <option value="user.create">user.create</option>
              <option value="user.reset_pin">user.reset_pin</option>
              <option value="user.status_toggle">user.status_toggle</option>
              <option value="auth.lockout">auth.lockout</option>
              <option value="settings.update">settings.update</option>
              <option value="inventory.adjust">inventory.adjust</option>
              <option value="inventory.write_off">inventory.write_off</option>
              <option value="stocktake.post">stocktake.post</option>
              <option value="sale.void">sale.void</option>
              <option value="sale.return">sale.return</option>
            </select>
            <ChevronDown className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={loadLogs}
            title="Muat ulang jejak audit"
            className="h-8 px-3 rounded-pill border border-input hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Waktu Kejadian</th>
              <th className="px-3 py-3">Aksi</th>
              <th className="px-3 py-3">Aktor</th>
              <th className="px-3 py-3">Entitas</th>
              <th className="px-3 py-3">Catatan / Alasan</th>
              <th className="px-4 py-3 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Memuat log audit...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Tidak ada jejak audit yang cocok.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const hasJson = Boolean(log.before_json || log.after_json);

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        {new Date(log.occurred_at).toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-3">{getActionBadge(log.action)}</td>
                      <td className="px-3 py-3 font-semibold text-foreground">{log.userName}</td>
                      <td className="px-3 py-3 text-muted-foreground text-[11px] font-mono">
                        {log.entity_type ? `${log.entity_type} #${log.entity_id?.substring(0, 8)}` : '-'}
                      </td>
                      <td className="px-3 py-3 text-foreground max-w-xs truncate" title={log.reason}>
                        {log.reason || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasJson && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="h-6 px-2.5 rounded-pill border border-border hover:bg-muted text-foreground text-[10px] font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            <FileCode className="size-3 text-muted-foreground" />
                            <span>{isExpanded ? 'Tutup' : 'Lihat Data'}</span>
                            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded JSON details */}
                    {isExpanded && hasJson && (
                      <tr className="bg-muted/30 border-y border-border">
                        <td colSpan={6} className="p-4 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                            {log.before_json && (
                              <div>
                                <div className="font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider text-[10px]">
                                  Sebelum Perubahan (Before):
                                </div>
                                <pre className="p-3 bg-card border border-border rounded-card font-mono text-[10px] text-foreground overflow-x-auto max-h-48">
                                  {log.before_json}
                                </pre>
                              </div>
                            )}
                            {log.after_json && (
                              <div>
                                <div className="font-semibold text-primary mb-1.5 uppercase tracking-wider text-[10px]">
                                  Setelah Perubahan (After):
                                </div>
                                <pre className="p-3 bg-card border border-border rounded-card font-mono text-[10px] text-foreground overflow-x-auto max-h-48">
                                  {log.after_json}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
