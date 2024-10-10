import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'AIDE',
        short_name: 'AIDE',
        description: 'An interactive threaded chat interface',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
            {
                src: 'https://zy-j.com/images/avatar.png',
                sizes: '192x192',
                type: 'image/png',
            },
        ],
    }
}