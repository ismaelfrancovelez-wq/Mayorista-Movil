import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthCheck from "../components/AuthCheck"; // ✅ NUEVO

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Plataforma",
  description: "Marketplace mayorista",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.variable + " antialiased"}>
        {/* ✅ NUEVO: Verificación de sesión */}
        <AuthCheck />
        
        {children}

        {/* 🔔 TOAST GLOBAL (UX PRO) */}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}