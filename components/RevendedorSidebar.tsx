// components/RevendedorSidebar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function RevendedorSidebar() {
  const [open, setOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    if (!confirm("¿Estás seguro que querés cerrar sesión?")) {
      return;
    }

    setLoggingOut(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Error al cerrar sesión");
      }

      toast.success("Sesión cerrada exitosamente");
      
      // Redirigir al home
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast.error("Error al cerrar sesión");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
        open ? "w-64" : "w-16"
      }`}
    >
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center border-b">
        {open && (
          <span className="text-sm font-semibold text-gray-700">
            Panel
          </span>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-500 hover:text-gray-900"
        >
          ☰
        </button>
      </div>

      {/* NAV */}
      <nav className="p-4 space-y-2 flex-grow">

        <Link
          href="/dashboard/pedidos-fraccionados"
          className="block text-sm text-gray-700 hover:bg-gray-100 rounded px-3 py-2"
        >
          {open && "Resumen"}
        </Link>

        <Link
          href="/dashboard/pedidos-fraccionados/pedidos"
          className="block text-sm text-gray-700 hover:bg-gray-100 rounded px-3 py-2"
        >
          {open && "Mis pedidos"}
        </Link>

        <Link
          href="/dashboard/pedidos-fraccionados/perfil"
          className="block text-sm text-gray-700 hover:bg-gray-100 rounded px-3 py-2"
        >
          {open && "Perfil"}
        </Link>

      </nav>

      {/* 🆕 BOTÓN DE CERRAR SESIÓN */}
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full text-sm text-red-600 hover:bg-red-50 rounded px-3 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loggingOut ? (
            "Cerrando..."
          ) : (
            <>
              🚪 {open && "Cerrar sesión"}
            </>
          )}
        </button>
      </div>
    </aside>
  );
}