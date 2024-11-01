import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        "name": "Aide",
        "short_name": "Aide",
        "description": "An interactive threaded chat interface",
        "start_url": "/",
        "display": "standalone",
        "icons": [
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
        "theme_color": "#211f1c",
        "background_color": "#211f1c",
        "id": "aide.zy-j",
        "dir": "ltr",
        "scope": "aide.zy-j.com",
        "lang": "en",
        "orientation": "any",
        "categories": [
            "productivity",
            "utilities"
        ]
    }
}