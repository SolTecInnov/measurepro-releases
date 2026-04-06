import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface DeviceRedirectorProps {
  allowManualNavigation?: boolean;
}

/**
 * Component that redirects users based on their device type
 * - Mobile devices are redirected to the slave app
 * - Desktop devices are redirected to the main app
 * - Can be overridden with allowManualNavigation prop
 */
const DeviceRedirector: React.FC<DeviceRedirectorProps> = ({ allowManualNavigation = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Only check once per component mount to prevent infinite loops
    if (hasChecked) return;
    
    // Check if user manually navigated (override automatic redirection)
    const manualNavigation = sessionStorage.getItem('manual_navigation');
    if (allowManualNavigation && manualNavigation) {
      setHasChecked(true);
      return;
    }

    const checkDeviceAndRedirect = () => {
      // Check if this is a mobile device
      const isMobile = window.innerWidth <= 768 || 
                      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Get current path and search params
      const currentPath = location.pathname;
      const searchParams = new URLSearchParams(location.search);
      
      // Check if this is a convoy-related route (QR code scan, join link, etc.)
      const isConvoyRoute = 
        currentPath.includes('/convoy') || 
        searchParams.has('sessionToken') ||
        searchParams.has('convoy');
      
      // If mobile and convoy route, don't auto-redirect - let them access convoy
      if (isMobile && isConvoyRoute) {
        sessionStorage.setItem('manual_navigation', 'true');
        setHasChecked(true);
        return;
      }
      
      // If mobile device and on home page, check if authenticated first
      if (isMobile && currentPath === '/' && !manualNavigation) {
        // Only redirect authenticated users to mobile selector
        const hasAccess = localStorage.getItem('app_access') === 'true';
        if (hasAccess) {
          sessionStorage.setItem('auto_redirected_to_selector', 'true');
          navigate('/mobile-select');
        } else {
        }
      } 
      // If desktop device and on mobile selector, redirect to main app
      else if (!isMobile && currentPath === '/mobile-select' && !manualNavigation) {
        sessionStorage.setItem('auto_redirected_to_main', 'true');
        navigate('/');
      }
      // If desktop device and on slave app page, redirect to main app
      else if (!isMobile && currentPath === '/slave' && !manualNavigation) {
        sessionStorage.setItem('auto_redirected_to_main', 'true');
        navigate('/');
      }
      
      setHasChecked(true);
    };

    // Check on initial load with a slight delay to ensure everything is loaded
    const timeoutId = setTimeout(() => {
      checkDeviceAndRedirect();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [navigate, location.pathname, location.search, hasChecked, allowManualNavigation]);
  
  // Clear manual navigation flag when component unmounts
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('manual_navigation');
    };
  }, []);

  return null; // This component doesn't render anything
};

export default DeviceRedirector;