"use client";

import { useState, useEffect } from "react";
// 1️⃣ Importación agregada
import BackButton from "../../../../components/BackButton"; 

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export default function VerificacionPage() {
  const [status, setStatus] = useState<VerificationStatus>('unverified');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // 🧾 1️⃣ Datos de la empresa
  const [legalName, setLegalName] = useState("");
  const [cuit, setCuit] = useState("");
  const [taxType, setTaxType] = useState<"monotributo" | "responsable_inscripto" | "sociedad">("monotributo");
  const [fantasyName, setFantasyName] = useState("");

  // 📍 2️⃣ Dirección
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // 👤 3️⃣ Responsable
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // 📂 5️⃣ Documentación
  const [afipDoc, setAfipDoc] = useState<File | null>(null);

  // 🔐 7️⃣ Confirmaciones
  const [confirmTruth, setConfirmTruth] = useState(false);
  const [confirmAuthorization, setConfirmAuthorization] = useState(false);

  const [rejectionReason, setRejectionReason] = useState("");

  // Cargar estado actual
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/manufacturers/verification/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status || 'unverified');
          
          if (data.legalName) setLegalName(data.legalName);
          if (data.cuit) setCuit(data.cuit);
          if (data.taxType) setTaxType(data.taxType);
          if (data.fantasyName) setFantasyName(data.fantasyName);
          if (data.street) setStreet(data.street);
          if (data.city) setCity(data.city);
          if (data.province) setProvince(data.province);
          if (data.postalCode) setPostalCode(data.postalCode);
          if (data.contactName) setContactName(data.contactName);
          if (data.contactPhone) setContactPhone(data.contactPhone);
          if (data.contactEmail) setContactEmail(data.contactEmail);
          if (data.rejectionReason) setRejectionReason(data.rejectionReason);
        }
      } catch (err) {
        console.error("Error cargando estado:", err);
      }
    }
    loadStatus();
  }, []);

  // Geocodificar dirección (simulado - usar Google Maps API en prod)
  async function geocodeAddress() {
    const fullAddress = `${street}, ${city}, ${province}, ${postalCode}`;
    setLat(-34.6037);
    setLng(-58.3816);
  }

  useEffect(() => {
    if (street && city && province && postalCode) {
      geocodeAddress();
    }
  }, [street, city, province, postalCode]);

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setSuccess(false);

    if (!legalName || !cuit || !street || !city || !province || !postalCode) {
      setError("Completá todos los campos obligatorios");
      setLoading(false);
      return;
    }

    if (cuit.replace(/\D/g, '').length !== 11) {
      setError("CUIT inválido (debe tener 11 dígitos)");
      setLoading(false);
      return;
    }

    if (!contactName || !contactPhone || !contactEmail) {
      setError("Completá los datos del responsable de contacto");
      setLoading(false);
      return;
    }

    if (!afipDoc) {
      setError("Debés subir la constancia de AFIP");
      setLoading(false);
      return;
    }

    if (afipDoc.size > 5 * 1024 * 1024) {
      setError("El archivo es demasiado grande (máx 5MB)");
      setLoading(false);
      return;
    }

    if (!confirmTruth || !confirmAuthorization) {
      setError("Debés aceptar las confirmaciones finales");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('legalName', legalName);
      formData.append('cuit', cuit);
      formData.append('taxType', taxType);
      formData.append('fantasyName', fantasyName);
      formData.append('street', street);
      formData.append('city', city);
      formData.append('province', province);
      formData.append('postalCode', postalCode);
      formData.append('lat', String(lat || 0));
      formData.append('lng', String(lng || 0));
      formData.append('contactName', contactName);
      formData.append('contactPhone', contactPhone);
      formData.append('contactEmail', contactEmail);
      formData.append('afipDoc', afipDoc);

      const res = await fetch("/api/manufacturers/verification/submit", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar solicitud");
      }

      setSuccess(true);
      setStatus('pending');
    } catch (err: any) {
      setError(err.message || "Error al enviar solicitud");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      
      {/* 2️⃣ Botón agregado con margen inferior */}
      <BackButton className="mb-6" />

      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">
          🏢 Empresa Verificada
        </h1>
        <p className="text-gray-600">
          Verificá tu empresa para que los revendedores confíen más en tus productos
        </p>
      </div>

      {/* ESTADO INTERNO (solo para el fabricante) */}
      {status === 'verified' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900">¡Tu empresa está verificada!</h2>
              <p className="text-blue-700">Los revendedores verán el badge azul de verificación en tus productos.</p>
            </div>
          </div>
        </div>
      )}

      {status === 'pending' && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="text-4xl">⏳</div>
            <div>
              <h2 className="text-xl font-bold text-yellow-900">Solicitud en revisión</h2>
              <p className="text-yellow-700">Estamos verificando tu documentación. Te notificaremos cuando esté aprobada (24-48hs hábiles).</p>
            </div>
          </div>
        </div>
      )}

      {status === 'rejected' && rejectionReason && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-4xl">✕</div>
            <div>
              <h2 className="text-xl font-bold text-red-900">Solicitud rechazada</h2>
              <p className="text-red-700 mb-2"><strong>Motivo:</strong> {rejectionReason}</p>
              <p className="text-red-600 text-sm">Podés corregir la información y volver a enviar la solicitud.</p>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO (ocultar si está verificado) */}
      {status !== 'verified' && (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
              ❌ {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl mb-6">
              ✅ Solicitud enviada correctamente. La revisaremos en las próximas 24-48hs hábiles.
            </div>
          )}

          {/* 🧾 1️⃣ DATOS DE LA EMPRESA */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="font-bold text-xl mb-1 flex items-center gap-2">
              🧾 1️⃣ Datos de la empresa
            </h2>
            <p className="text-sm text-gray-600 mb-6">Información legal y tributaria</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Razón social <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Fábrica Textil San Martín S.R.L."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  CUIT <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={cuit}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      if (value.length > 2) value = value.slice(0, 2) + '-' + value.slice(2);
                      if (value.length > 11) value = value.slice(0, 11) + '-' + value.slice(11);
                      setCuit(value);
                    }
                  }}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="30-12345678-9"
                  maxLength={13}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Tipo de contribuyente <span className="text-red-600">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="taxType"
                      checked={taxType === 'monotributo'}
                      onChange={() => setTaxType('monotributo')}
                      className="w-4 h-4"
                    />
                    <span>Monotributo</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="taxType"
                      checked={taxType === 'responsable_inscripto'}
                      onChange={() => setTaxType('responsable_inscripto')}
                      className="w-4 h-4"
                    />
                    <span>Responsable Inscripto</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="taxType"
                      checked={taxType === 'sociedad'}
                      onChange={() => setTaxType('sociedad')}
                      className="w-4 h-4"
                    />
                    <span>Sociedad (SRL / SA / SAS)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Nombre de fantasía <span className="text-gray-500">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={fantasyName}
                  onChange={(e) => setFantasyName(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Textil San Martín"
                />
              </div>
            </div>
          </div>

          {/* 📍 2️⃣ DIRECCIÓN */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="font-bold text-xl mb-1 flex items-center gap-2">
              📍 2️⃣ Dirección de la empresa
            </h2>
            <p className="text-sm text-gray-600 mb-6">Domicilio fiscal y comercial</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Calle y número <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Av. San Martín 1234"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Ciudad / Localidad <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="Ej: Hurlingham"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Provincia <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="Ej: Buenos Aires"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Código postal <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: 1686"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                📌 Las coordenadas se calculan automáticamente según la dirección ingresada
              </div>
            </div>
          </div>

          {/* 👤 3️⃣ RESPONSABLE */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="font-bold text-xl mb-1 flex items-center gap-2">
              👤 3️⃣ Responsable de contacto
            </h2>
            <p className="text-sm text-gray-600 mb-6">Persona autorizada para validar la información</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Nombre y apellido <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Teléfono de contacto <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: +54 9 11 1234-5678"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Email de contacto <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: ventas@empresa.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se acepta Gmail, pero se recomienda email corporativo
                </p>
              </div>
            </div>
          </div>

          {/* 📂 5️⃣ DOCUMENTACIÓN */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="font-bold text-xl mb-1 flex items-center gap-2">
              📂 5️⃣ Documentación fiscal
            </h2>
            <p className="text-sm text-gray-600 mb-6">Archivos necesarios para la verificación</p>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Constancia de inscripción AFIP <span className="text-red-600">*</span>
              </label>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setAfipDoc(e.target.files?.[0] || null)}
                  className="hidden"
                  id="afip-upload"
                />
                <label
                  htmlFor="afip-upload"
                  className="cursor-pointer"
                >
                  {afipDoc ? (
                    <div className="text-green-600">
                      <div className="text-4xl mb-2">✓</div>
                      <p className="font-semibold">{afipDoc.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(afipDoc.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📎</div>
                      <p className="font-semibold text-blue-600">Subir constancia AFIP</p>
                      <p className="text-xs text-gray-500 mt-1">
                        PDF / JPG / PNG - Máx 5 MB
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-semibold mb-2">ℹ️ El documento debe mostrar:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>CUIT de la empresa</li>
                  <li>Razón social</li>
                  <li>Estado activo en AFIP</li>
                </ul>
                <p className="mt-3 text-xs text-gray-600">
                  Esta información es confidencial y no se comparte con terceros.
                </p>
              </div>
            </div>
          </div>

          {/* 🔐 7️⃣ CONFIRMACIONES */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="font-bold text-xl mb-1 flex items-center gap-2">
              🔐 7️⃣ Confirmaciones finales
            </h2>
            <p className="text-sm text-gray-600 mb-6">Aceptación de términos y condiciones</p>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={confirmTruth}
                  onChange={(e) => setConfirmTruth(e.target.checked)}
                  className="w-5 h-5 mt-0.5"
                />
                <span className="text-sm">
                  Declaro que la información ingresada es real y corresponde a mi empresa
                </span>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={confirmAuthorization}
                  onChange={(e) => setConfirmAuthorization(e.target.checked)}
                  className="w-5 h-5 mt-0.5"
                />
                <span className="text-sm">
                  Autorizo a la plataforma a verificar estos datos con fines comerciales
                </span>
              </label>
            </div>
          </div>

          {/* BOTÓN ENVIAR */}
          <button
            onClick={handleSubmit}
            disabled={loading || status === 'pending'}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? "Enviando..." : status === 'pending' ? "Solicitud en Revisión" : "✓ Enviar Solicitud de Verificación"}
          </button>
        </>
      )}
    </div>
  );
}