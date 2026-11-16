import { Suspense } from 'react';

import YearView from '@/components/YearView';

// The year lives in ?y= (static site, no dynamic routes).
// useSearchParams needs a Suspense boundary when prerendering.
export default function Page() {
  return (
    <Suspense>
      <YearView />
    </Suspense>
  );
}
