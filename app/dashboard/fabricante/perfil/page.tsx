// app/dashboard/fabricante/perfil/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import GooglePlacesAutocomplete from "../../../../components/GooglePlacesAutocomplete";
import { uploadImage, validateImageFile } from "../../../../lib/firebase-storage";

type DaySchedule = {
  open: string;
  close: string;
  closed: boolean;
};

type WeekSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '00:00', close: '00:00', closed: true },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

export default function PerfilFabricantePage() {
  const router = useRouter();
  
  const [formattedAddress, setFormattedAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [mpEmail, setMpEmail] = useState("");

  // 🆕 Estados para eliminar cuenta
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ✅ NUEVO: cerrar sesión
  const [loggingOut, setLoggingOut] = useState(false);

  /* ===============================
     🔥 CARGAR DATOS EXISTENTES
  =============================== */
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/manufacturers/profile");
        if (!res.ok) return;

        const data = await res.json();

        if (data.address) {
          setFormattedAddress(data.address.formattedAddress || "");
          setLat(data.address.lat !== undefined ? String(data.address.lat) : "");
          setLng(data.address.lng !== undefined ? String(data.address.lng) : "");
        }

        setBusinessName(data.businessName || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setProfileImageUrl(data.profileImageUrl || "");
        
        if (data.schedule) {
          setSchedule(data.schedule);
        }
      } catch (err) {
        console.error("Error cargando perfil", err);
      }
    }

    async function loadVerificationStatus() {
      try {
        const res = await fetch("/api/manufacturers/verification/status");
        if (res.ok) {
          const data = await res.json();
          setVerificationStatus(data.status || 'unverified');
        }
      } catch (error) {
        console.error("Error verificando estado:", error);
      }
    }

    async function loadMPStatus() {
      try {
        const res = await fetch("/api/manufacturers/mp-status");
        if (res.ok) {
          const data = await res.json();
          setMpConnected(data.connected);
          setMpEmail(data.email || '');
        }
      } catch (error) {
        console.error("Error verificando MP:", error);
      }
    }

    loadProfile();
    loadVerificationStatus();
    loadMPStatus();
  }, []);

  /* ===============================
     💾 GUARDAR PERFIL
  =============================== */
  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!formattedAddress || !lat || !lng) {
      setError("Completá todos los campos de dirección");
      setLoading(false);
      return;
    }

    if (!businessName) {
      setError("El nombre de la empresa es obligatorio");
      setLoading(false);
      return;
    }

    try {
      let imageUrl = profileImageUrl;
      
      if (profileImage) {
        const validation = validateImageFile(profileImage);
        if (!validation.valid) {
          setError(validation.error || "Imagen inválida");
          setLoading(false);
          return;
        }

        try {
          setUploadingImage(true);
          console.log("📤 Subiendo imagen de perfil...");
          imageUrl = await uploadImage(profileImage, "manufacturers");
          console.log("✅ Imagen subida:", imageUrl);
          setProfileImageUrl(imageUrl);
          setProfileImage(null);
        } catch (uploadErr: any) {
          console.error("❌ Error subiendo imagen:", uploadErr);
          setError(
            "No se pudo subir la imagen. " +
            (uploadErr?.message || "Verificá tu conexión e intentá de nuevo.")
          );
          setLoading(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      const res = await fetch("/api/manufacturers/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            formattedAddress,
            lat: Number(lat),
            lng: Number(lng),
          },
          businessName,
          phone,
          email,
          schedule,
          profileImageUrl: imageUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Error al guardar perfil");
    } finally {
      setLoading(false);
    }
  }

  /* ===============================
     🚪 CERRAR SESIÓN
  =============================== */
  async function handleLogout() {
    if (!confirm("¿Estás seguro que querés cerrar sesión?")) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Error al cerrar sesión");
      toast.success("Sesión cerrada exitosamente");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error("Error al cerrar sesión");
    } finally {
      setLoggingOut(false);
    }
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

  /* ===============================
     🕐 ACTUALIZAR HORARIO DE UN DÍA
  =============================== */
  function updateDaySchedule(day: keyof WeekSchedule, updates: Partial<DaySchedule>) {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], ...updates }
    }));
  }

  /* ===============================
     🎨 RENDERIZAR EDITOR DE HORARIOS
  =============================== */
  const days: { key: keyof WeekSchedule; label: string }[] = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  const isWorking = loading || uploadingImage;

  return (
    <div className="max-w-3xl mx-auto">
      {/* BOTÓN VOLVER */}
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
        Esta información aparecerá en tus productos y será visible para los revendedores.
      </p>

      {/* MENSAJES */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded mb-6">
          ✅ Perfil guardado correctamente
        </div>
      )}

      {/* INFORMACIÓN BÁSICA */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">🏢 Información básica</h2>

        <div className="mb-4">
          <label className="block text-sm mb-1 font-medium">
            Nombre de la empresa *
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Ej: Fábrica de Zapatillas XYZ"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1 font-medium">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="1123456789"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="contacto@empresa.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1 font-medium">
            Foto de perfil
          </label>
          {profileImageUrl && (
            <img 
              src={profileImageUrl} 
              alt="Perfil actual" 
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProfileImage(e.target.files?.[0] || null)}
            className="text-sm"
          />
          {profileImage && (
            <p className="text-xs text-blue-600 mt-1">
              📎 {profileImage.name} — se subirá al guardar
            </p>
          )}
          {uploadingImage && (
            <p className="text-xs text-blue-600 mt-1 animate-pulse">
              ⏳ Subiendo imagen...
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Recomendado: imagen cuadrada, mínimo 200x200px
          </p>
        </div>

        {/* VERIFICACIÓN EN PERFIL */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            {verificationStatus === 'verified' ? '✓' : 
             verificationStatus === 'pending' ? '⏳' : 
             verificationStatus === 'rejected' ? '✕' : '🏢'}
            Verificación de empresa
          </h3>
          
          {verificationStatus === 'verified' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">
                ✓ Tu empresa está verificada
              </p>
            </div>
          )}

          {verificationStatus === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800 font-medium">
                ⏳ Verificación en proceso
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Tu solicitud está siendo revisada
              </p>
            </div>
          )}

          {verificationStatus === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
              <p className="text-sm text-red-800 font-medium mb-2">
                ✕ Verificación rechazada
              </p>
              <Link
                href="/dashboard/fabricante/verificacion"
                className="text-sm text-red-600 hover:underline"
              >
                Ver motivo y corregir →
              </Link>
            </div>
          )}

          {verificationStatus === 'unverified' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700 mb-2">
                Verificá tu empresa para generar más confianza
              </p>
              <Link
                href="/dashboard/fabricante/verificacion"
                className="inline-block text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Iniciar verificación →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* DIRECCIÓN */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">📍 Dirección de la fábrica</h2>

        <div className="mb-4">
          <label className="block text-sm mb-1 font-medium">Dirección *</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1 font-medium">Latitud *</label>
            <input
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full border rounded px-3 py-2 bg-gray-50"
              placeholder="-34.6037"
              step="any"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Se completa automáticamente</p>
          </div>

          <div>
            <label className="block text-sm mb-1 font-medium">Longitud *</label>
            <input
              type="number"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full border rounded px-3 py-2 bg-gray-50"
              placeholder="-58.3816"
              step="any"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Se completa automáticamente</p>
          </div>
        </div>
      </div>

      {/* HORARIOS DE ATENCIÓN */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">📅 Horarios de atención</h2>
        <p className="text-sm text-gray-600 mb-4">
          Configurá los días y horarios en los que los revendedores pueden retirar mercadería.
        </p>

        <div className="space-y-3">
          {days.map(day => {
            const daySchedule = schedule[day.key];
            
            return (
              <div key={day.key} className="flex items-center gap-4">
                <div className="w-28">
                  <span className="text-sm font-medium">{day.label}</span>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!daySchedule.closed}
                    onChange={(e) => updateDaySchedule(day.key, { closed: !e.target.checked })}
                  />
                  <span className="text-sm">Abierto</span>
                </label>

                {!daySchedule.closed && (
                  <>
                    <input
                      type="time"
                      value={daySchedule.open}
                      onChange={(e) => updateDaySchedule(day.key, { open: e.target.value })}
                      className="border rounded px-3 py-1 text-sm"
                    />
                    <span className="text-sm">a</span>
                    <input
                      type="time"
                      value={daySchedule.close}
                      onChange={(e) => updateDaySchedule(day.key, { close: e.target.value })}
                      className="border rounded px-3 py-1 text-sm"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MERCADO PAGO */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">💳 Mercado Pago</h2>
        
        {mpConnected === true && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-green-800 font-medium">✓ Cuenta vinculada</p>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Activa</span>
            </div>
            {mpEmail && <p className="text-sm text-green-700">{mpEmail}</p>}
          </div>
        )}

        {mpConnected === false && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800 font-medium mb-2">⚠️ Cuenta no vinculada</p>
            <p className="text-sm text-orange-700 mb-3">
              Vinculá tu Mercado Pago para recibir pagos directamente
            </p>
          </div>
        )}

        <Link
          href="/dashboard/fabricante/vinculacion-mp"
          className="inline-block text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition mt-3"
        >
          {mpConnected ? 'Gestionar vinculación' : 'Vincular Mercado Pago'} →
        </Link>
      </div>

      {/* BOTÓN GUARDAR */}
      <button
        onClick={handleSave}
        disabled={isWorking}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {uploadingImage ? "Subiendo imagen..." : loading ? "Guardando..." : "Guardar perfil"}
      </button>

      {/* ✅ CERRAR SESIÓN */}
      <div className="mt-12 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Sesión</h2>
        <p className="text-sm text-gray-500 mb-4">Cerrá tu sesión en este dispositivo.</p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
        >
          🚪 {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
      </div>

      {/* =====================
          🗑️ ZONA DE PELIGRO
      ===================== */}
      <div className="mt-8 border-t border-red-200 pt-8 mb-12">
        <h2 className="text-lg font-semibold text-red-600 mb-1">Zona de peligro</h2>
        <p className="text-sm text-gray-500 mb-4">
          Eliminar tu cuenta es permanente. Se borrarán tu perfil, productos, verificación y datos asociados.
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