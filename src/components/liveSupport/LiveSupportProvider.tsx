/**
 * LiveSupportProvider — mounts the modal and floating bar globally.
 * Place this near the root of the app (e.g. in App.tsx) so it persists across routes.
 */

import React, { lazy, Suspense } from 'react';
import LiveSupportBar from './LiveSupportBar';

const LiveSupportModal = lazy(() => import('./LiveSupportModal'));

const LiveSupportProvider: React.FC = () => {
  return (
    <>
      <Suspense fallback={null}>
        <LiveSupportModal />
      </Suspense>
      <LiveSupportBar />
    </>
  );
};

export default LiveSupportProvider;
