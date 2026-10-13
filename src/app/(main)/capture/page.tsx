import { Suspense } from 'react';

import CaptureView from '@/components/CaptureView';

// ?snaps=1 reads the photos saved for later on this device.
export default function Page() {
  return (
    <Suspense>
      <CaptureView />
    </Suspense>
  );
}
