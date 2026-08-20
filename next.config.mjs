import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const isVercel = process.env.VERCEL === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(isVercel ? {} : { output: 'standalone' }),
    allowedDevOrigins: ['127.0.0.1'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default withNextIntl(nextConfig);
