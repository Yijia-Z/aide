export async function registerServiceWorker() {
    // Check if we're in a browser environment and if service workers are supported
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        typeof navigator.serviceWorker === 'undefined'
    ) {
        console.log('Service workers are not supported in this environment');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });

        // Check if there's an update available
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        if (window.confirm('New version available! Reload to update?')) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        }
                    }
                });
            }
        });

        console.log('Service Worker registered successfully:', registration);
    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }
}