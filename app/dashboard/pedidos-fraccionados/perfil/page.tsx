"use client";

import { useEffect, useState } from "react";
// 1️⃣ Importación agregada
import { useRouter } from "next/navigation";

export default function PerfilRevendedorPage() {
  // 2️⃣ Router inicializado
  const router = useRouter();

  const [formattedAddress, setFormattedAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setFormattedAddress(
            data.address.formattedAddress || ""
          );
          setLat(
            data.address.lat !== undefined
              ? String(data.address.lat)
              : ""
          );
          setLng(
            data.address.lng !== undefined
              ? String(data.address.lng)
              : ""
          );
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

  return (
    <div className="max-w-xl">
      {/* 3️⃣ Botón "Volver" agregado */}
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

       {/* DIRECCIÓN - 🆕 CON AUTOCOMPLETADO */}
      <div className="mb-4">
        <label className="block text-sm mb-1 font-medium">
          Dirección *
        </label>
        <GooglePlacesAutocomplete
          value={formattedAddress}
          onChange={setFormattedAddress}
          onPlaceSelected={(place) => {
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

      {/* LAT / LNG - AHORA SOLO LECTURA */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1">
            Latitud
          </label>
          <input
            type="number"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            placeholder="-34.6037"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">
            Se completa automáticamente
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1">
            Longitud
          </label>
          <input
            type="number"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            placeholder="-58.3816"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">
            Se completa automáticamente
          </p>
        </div>
      </div>

      {/* MENSAJES */}
      {error && (
        <p className="text-red-600 text-sm mb-4">
          {error}
        </p>
      )}

      {success && (
        <p className="text-green-600 text-sm mb-4">
          Dirección guardada correctamente
        </p>
      )}

      {/* BOTÓN */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Guardar dirección"}
      </button>
    </div>
  );
}