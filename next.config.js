/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ NUEVO: configuración de imágenes con caché
  // Le dice a Next.js de qué dominios puede servir imágenes optimizadas
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // Cachea las imágenes optimizadas 1 hora para no reprocesarlas cada vez
    minimumCacheTTL: 3600,
  },

  async headers() {
    // ✅ FIX ERROR 10: Nunca usar "*" como origen permitido en producción.
    // Se lee ALLOWED_ORIGIN primero, luego NEXT_PUBLIC_APP_URL.
    // Si ninguna está configurada, se usa la URL de producción real como fallback seguro.
    const allowedOrigin =
      process.env.ALLOWED_ORIGIN ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://mayoristamovil.com"; // ✅ Fallback seguro en lugar de "*"

    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: allowedOrigin, // ✅ FIX: Ya no puede terminar siendo "*"
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
      // ✅ NUEVO: caché agresivo para archivos estáticos (JS, CSS, fuentes)
      // Estos archivos tienen hash en el nombre así que aunque estén cacheados
      // 1 año, cuando cambie el código se genera un nombre nuevo automáticamente
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;