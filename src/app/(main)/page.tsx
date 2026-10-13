import { Suspense } from 'react';

import HomeView from '@/components/HomeView';

export default function Page() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  );
}
