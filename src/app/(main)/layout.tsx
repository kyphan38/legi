'use client';

import AuthGate from '@/components/AuthGate';
import Shortcuts from '@/components/Shortcuts';
import UndoBar from '@/components/UndoBar';
import { LibraryProvider } from '@/contexts/LibraryContext';

export default function MainLayout({ children }: LayoutProps<'/'>) {
  return (
    <AuthGate>
      <LibraryProvider>
        <Shortcuts />
        {children}
        <UndoBar />
      </LibraryProvider>
    </AuthGate>
  );
}
