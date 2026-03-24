"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Props mínimas — solo lo que necesita la barra
type Props = {
  userEmail: string;
  userName: string;
};

export default function RetailerNavBar({ userEmail, userName }: Props) {
  const pathname = usePathname();
  const displayName = userName || userEmail.split("@")[0];

  const links = [
    {
      href: "/explorar",
      label: "Explorar",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      href: "/dashboard/pedidos-fraccionados/pedidos",
      label: "Mis pedidos",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      href: "/dashboard/pedidos-fraccionados/perfil",
      label: "Perfil",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between gap-4 h-14">

          {/* Avatar + nombre */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-none truncate">{displayName}</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Revendedor</p>
            </div>
          </div>

          {/* Navegación */}
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {link.icon}
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Email compacto */}
          <p className="hidden md:block text-xs text-gray-400 truncate max-w-[180px]">{userEmail}</p>

        </div>
      </div>
    </div>
  );
}