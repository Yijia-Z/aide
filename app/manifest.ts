import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'AIDE',
        short_name: 'AIDE',
        description: 'An interactive threaded chat interface',
        start_url: '/',
        display: 'standalone',
        icons: [
            {
                "sizes": "192x192",
                "src": "/android-chrome-192x192.png",
                "type": "image/png"
            },
            {
                "sizes": "512x512",
                "src": "/android-chrome-512x512.png",
                "type": "image/png"
            }
        ],
    }
}