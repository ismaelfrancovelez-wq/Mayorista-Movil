"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProductCategory, CATEGORY_LABELS } from "../../../../../../lib/types/product";
import { uploadImage, validateImageFile } from "../../../../../../lib/firebase-storage";
import toast from "react-hot-toast";

/* ===============================
    🛡️ FUNCIONES DE SANITIZACIÓN
=============================== */
function sanitizeText(text: string, maxLength: number = 100): string {
  return text.trim().substring(0, maxLength);
}

export default function EditarProductoPage() {
  const router = useRouter();
  const params = useParams();
  
  // ✅ Solución al error de compilación: params?.productId
  const productId = params?.productId as string;

  const [loadingProduct, setLoadingProduct] = useState(true);

  /* ===============================
      📦 DATOS BÁSICOS
  =============================== */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [minimumOrder, setMinimumOrder] = useState<number | "">("");
  const [netProfitPerUnit, setNetProfitPerUnit] = useState<number | "">("");
  const [category, setCategory] = useState<ProductCategory>("otros");

  /* ===============================
      🖼️ IMÁGENES DEL PRODUCTO (múltiples)
  =============================== */
  const MAX_IMAGES = 6;
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
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
  const [pricePerKm, setPricePerKm] = useState<number | "">("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [zones, setZones] = useState({ z1: "", z2: "", z3: "", z4: "" });

  // Envío por terceros
  const [thirdPartyPrice, setThirdPartyPrice] = useState<number | "">("");

  /* ===============================
      ⚠️ UI
  =============================== */
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ===============================
      📥 CARGAR PRODUCTO EXISTENTE
  =============================== */
  useEffect(() => {
    // ✅ Guarda para asegurar que el ID existe antes de cargar
    if (!productId) return;

    async function loadProduct() {
      try {
        const res = await fetch("/api/products/my-products");
        if (!res.ok) throw new Error("Error al cargar productos");

        const data = await res.json();
        const product = (data.products || []).find((p: any) => p.id === productId);

        if (!product) {
          toast.error("Producto no encontrado");
          router.push("/dashboard/fabricante/productos");
          return;
        }

        // Pre-llenar formulario
        setName(product.name || "");
        setDescription(product.description || "");
        setPrice(product.price || "");
        setMinimumOrder(product.minimumOrder || "");
        setNetProfitPerUnit(product.netProfitPerUnit ?? "");
        setCategory(product.category || "otros");

        // Imágenes existentes
        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
          setExistingImageUrls(product.imageUrls);
          setImagePreviews(product.imageUrls);
        }

        // Shipping
        const shipping = product.shipping;
        if (shipping) {
          const methods: string[] = shipping.methods || [];
          setFactoryPickup(methods.includes("factory_pickup"));
          setOwnLogistics(methods.includes("own_logistics"));
          setThirdParty(methods.includes("third_party"));

          if (methods.includes("own_logistics") && shipping.ownLogistics) {
            const own = shipping.ownLogistics;
            setOwnType(own.type || "");
            if (own.type === "per_km") {
              setPricePerKm(own.pricePerKm || "");
              setRoundTrip(own.roundTrip || false);
            }
            if (own.type === "zones" && own.zones) {
              setZones({
                z1: String(own.zones.z1 || ""),
                z2: String(own.zones.z2 || ""),
                z3: String(own.zones.z3 || ""),
                z4: String(own.zones.z4 || ""),
              });
            }
          }

          if (methods.includes("third_party") && shipping.thirdParty) {
            setThirdPartyPrice(shipping.thirdParty.fixedPrice || "");
          }
        }
      } catch (err) {
        toast.error("Error al cargar el producto");
        router.push("/dashboard/fabricante/productos");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [productId, router]);

  /* ===============================
      🖼️ MANEJO DE IMÁGENES
  =============================== */
  const totalImages = existingImageUrls.length + imageFiles.length;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - totalImages;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} fotos permitidas`);
      e.target.value = "";
      return;
    }

    const filesToAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.error(`Solo se agregaron ${remaining} foto(s). Límite: ${MAX_IMAGES}`);
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    let processed = 0;

    filesToAdd.forEach((file) => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error || "Imagen inválida"}`);
        processed++;
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        validFiles.push(file);
        newPreviews.push(reader.result as string);
        processed++;
        if (processed === filesToAdd.length) {
          setImageFiles((prev) => [...prev, ...validFiles]);
          setImagePreviews((prev) => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const handleRemoveExisting = (index: number) => {
    const updated = existingImageUrls.filter((_, i) => i !== index);
    setExistingImageUrls(updated);
    setImagePreviews([...updated, ...imageFiles.map((_, i) => imagePreviews[existingImageUrls.length + i])]);
  };

  const handleRemoveNew = (index: number) => {
    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.slice(0, existingImageUrls.length)
      .concat(imagePreviews.slice(existingImageUrls.length).filter((_, i) => i !== index));
    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);
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
    if (!checked) setOwnType("");
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
      💾 SUBMIT
  =============================== */
  async function handleSubmit() {
    setError(null);

    const sanitizedName = sanitizeText(name, 100);
    const sanitizedDescription = sanitizeText(description, 500);

    if (sanitizedName.length < 3) {
      setError("El nombre debe tener al menos 3 caracteres");
      return;
    }

    if (sanitizedDescription.length < 10) {
      setError("La descripción debe tener al menos 10 caracteres");
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
      if (Number(zones.z1) <= 0 || Number(zones.z2) <= 0 || Number(zones.z3) <= 0 || Number(zones.z4) <= 0) {
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
    if (factoryPickup) shipping.methods.push("factory_pickup");

    if (ownLogistics) {
      shipping.methods.push("own_logistics");
      if (ownType === "per_km") {
        shipping.ownLogistics = {
          type: "per_km",
          pricePerKm: Number(pricePerKm),
          roundTrip,
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
      shipping.thirdParty = { fixedPrice: Number(thirdPartyPrice), disclaimerAccepted: true };
    }

    /* ===============================
        🖼️ SUBIR IMÁGENES NUEVAS
    =============================== */
    setLoading(true);
    let newImageUrls: string[] = [];

    try {
      if (imageFiles.length > 0) {
        setUploadingImage(true);
        toast.loading(`Subiendo ${imageFiles.length} foto(s)...`);
        newImageUrls = await Promise.all(
          imageFiles.map((file) => uploadImage(file, "products"))
        );
        toast.dismiss();
        toast.success("Fotos subidas correctamente");
        setUploadingImage(false);
      }

      const finalImageUrls = [...existingImageUrls, ...newImageUrls];

      const res = await fetch("/api/products/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          name: sanitizedName,
          description: sanitizedDescription,
          price: Number(price),
          minimumOrder: Number(minimumOrder),
          netProfitPerUnit: Number(netProfitPerUnit),
          category,
          shipping,
          imageUrls: finalImageUrls,
        }),
      });

      setLoading(false);

      if (res.ok) {
        toast.success("Producto actualizado correctamente");
        router.push("/dashboard/fabricante/productos");
      } else {
        const data = await res.json();
        setError(data.error || "Error al actualizar producto");
      }
    } catch (err: any) {
      setLoading(false);
      setUploadingImage(false);
      setError(err.message || "Error al actualizar producto");
      toast.error(err.message || "Error al actualizar producto");
    }
  }

  /* ===============================
      ⏳ LOADING INICIAL
  =============================== */
  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando producto...</p>
      </div>
    );
  }

  /* ===============================
      🧾 UI
  =============================== */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/dashboard/fabricante/productos")}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-semibold">Editar producto</h1>
        </div>

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
            <label className="block text-sm mb-1">
              Descripción del producto <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Ej: Zapatillas deportivas de alta calidad..."
              className="w-full border rounded px-3 py-2 resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">
              {description.length}/500 caracteres · mínimo 10
            </p>
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

          {/* IMÁGENES */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fotos del producto{" "}
              <span className="text-gray-400 font-normal">(opcional · máx. {MAX_IMAGES})</span>
            </label>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {existingImageUrls.map((src, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img
                      src={src}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-28 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExisting(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                        Principal
                      </span>
                    )}
                  </div>
                ))}
                {imageFiles.map((_, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img
                      src={imagePreviews[existingImageUrls.length + index]}
                      alt={`Nueva foto ${index + 1}`}
                      className="w-full h-28 object-cover rounded-lg border border-blue-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNew(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <span className="absolute bottom-1 left-1 bg-blue-500/80 text-white text-xs px-1.5 py-0.5 rounded">
                      Nueva
                    </span>
                  </div>
                ))}
              </div>
            )}

            {totalImages < MAX_IMAGES && (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click para subir</span> o arrastrá fotos
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG, JPG o WEBP · MAX. 5MB por foto · {totalImages}/{MAX_IMAGES} subidas
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                />
              </label>
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
          <h2 className="font-semibold mb-2">Métodos de envío</h2>

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
                    onChange={(e) => setZones({ ...zones, z1: e.target.value })}
                  />
                  <input
                    placeholder="Zona 2 (15-35 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z2}
                    onChange={(e) => setZones({ ...zones, z2: e.target.value })}
                  />
                  <input
                    placeholder="Zona 3 (35-60 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z3}
                    onChange={(e) => setZones({ ...zones, z3: e.target.value })}
                  />
                  <input
                    placeholder="Zona 4 (+60 km)"
                    type="number"
                    className="border px-2 py-1"
                    value={zones.z4}
                    onChange={(e) => setZones({ ...zones, z4: e.target.value })}
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
          {loading || uploadingImage ? "Guardando cambios..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}