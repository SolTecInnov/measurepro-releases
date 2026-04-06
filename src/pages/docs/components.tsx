import { Info, AlertTriangle } from 'lucide-react';

export function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`manual-card bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6 ${className}`}>
      {children}
    </div>
  );
}

export function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 my-4">
      <p className="text-blue-300 text-sm flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{children}</span>
      </p>
    </div>
  );
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 my-4">
      <p className="text-amber-300 text-sm flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{children}</span>
      </p>
    </div>
  );
}
