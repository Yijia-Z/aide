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
                "type": "image/png",
                "purpose": "maskable"
            },
            {
                "sizes": "512x512",
                "src": "/android-chrome-512x512.png",
                "type": "image/png",
                "purpose": "maskable"
            }
        ],
        "theme_color": "accent",
        "background_color": "background",
        "id": "aide.zy-j",
        "dir": "ltr",
        "scope": "/",
        "lang": "en",
        "orientation": "any",
        "categories": [
            "productivity",
            "utilities"
        ],
        "prefer_related_applications": false,
        "display_override": ["standalone", "browser"]
    }
}