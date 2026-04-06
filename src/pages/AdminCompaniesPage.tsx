import AdminNavBar from '../components/admin/AdminNavBar';
import CompanyManager from '../components/settings/admin/CompanyManager';

export default function AdminCompaniesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <AdminNavBar />
      <main className="flex-1 overflow-y-auto">
        <CompanyManager />
      </main>
    </div>
  );
}
