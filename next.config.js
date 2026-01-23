/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false,
  productionBrowserSourceMaps: true, // optionnel mais utile si ça re-casse (stack lisible)
};

module.exports = nextConfig;
