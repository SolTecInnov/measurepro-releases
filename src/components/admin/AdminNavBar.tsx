import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, LayoutGrid, BarChart3, Users, FileKey, Tag, Database, Cpu, Building2 } from 'lucide-react';

const ADMIN_ROUTES: Record<string, { label: string; icon: React.ElementType }> = {
  '/admin/accounts':        { label: 'User Accounts',       icon: Users },
  '/admin/companies':       { label: 'Companies',            icon: Building2 },
  '/admin-licensing':       { label: 'License Admin',        icon: FileKey },
  '/admin/analytics':       { label: 'Analytics',            icon: BarChart3 },
  '/admin/pricing':         { label: 'Pricing Management',   icon: Tag },
  '/admin/terms':           { label: 'Terms Management',     icon: FileKey },
  '/admin/debug/indexeddb': { label: 'Debug — IndexedDB',   icon: Database },
  '/admin/debug/stress':    { label: 'Debug — Stress Test', icon: Cpu },
};

const AdminNavBar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const page = ADMIN_ROUTES[pathname];
  if (!page) return null;

  const Icon = page.icon;

  return (
    <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex items-center gap-3 text-sm sticky top-0 z-50">
      <button
        onClick={() => navigate('/app')}
        className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        data-testid="button-back-to-app"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to App</span>
      </button>

      <span className="text-gray-700">/</span>

      <div className="flex items-center gap-1.5 text-gray-300">
        <Shield className="w-3.5 h-3.5 text-red-400" />
        <span className="font-medium">Admin</span>
      </div>

      <span className="text-gray-700">/</span>

      <div className="flex items-center gap-1.5 text-white font-medium">
        <Icon className="w-3.5 h-3.5 text-blue-400" />
        <span>{page.label}</span>
      </div>

      <div className="ml-auto">
        <button
          onClick={() => navigate('/app')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          data-testid="button-all-admin-pages"
          title="Go to Admin Panel (Settings → Admin tab)"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">All Admin Pages</span>
        </button>
      </div>
    </div>
  );
};

export default AdminNavBar;
