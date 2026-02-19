/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false,
  productionBrowserSourceMaps: true, // optionnel mais utile si ça re-casse (stack lisible)
  webpack: (config, { dev }) => {
    if (dev) {
      // Reduces intermittent corrupted chunk/cache issues in local dev.
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
