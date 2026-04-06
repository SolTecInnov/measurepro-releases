import { ChevronLeft, Shield, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
}

const AdminPageHeader = ({ title, description }: AdminPageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/app')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
          data-testid="button-back-to-app"
        >
          <ChevronLeft className="w-4 h-4" />
          App
        </button>
        <span className="text-gray-600">/</span>
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm text-gray-300 font-medium truncate">{title}</span>
        </div>
        {description && (
          <span className="text-xs text-gray-500 hidden md:block truncate">— {description}</span>
        )}
      </div>
      <button
        onClick={() => navigate('/app')}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        data-testid="button-all-admin-pages"
        title="Go to Admin Panel (Settings → Admin tab)"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Admin Panel</span>
      </button>
    </div>
  );
};

export default AdminPageHeader;
