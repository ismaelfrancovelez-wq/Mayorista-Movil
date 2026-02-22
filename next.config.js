/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  
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
            value: allowedOrigin,  // ✅ FIX: Ya no puede terminar siendo "*"
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
    ];
  },
};

module.exports = nextConfig;