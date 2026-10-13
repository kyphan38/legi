import { Suspense } from 'react';

import InboxView from '@/components/InboxView';

// Parameters live in the query string (static site, no dynamic routes).
// useSearchParams needs a Suspense boundary when prerendering.
export default function Page() {
  return (
    <Suspense>
      <InboxView />
    </Suspense>
  );
}
