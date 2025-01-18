"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import ThreadedDocument from '@/components/threaded-document';

export default function Home() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isSignedIn) {
        router.push('/login');
      }
    }, 3000); // Wait for 3 seconds before redirecting

    return () => clearTimeout(timer); // Cleanup the timer on component unmount
  }, [isSignedIn, router]);

  return (
    <main>
      {isSignedIn && <ThreadedDocument />}
    </main>
  );
}