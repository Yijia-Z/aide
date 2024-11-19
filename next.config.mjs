/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.output.filename = 'static/chunks/[name].js';
        }
        return config;
    },
    async headers() {
        return [
            {
                source: '/sw.js',
                headers: [
                    {
                        key: 'Service-Worker-Allowed',
                        value: '/'
                    },
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=0, must-revalidate'
                    }
                ]
            },
        ]
    }
};

export default nextConfig;