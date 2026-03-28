"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../../lib/firebase-client";
import { useRouter, useSearchParams } from "next/navigation";

type UserRole = "manufacturer" | "retailer" | "distributor" | "wholesaler";

const ROLE_LABELS: Record<UserRole, string> = {
  manufacturer: "Fabricante",
  retailer:     "Revendedor",
  distributor:  "Distribuidor",
  wholesaler:   "Mayorista",
};

const VALID_ROLES: UserRole[] = ["manufacturer", "retailer", "distributor", "wholesaler"];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // ✅ FIX: leer el parámetro ?redirect= para volver al producto tras el login
  // Ejemplo: /login?role=retailer&redirect=/explorar/abc123
  const redirectTo = searchParams?.get("redirect") || null;

  useEffect(() => {
    const roleFromUrl = searchParams?.get("role") as UserRole | null;

    if (roleFromUrl && VALID_ROLES.includes(roleFromUrl)) {
      setSelectedRole(roleFromUrl);
      localStorage.setItem("selectedRole", roleFromUrl);
      return;
    }

    const roleFromStorage = localStorage.getItem("selectedRole") as UserRole | null;

    if (roleFromStorage && VALID_ROLES.includes(roleFromStorage)) {
      setSelectedRole(roleFromStorage);
      return;
    }

    // ✅ Si viene de un producto sin rol, asignamos retailer por defecto
    // Es el rol más común para alguien que llega desde /explorar
    if (redirectTo?.startsWith("/explorar/")) {
      setSelectedRole("retailer");
      localStorage.setItem("selectedRole", "retailer");
      return;
    }

    router.push("/");
  }, [router, searchParams, redirectTo]);

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[selectedRole];

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.ok) {
        const data = await res.json();
        redirectAfterAuth(data.role);
      } else if (res.status === 403) {
        await registerUser(idToken);
      } else {
        throw new Error("Login backend falló");
      }
    } catch (err) {
      console.error(err);
      setError("Email o contraseña incorrectos");
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.ok) {
        const data = await res.json();
        redirectAfterAuth(data.role);
      } else if (res.status === 403) {
        await registerUser(idToken);
      } else {
        throw new Error("Login backend falló");
      }
    } catch (err) {
      console.error(err);
      setError("Error al iniciar sesión con Google");
      setLoading(false);
    }
  }

  async function registerUser(idToken: string) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, usertype: selectedRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al registrar");
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!loginRes.ok) throw new Error("Login falló después del registro");

      const data = await loginRes.json();
      localStorage.removeItem("selectedRole");
      redirectAfterAuth(data.role);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al completar registro");
      setLoading(false);
    }
  }

  // ✅ FIX: si hay redirect válido, va ahí. Si no, dashboard según rol.
  // Valida que sea URL relativa para evitar open redirect attacks.
  function redirectAfterAuth(role: string) {
    localStorage.removeItem("selectedRole");

    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      router.push(redirectTo);
      return;
    }

    if (role === "retailer") {
      router.push("/explorar");
    } else {
      router.push("/dashboard/fabricante");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">

        <div className="text-center mb-6">
          <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            {roleLabel}
          </div>
          <h1 className="text-2xl font-semibold mb-2">Iniciar sesión</h1>
          <p className="text-gray-600 text-sm">
            Ingresá a tu cuenta de {roleLabel.toLowerCase()}
          </p>
          {/* ✅ FIX: mensaje contextual cuando viene desde un producto */}
          {redirectTo?.startsWith("/explorar/") && (
            <p className="text-blue-600 text-sm mt-2 font-medium">
              Ingresá para unirte al lote →
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border-2 border-gray-300 py-3 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 disabled:opacity-50 transition mb-4"
        >
          <Image src="/google.svg" alt="Google" width={20} height={20} />
          <span className="font-medium">Continuar con Google</span>
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">O con email</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Volver y elegir otro rol
          </button>
        </div>
      </div>
    </div>
  );
}