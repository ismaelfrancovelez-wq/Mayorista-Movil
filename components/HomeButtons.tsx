"use client";

import { useRouter } from "next/navigation";

export default function HomeButtons() {
  const router = useRouter();

  function selectRole(role: "manufacturer" | "retailer") {
    // Guardar rol elegido en localStorage
    localStorage.setItem("selectedRole", role);
    
    // Redirigir a login
    router.push("/login");
  }

  return (
    <div className="flex flex-col md:flex-row justify-center gap-4 mt-8">
      <button
        onClick={() => selectRole("retailer")}
        className="px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-medium hover:bg-blue-700 transition-all shadow-lg hover:scale-105"
      >
        Soy revendedor
      </button>

      <button
        onClick={() => selectRole("manufacturer")}
        className="px-8 py-4 bg-white/90 text-blue-700 rounded-xl text-lg font-medium hover:bg-white transition-all shadow-lg hover:scale-105"
      >
        Soy fabricante
      </button>
    </div>
  );
}