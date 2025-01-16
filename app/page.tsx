"use client";

import React, { Suspense } from 'react';
import ThreadedDocument from '@/components/threaded-document';
import { Loader2 } from 'lucide-react';

export default function Home() {
  return (
    <main>
      <Suspense fallback={
        <div className="h-screen w-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }>
        <ThreadedDocument />
      </Suspense>
    </main>
  );
}