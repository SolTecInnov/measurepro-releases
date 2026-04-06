import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  isVisible: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-600 text-white py-2 px-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <WifiOff className="w-5 h-5" />
        <span className="font-medium">You are currently offline. Some features may be limited.</span>
      </div>
    </div>
  );
};

export default OfflineBanner;