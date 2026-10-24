import React, { useState, useEffect } from 'react';
import {
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
          {action}
        </span>
      );
    }
    if (action.includes('adjust') || action.includes('lockout') || action.includes('reset_pin')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
          {action}
        </span>
      );
    }
    if (action.includes('create') || action.includes('update')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-900">Jejak Audit Sistem (Audit Trail)</h2>
          <p className="text-xs text-stone-500">
            Log permanen (append-only) mencatat seluruh aksi sensitif: koreksi stok, void, retur, restore, dan akses (FR-AUD-01..03)
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-3 py-1.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari aktor, alasan, atau entitas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
          >
            <option value="">Semua Aksi Audit</option>
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
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Waktu Kejadian</th>
                <th className="px-3 py-3">Aksi</th>
                <th className="px-3 py-3">Aktor</th>
                <th className="px-3 py-3">Entitas</th>
                <th className="px-3 py-3">Alasan / Catatan</th>
                <th className="px-4 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    Memuat log audit...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    Tidak ada jejak audit yang cocok.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasJson = Boolean(log.before_json || log.after_json);

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-stone-50/50 transition">
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600 font-mono text-[11px]">
                          {new Date(log.occurred_at).toLocaleString('id-ID')}
                        </td>
                        <td className="px-3 py-3">{getActionBadge(log.action)}</td>
                        <td className="px-3 py-3 font-bold text-stone-900">{log.userName}</td>
                        <td className="px-3 py-3 text-stone-600 text-[11px]">
                          {log.entity_type ? `${log.entity_type} #${log.entity_id?.substring(0, 8)}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-stone-700 max-w-xs truncate" title={log.reason}>
                          {log.reason || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hasJson && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 text-stone-600 text-[10px] font-semibold inline-flex items-center gap-1"
                            >
                              <FileCode className="w-3 h-3 text-stone-500" />
                              <span>{isExpanded ? 'Tutup' : 'Lihat Data'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded JSON details */}
                      {isExpanded && hasJson && (
                        <tr className="bg-stone-50 border-y border-stone-200">
                          <td colSpan={6} className="p-4 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                              {log.before_json && (
                                <div>
                                  <div className="font-bold text-stone-600 mb-1 uppercase tracking-wider">
                                    Sebelum Perubahan (Before):
                                  </div>
                                  <pre className="p-2.5 bg-white border border-stone-200 rounded-lg font-mono text-[10px] text-stone-800 overflow-x-auto max-h-48">
                                    {log.before_json}
                                  </pre>
                                </div>
                              )}
                              {log.after_json && (
                                <div>
                                  <div className="font-bold text-emerald-800 mb-1 uppercase tracking-wider">
                                    Setelah Perubahan (After):
                                  </div>
                                  <pre className="p-2.5 bg-white border border-stone-200 rounded-lg font-mono text-[10px] text-emerald-950 overflow-x-auto max-h-48">
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
    </div>
  );
};
