'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/components/theme-provider';
import { SpeedInsights } from '@vercel/speed-insights/next';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignOutUrl='/login'
      afterMultiSessionSingleSignOutUrl='/login'
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    // signInUrl='/login'
    // signUpUrl='/login'
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <SpeedInsights />
      </ThemeProvider>
    </ClerkProvider>
  );
}
