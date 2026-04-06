import React, { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';

interface OnlineBannerProps {
  isVisible: boolean;
}

const OnlineBanner: React.FC<OnlineBannerProps> = ({ isVisible }) => {
  const [show, setShow] = useState(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (isVisible) {
      // Show the banner
      setShow(true);
      setOpacity(1);

      // Start fade out after 2 seconds, hide completely after 3 seconds
      const fadeTimer = setTimeout(() => {
        setOpacity(0);
      }, 2000);

      const hideTimer = setTimeout(() => {
        setShow(false);
      }, 3000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isVisible]);

  if (!show) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white py-2 px-4 shadow-lg transition-opacity duration-1000"
      style={{ opacity }}
    >
      <div className="container mx-auto flex items-center justify-center gap-2">
        <Wifi className="w-5 h-5" />
        <span className="font-medium">Connection restored. You are back online!</span>
      </div>
    </div>
  );
};

export default OnlineBanner;