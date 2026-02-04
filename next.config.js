/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack to use standard webpack (better Tailwind support)
  // Reduce logging noise
  logging: {
    fetches: {
      fullUrl: false
    }
  },
  // Suppress 404 logs for optional files
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  }
}

module.exports = nextConfig
