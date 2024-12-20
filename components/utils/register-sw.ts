export async function registerServiceWorker() {
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        typeof navigator.serviceWorker === 'undefined'
    ) {
        console.log('Service workers are not supported');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });

        // Handle updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            const shouldUpdate = window.confirm(
                                'New version available! Would you like to update?'
                            );
                            if (shouldUpdate) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    }
                });
            }
        });

        // Handle controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker controller changed');
        });

        console.log('Service Worker registered successfully');
    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }
}