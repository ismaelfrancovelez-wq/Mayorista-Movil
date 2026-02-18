// app/dashboard/fabricante/productos/nuevo/page.tsx
// ✅ VERSIÓN ACTUALIZADA - 4 zonas (z1,z2,z3,z4) + validación de exclusividad

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductCategory, CATEGORY_LABELS } from "../../../../../lib/types/product";
import { uploadImage, validateImageFile } from "../../../../../lib/firebase-storage";
import toast from "react-hot-toast";

/* ===============================
   🛡️ FUNCIONES DE SANITIZACIÓN
=============================== */
function sanitizeText(text: string, maxLength: number = 100): string {
  return text.trim().substring(0, maxLength);
}

function sanitizeNumber(value: number | "", min: number = 0, max: number = 1000000): number | "" {
  if (value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return Math.max(min, Math.min(max, num));
}

export default function NuevoProductoPage() {
  const router = useRouter();

  /* ===============================
     📦 DATOS BÁSICOS
  =============================== */
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [minimumOrder, setMinimumOrder] = useState<number | "">("");
  const [netProfitPerUnit, setNetProfitPerUnit] = useState<number | "">("");
  
  const [category, setCategory] = useState<ProductCategory>("otros");

  /* ===============================
     🖼️ IMAGEN DEL PRODUCTO
  =============================== */
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  /* ===============================
     🚚 MÉTODOS DE ENVÍO
  =============================== */
  const [factoryPickup, setFactoryPickup] = useState(false);
  const [ownLogistics, setOwnLogistics] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);

  /* ===============================
     🚚 ENVÍO PROPIO
  =============================== */
  const [ownType, setOwnType] = useState<"per_km" | "zones" | "">("");

  // Precio por km
  const [pricePerKm, setPricePerKm] = useState<number | "">("");
  const [roundTrip, setRoundTrip] = useState(false); // ✅ Por defecto: SOLO IDA
  // ✅ 4 zonas (z1, z2, z3, z4)
  const [zones, setZones] = useState({
    z1: "",  // 0-15km
    z2: "",  // 15-35km
    z3: "",  // 35-60km
    z4: "",  // +60km
  });

  // Envío por terceros
  const [thirdPartyPrice, setThirdPartyPrice] = useState<number | "">("");

  /* ===============================
     ⚠️ UI
  =============================== */
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ===============================
     🖼️ MANEJO DE IMAGEN
  =============================== */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Imagen inválida");
      return;
    }

    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  /* ===============================
     ✅ VALIDACIÓN DE EXCLUSIVIDAD
  =============================== */
  const handleOwnLogisticsChange = (checked: boolean) => {
    if (checked && thirdParty) {
      setError("No podés elegir envío propio y envío por terceros al mismo tiempo");
      return;
    }
    setOwnLogistics(checked);
    if (!checked) {
      setOwnType("");
    }
    setError(null);
  };

  const handleThirdPartyChange = (checked: boolean) => {
    if (checked && ownLogistics) {
      setError("No podés elegir envío por terceros y envío propio al mismo tiempo");
      return;
    }
    setThirdParty(checked);
    setError(null);
  };

  /* ===============================
     💾 SUBMIT CON VALIDACIÓN REFORZADA
  =============================== */
  async function handleSubmit() {
    setError(null);

    const sanitizedName = sanitizeText(name, 100);
    
    if (sanitizedName.length < 3) {
      setError("El nombre debe tener al menos 3 caracteres");
      return;
    }

    if (price === "" || price <= 0) {
      setError("Ingresá un precio válido");
      return;
    }

    if (minimumOrder === "" || minimumOrder <= 0) {
      setError("Ingresá un pedido mínimo válido");
      return;
    }

    if (netProfitPerUnit === "" || netProfitPerUnit < 0) {
      setError("Ingresá una ganancia neta válida (0 o mayor)");
      return;
    }

    if (!factoryPickup && !ownLogistics && !thirdParty) {
      setError("Elegí al menos un método de envío");
      return;
    }

    if (ownLogistics && thirdParty) {
      setError("No podés elegir envío propio y envío por terceros al mismo tiempo");
      return;
    }

    if (ownLogistics && !ownType) {
      setError("Seleccioná cómo calcular el envío propio (por km o por zonas)");
      return;
    }

    if (ownLogistics && ownType === "per_km") {
      if (pricePerKm === "" || pricePerKm <= 0) {
        setError("Ingresá un precio por kilómetro válido");
        return;
      }
    }

    if (ownLogistics && ownType === "zones") {
      if (!zones.z1 || !zones.z2 || !zones.z3 || !zones.z4) {
        setError("Completá los precios de las 4 zonas");
        return;
      }
      const z1 = Number(zones.z1);
      const z2 = Number(zones.z2);
      const z3 = Number(zones.z3);
      const z4 = Number(zones.z4);
      if (z1 <= 0 || z2 <= 0 || z3 <= 0 || z4 <= 0) {
        setError("Los precios de zonas deben ser mayores a 0");
        return;
      }
    }

    if (thirdParty) {
      if (thirdPartyPrice === "" || thirdPartyPrice <= 0) {
        setError("Ingresá un precio de envío por terceros válido");
        return;
      }
    }

    /* ===============================
       📦 ARMADO SHIPPING
    =============================== */
    const shipping: any = { methods: [] };

    if (factoryPickup) {
      shipping.methods.push("factory_pickup");
    }

    if (ownLogistics) {
      shipping.methods.push("own_logistics");

      if (ownType === "per_km") {
  shipping.ownLogistics = {
    type: "per_km",
    pricePerKm: Number(pricePerKm),
    roundTrip: roundTrip,  // ✅ NUEVO
  };
}

      if (ownType === "zones") {
        shipping.ownLogistics = {
          type: "zones",
          zones: {
            z1: Number(zones.z1),
            z2: Number(zones.z2),
            z3: Number(zones.z3),
            z4: Number(zones.z4),
          },
        };
      }
    }

    if (thirdParty) {
      shipping.methods.push("third_party");
      shipping.thirdParty = {
        fixedPrice: Number(thirdPartyPrice),
      };
    }

    /* ===============================
       🖼️ SUBIR IMAGEN
    =============================== */
    setLoading(true);
    let imageUrl = "";

    try {
      if (imageFile) {
        setUploadingImage(true);
        toast.loading("Subiendo imagen...");
        imageUrl = await uploadImage(imageFile, "products");
        toast.dismiss();
        toast.success("Imagen subida correctamente");
        setUploadingImage(false);
      }

      /* ===============================
         🚀 API CON DATOS SANITIZADOS
      =============================== */
      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sanitizedName,
          price: Number(price),
          minimumOrder: Number(minimumOrder),
          netProfitPerUnit: Number(netProfitPerUnit),
          category,
          shipping,
          imageUrl,
        }),
      });

      setLoading(false);

      if (res.ok) {
        toast.success("Producto creado exitosamente");
        router.push("/dashboard/fabricante/productos");
      } else {
        const data = await res.json();
        setError(data.error || "Error al crear producto");
      }
    } catch (err: any) {
      setLoading(false);
      setUploadingImage(false);
      setError(err.message || "Error al crear producto");
      toast.error(err.message || "Error al crear producto");
    }
  }

  /* ===============================
     🧾 UI
  =============================== */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-3xl font-semibold mb-6">
          Nuevo producto
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* DATOS BÁSICOS */}
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-lg mb-4">Información básica</h2>

          <div>
            <label className="block text-sm mb-1">Nombre del producto</label>
            <input
              placeholder="Ej: Zapatillas deportivas"
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Categoría</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* IMAGEN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagen del producto (opcional)
            </label>
            
            {!imagePreview ? (
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-10 h-10 mb-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click para subir</span> o arrastra una imagen
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG o WEBP (MAX. 5MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Precio por unidad</label>
              <input
                type="number"
                placeholder="1000"
                className="w-full border rounded px-3 py-2"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Pedido mínimo</label>
              <input
                type="number"
                placeholder="10"
                className="w-full border rounded px-3 py-2"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(Number(e.target.value))}
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">
              Ganancia neta por unidad (solo para vos)
            </label>
            <input
              type="number"
              placeholder="200"
              className="w-full border rounded px-3 py-2"
              value={netProfitPerUnit}
              onChange={(e) => setNetProfitPerUnit(Number(e.target.value))}
              min={0}
            />
          </div>
        </div>

        {/* ENVÍOS */}
        <div className="bg-white rounded-xl shadow p-6 mb-8 space-y-3">
          <h2 className="font-semibold mb-2">
            Métodos de envío
          </h2>
          
          <p className="text-sm text-gray-600 mb-4">
            Retiro en fábrica puede combinarse con cualquier otro método. 
            Los demás métodos son exclusivos entre sí.
          </p>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={factoryPickup}
              onChange={(e) => setFactoryPickup(e.target.checked)}
            />
            <span>Retiro en fábrica (gratis)</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ownLogistics}
              onChange={(e) => handleOwnLogisticsChange(e.target.checked)}
            />
            <span>Envío propio</span>
          </label>

          {ownLogistics && (
            <div className="ml-6 space-y-2 border-l-2 pl-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={ownType === "per_km"}
                  onChange={() => setOwnType("per_km")}
                />
                <span>Por kilómetro</span>
              </label>

              {ownType === "per_km" && (
  <div className="space-y-3 ml-4 border-l-2 border-gray-200 pl-4">
    {/* Input de precio */}
    <div>
      <label className="block text-sm mb-1">Precio por kilómetro</label>
      <input
        type="number"
        placeholder="Ej: 85"
        className="border rounded px-3 py-2 w-full"
        value={pricePerKm}
        onChange={(e) => setPricePerKm(Number(e.target.value))}
        min={0}
      />
    </div>

    {/* ✅ RADIO BUTTONS: Solo ida / Ida y vuelta */}
    <div>
      <label className="block text-sm mb-2 font-medium">Tipo de cálculo:</label>
      
      <label className="flex items-center gap-2 mb-2">
        <input
          type="radio"
          checked={!roundTrip}
          onChange={() => setRoundTrip(false)}
        />
        <span>Solo ida</span>
        <span className="text-xs text-gray-500">(fábrica → revendedor)</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="radio"
          checked={roundTrip}
          onChange={() => setRoundTrip(true)}
        />
        <span>Ida y vuelta (×2)</span>
        <span className="text-xs text-gray-500">(fábrica → revendedor → fábrica)</span>
      </label>
    </div>
  </div>
)}

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={ownType === "zones"}
                  onChange={() => setOwnType("zones")}
                />
                <span>Por zonas de distancia</span>
              </label>

              {ownType === "zones" && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Zona 1 (0-15 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z1}
                    onChange={(e) =>
                      setZones({
                        ...zones,
                        z1: e.target.value,
                      })
                    }
                  />
                  <input
                    placeholder="Zona 2 (15-35 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z2}
                    onChange={(e) =>
                      setZones({
                        ...zones,
                        z2: e.target.value,
                      })
                    }
                  />
                  <input
                    placeholder="Zona 3 (35-60 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z3}
                    onChange={(e) =>
                      setZones({
                        ...zones,
                        z3: e.target.value,
                      })
                    }
                  />
                  <input
                    placeholder="Zona 4 (+60 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z4}
                    onChange={(e) =>
                      setZones({
                        ...zones,
                        z4: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={thirdParty}
              onChange={(e) => handleThirdPartyChange(e.target.checked)}
            />
            <span>Envío por terceros (precio fijo)</span>
          </label>

          {thirdParty && (
            <input
              type="number"
              placeholder="Precio fijo terceros"
              className="border rounded px-3 py-2 w-64 ml-6"
              value={thirdPartyPrice}
              onChange={(e) => setThirdPartyPrice(Number(e.target.value))}
              min={0}
            />
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || uploadingImage}
          className="w-full bg-blue-600 text-white py-3 rounded-xl disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {loading || uploadingImage ? "Creando producto..." : "Crear producto"}
        </button>
      </div>
    </div>
  );
}