export const createOfflineDetector = () => {
    let isOffline = !navigator.onLine;
    const listeners = new Set<(offline: boolean) => void>();

    const notify = () => {
        listeners.forEach(listener => listener(isOffline));
    };

    window.addEventListener('online', () => {
        isOffline = false;
        notify();
    });

    window.addEventListener('offline', () => {
        isOffline = true;
        notify();
    });

    return {
        isOffline: () => isOffline,
        addListener: (listener: (offline: boolean) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};