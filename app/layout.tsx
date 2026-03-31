import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthCheck from "../components/AuthCheck";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "MayoristaMovil — Compra fraccionada a precio de fábrica",
    template: "%s | MayoristaMovil",
  },
  description:
    "Comprá productos mayoristas a precio de fábrica sin llegar al mínimo. Unite a otros compradores, participá en lotes fraccionados y recibí tu pedido en 24-72hs. Fábricas verificadas en toda Argentina.",
  keywords: [
    "compra mayorista argentina",
    "precio de fábrica",
    "compra fraccionada",
    "mayorista online",
    "revendedor argentina",
    "lotes mayoristas",
  ],
  authors: [{ name: "MayoristaMovil" }],
  creator: "MayoristaMovil",
  metadataBase: new URL("https://mayoristamovil.com"),
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://mayoristamovil.com",
    siteName: "MayoristaMovil",
    title: "MayoristaMovil — Compra fraccionada a precio de fábrica",
    description:
      "Comprá productos mayoristas a precio de fábrica sin llegar al mínimo. Unite a otros compradores en lotes fraccionados. Fábricas verificadas en Argentina.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MayoristaMovil — Compra fraccionada mayorista",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MayoristaMovil — Compra fraccionada a precio de fábrica",
    description:
      "Comprá productos mayoristas a precio de fábrica sin llegar al mínimo. Lotes fraccionados, fábricas verificadas en Argentina.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.variable + " antialiased"}>

        {/* ✅ Recarga automática si hay ChunkLoadError tras un nuevo deploy */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (
                  e.message &&
                  (e.message.includes('ChunkLoadError') ||
                   e.message.includes('Loading chunk') ||
                   e.message.includes('Failed to fetch dynamically imported module'))
                ) {
                  if (!sessionStorage.getItem('chunk_reload')) {
                    sessionStorage.setItem('chunk_reload', '1');
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />

        {/* ✅ Sin cambios: verificación de sesión */}
        <AuthCheck />

        {children}

        {/* 🔔 TOAST GLOBAL */}
        <Toaster position="top-right" />

      </body>
    </html>
  );
}