import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    allowedDevOrigins: ['127.0.0.1'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default withNextIntl(nextConfig);
