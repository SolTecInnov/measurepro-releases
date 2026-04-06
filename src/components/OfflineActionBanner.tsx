import { WifiOff, Clock } from 'lucide-react';

interface OfflineActionBannerProps {
  message?: string;
  show: boolean;
}

export function OfflineActionBanner({ message, show }: OfflineActionBannerProps) {
  if (!show) return null;

  return (
    <div
      className="flex items-start gap-3 p-3 bg-amber-900/40 border border-amber-600/50 rounded-lg text-amber-200 text-sm"
      data-testid="banner-offline-action"
    >
      <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
      <div>
        <span className="font-medium text-amber-300">Offline — action queued</span>
        <p className="text-amber-200/80 mt-0.5">
          {message || 'This action requires an internet connection and will be applied automatically when your device reconnects.'}
        </p>
        <div className="flex items-center gap-1 mt-1 text-amber-400/70 text-xs">
          <Clock className="w-3 h-3" />
          <span>Pending sync</span>
        </div>
      </div>
    </div>
  );
}
