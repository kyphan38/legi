import { Suspense } from 'react';

import SearchView from '@/components/SearchView';

// Parameters live in the query string (static site, no dynamic routes).
// useSearchParams needs a Suspense boundary when prerendering.
export default function Page() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
