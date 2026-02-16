"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GooglePlacesAutocomplete, { PlaceResult } from "../../../../components/GooglePlacesAutocomplete";

export default function PerfilRevendedorPage() {
  const router = useRouter();

  const [formattedAddress, setFormattedAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para eliminar cuenta
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ===============================
      📥 CARGAR DIRECCIÓN
  =============================== */
  useEffect(() => {
    async function loadAddress() {
      try {
        const res = await fetch("/api/retailers/address");
        if (!res.ok) return;

        const data = await res.json();

        if (data?.address) {
          setFormattedAddress(data.address.formattedAddress || "");
          setLat(data.address.lat !== undefined ? String(data.address.lat) : "");
          setLng(data.address.lng !== undefined ? String(data.address.lng) : "");
        }
      } catch (err) {
        console.error("Error cargando dirección", err);
      }
    }

    loadAddress();
  }, []);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!formattedAddress || !lat || !lng) {
      setError("Completá todos los campos");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/retailers/address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formattedAddress,
        lat: Number(lat),
        lng: Number(lng),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data?.error || "Error al guardar dirección");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  /* ===============================
      🗑️ ELIMINAR CUENTA
  =============================== */
  async function handleDeleteAccount() {
    if (deleteConfirmText !== "ELIMINAR") {
      setDeleteError("Escribí ELIMINAR para confirmar");
      return;
    }

    setDeletingAccount(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/auth/delete-account", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar la cuenta");
      }

      router.push("/");
    } catch (err: any) {
      setDeleteError(err.message || "Error al eliminar la cuenta");
      setDeletingAccount(false);
    }
  }

  return (
    <div className="max-w-xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2 font-medium"
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-semibold mb-6">
        Configuración del perfil
      </h1>

      <p className="text-gray-600 mb-8">
        Ingresá tu dirección.
        Esta información se usa para calcular envíos.
      </p>

      {/* DIRECCIÓN - CON AUTOCOMPLETADO */}
      <div className="mb-4">
        <label className="block text-sm mb-1 font-medium">
          Dirección *
        </label>
        <GooglePlacesAutocomplete
          value={formattedAddress}
          onChange={setFormattedAddress}
          onPlaceSelected={(place: PlaceResult) => {
            setFormattedAddress(place.formattedAddress);
            setLat(String(place.lat));
            setLng(String(place.lng));
          }}
          placeholder="Empieza a escribir tu dirección..."
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          💡 Empieza a escribir y selecciona de las sugerencias
        </p>
      </div>

      {/* LAT / LNG - SOLO LECTURA */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1">Latitud</label>
          <input
            type="number"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            placeholder="-34.6037"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">Se completa automáticamente</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Longitud</label>
          <input
            type="number"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            placeholder="-58.3816"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">Se completa automáticamente</p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">Dirección guardada correctamente</p>}

      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Guardar dirección"}
      </button>

      {/* =====================
          🗑️ ZONA DE PELIGRO
      ===================== */}
      <div className="mt-16 border-t border-red-200 pt-8">
        <h2 className="text-lg font-semibold text-red-600 mb-1">Zona de peligro</h2>
        <p className="text-sm text-gray-500 mb-4">
          Eliminar tu cuenta es permanente. Se borrarán todos tus datos y no podrás recuperarlos.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-red-500 text-red-500 px-4 py-2 rounded hover:bg-red-50 transition text-sm font-medium"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-red-700 mb-3">
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Escribí <strong>ELIMINAR</strong> para confirmar:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full border border-red-300 rounded px-3 py-2 mb-3 text-sm focus:outline-none focus:border-red-500"
              placeholder="ELIMINAR"
            />
            {deleteError && (
              <p className="text-red-600 text-xs mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deletingAccount ? "Eliminando..." : "Confirmar eliminación"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}