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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      <h1 className="text-2xl font-semibold mb-2">Configuración del perfil</h1>
      <p className="text-gray-500 text-sm mb-8">
        Ingresá tu dirección. Esta información se usa para calcular envíos.
      </p>

      {/* DIRECCIÓN */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Dirección de entrega</h2>
        <div className="mb-4">
          <label className="block text-sm mb-1 font-medium text-gray-700">Dirección *</label>
          <GooglePlacesAutocomplete
            value={formattedAddress}
            onChange={setFormattedAddress}
            onPlaceSelected={(place: PlaceResult) => {
              setFormattedAddress(place.formattedAddress);
              setLat(String(place.lat));
              setLng(String(place.lng));
            }}
            placeholder="Empieza a escribir tu dirección..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          />
          <p className="text-xs text-gray-400 mt-1">
            💡 Empieza a escribir y seleccioná de las sugerencias
          </p>
        </div>

        <input type="hidden" value={lat} onChange={(e) => setLat(e.target.value)} />
        <input type="hidden" value={lng} onChange={(e) => setLng(e.target.value)} />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4">✓ Dirección guardada correctamente</p>}

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar dirección"}
        </button>
      </div>

      {/* ZONA DE PELIGRO */}
      <div className="bg-white rounded-xl border border-red-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-1">Zona de peligro</h2>
        <p className="text-sm text-gray-500 mb-4">
          Eliminar tu cuenta es permanente. Se borrarán todos tus datos y no podrás recuperarlos.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-red-400 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition text-sm font-medium"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-5">
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
              className="w-full border border-red-300 rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:border-red-500"
              placeholder="ELIMINAR"
            />
            {deleteError && <p className="text-red-600 text-xs mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deletingAccount ? "Eliminando..." : "Confirmar eliminación"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
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