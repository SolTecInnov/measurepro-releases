import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Plus, Copy, Check, AlertTriangle, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/queryClient';
import { useAuth } from '../../lib/auth/AuthContext';

interface Voucher {
  id: number;
  code: string;
  status: 'unused' | 'used' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedBy: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  unused: 'bg-green-900/30 text-green-400 border border-green-700',
  used: 'bg-blue-900/30 text-blue-400 border border-blue-700',
  expired: 'bg-red-900/30 text-red-400 border border-red-700',
};

const HardwareVoucherManager = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [count, setCount] = useState(1);
  const [expiryMonths, setExpiryMonths] = useState(12);
  const [notes, setNotes] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unused' | 'used' | 'expired'>('all');

  const adminEmail = user?.email || '';

  const { data, isLoading, isError, refetch } = useQuery<{ vouchers: Voucher[] }>({
    queryKey: ['/api/admin/vouchers'],
    queryFn: () =>
      apiRequest<{ vouchers: Voucher[] }>('/api/admin/vouchers', {
        headers: { 'x-admin-email': adminEmail },
      }),
    enabled: !!adminEmail,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ vouchers: { code: string; expiresAt: string }[] }>('/api/admin/vouchers/generate', {
        method: 'POST',
        body: JSON.stringify({
          count,
          expiresInDays: expiryMonths ? expiryMonths * 30 : null,
          notes: notes || null,
        }),
        headers: { 'x-admin-email': adminEmail },
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/vouchers'] });
      toast.success(`${result.vouchers.length} voucher${result.vouchers.length > 1 ? 's' : ''} generated`, {
        description: result.vouchers.map((v) => v.code).join(' · '),
      });
      setNotes('');
    },
    onError: (err: any) => {
      toast.error('Failed to generate vouchers', { description: err.message });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const vouchers: Voucher[] = data?.vouchers || [];
  const filtered = filterStatus === 'all' ? vouchers : vouchers.filter((v) => v.status === filterStatus);

  const counts = {
    total: vouchers.length,
    unused: vouchers.filter((v) => v.status === 'unused').length,
    used: vouchers.filter((v) => v.status === 'used').length,
    expired: vouchers.filter((v) => v.status === 'expired').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-orange-400" />
            Hardware Vouchers
          </h2>
          <p className="text-gray-400 text-sm mt-1">Generate SOLT-XXXX-XXXX codes shipped with hardware units</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          data-testid="button-refresh-vouchers"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-white' },
          { label: 'Unused', value: counts.unused, color: 'text-green-400' },
          { label: 'Used', value: counts.used, color: 'text-blue-400' },
          { label: 'Expired', value: counts.expired, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-400 text-sm">{label}</p>
          </div>
        ))}
      </div>

      {/* Generate Form */}
      <div className="bg-gray-900/50 border border-orange-600/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-orange-400" />
          Generate New Vouchers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="input-voucher-quantity"
            />
            <p className="text-xs text-gray-500 mt-1">Max 50 at a time</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Expires after (months)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={expiryMonths}
              onChange={(e) => setExpiryMonths(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="input-voucher-expiry"
            />
            <p className="text-xs text-gray-500 mt-1">From date of generation</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Batch #4 — June shipment"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="input-voucher-notes"
            />
          </div>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          data-testid="button-generate-vouchers"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Generate {count} Voucher{count !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'unused', 'used', 'expired'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filterStatus === s
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid={`filter-vouchers-${s}`}
          >
            {s === 'all' ? `All (${counts.total})` : `${s} (${counts[s as keyof typeof counts] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Voucher List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Failed to load vouchers. Make sure you are logged in as admin.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {filterStatus === 'all' ? 'No vouchers yet. Generate some above.' : `No ${filterStatus} vouchers.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Used by</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-gray-800/40 transition-colors" data-testid={`row-voucher-${v.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white font-semibold tracking-wider">{v.code}</span>
                      <button
                        onClick={() => copyCode(v.code)}
                        className="text-gray-500 hover:text-orange-400 transition-colors"
                        title="Copy code"
                        data-testid={`button-copy-${v.id}`}
                      >
                        {copiedCode === v.code ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[v.status]}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {v.expiresAt ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(v.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-600">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {v.usedBy || <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {v.notes || <span className="text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HardwareVoucherManager;
