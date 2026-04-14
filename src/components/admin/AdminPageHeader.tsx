import { ChevronLeft, Shield, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
}

const AdminPageHeader = ({ title, description }: AdminPageHeaderProps) => {
  // AdminNavBar (in App.tsx) already provides the breadcrumb navigation.
  // This component only renders a lightweight title bar without duplicate nav.
  return (
    <div className="px-6 py-2 flex items-center gap-2 min-w-0">
      <Shield className="w-4 h-4 text-red-400 shrink-0" />
      <span className="text-sm text-gray-300 font-medium truncate">{title}</span>
      {description && (
        <span className="text-xs text-gray-500 hidden md:block truncate">— {description}</span>
      )}
    </div>
  );
};

export default AdminPageHeader;
