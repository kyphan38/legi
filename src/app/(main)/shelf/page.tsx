import { Suspense } from 'react';

import ShelfView from '@/components/ShelfView';

// ?add=1 opens the new-book field (⌘K "new book").
export default function Page() {
  return (
    <Suspense>
      <ShelfView />
    </Suspense>
  );
}
