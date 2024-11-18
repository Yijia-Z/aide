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
                    }
                ]
            }
        ];
    },
    experimental: {
        turbo: {
            enabled: true
        }
    }
};

export default nextConfig;