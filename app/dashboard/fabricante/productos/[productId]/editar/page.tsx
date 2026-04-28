// app/dashboard/fabricante/productos/[productId]/editar/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProductCategory, CATEGORY_LABELS } from "../../../../../../lib/types/product";
import { uploadImage, validateImageFile } from "../../../../../../lib/firebase-storage";
import toast from "react-hot-toast";

function sanitizeText(text: string, maxLength: number = 100): string {
  return text.trim().substring(0, maxLength);
}

interface FormatForm {
  presetId: string;
  packQty: number | "";
  unitLabel: string;
  unitsPerPack: number | "";
  price: number | "";
  colors: string[];
}

const FORMAT_PRESETS = [
  { id: "unit",      label: "Unidad",    unitLabel: "Por unidad",   unitsPerPack: 1,    needsQty: false },
  { id: "pack",      label: "Pack",      unitLabel: "",             unitsPerPack: 0,    needsQty: true  },
  { id: "dozen",     label: "Docena",    unitLabel: "Docena",       unitsPerPack: 12,   needsQty: false },
  { id: "halfdozen", label: "½ Docena",  unitLabel: "Media docena", unitsPerPack: 6,    needsQty: false },
  { id: "kg",        label: "Kg",        unitLabel: "Por kg",       unitsPerPack: 1,    needsQty: false },
  { id: "500g",      label: "500g",      unitLabel: "500g",         unitsPerPack: 1,    needsQty: false },
  { id: "250g",      label: "250g",      unitLabel: "250g",         unitsPerPack: 1,    needsQty: false },
  { id: "liter",     label: "Litro",     unitLabel: "Por litro",    unitsPerPack: 1,    needsQty: false },
  { id: "500ml",     label: "500ml",     unitLabel: "500ml",        unitsPerPack: 1,    needsQty: false },
  { id: "custom",    label: "Otro",      unitLabel: "",             unitsPerPack: 0,    needsQty: false },
] as const;

interface MinimumForm {
  type: "quantity" | "amount";
  value: number | "";
  formats: FormatForm[];
}

function inferPresetId(unitLabel: string, unitsPerPack: number): string {
  const s = unitLabel.toLowerCase().trim();
  if (s === "por unidad" || s === "unidad" || (unitsPerPack === 1 && /unidad|individual|suelto/.test(s))) return "unit";
  if (/^pack\s*\d+/.test(s)) return "pack";
  if (/media\s*docena|½\s*docena/.test(s) || unitsPerPack === 6) return "halfdozen";
  if (/docena/.test(s) || unitsPerPack === 12) return "dozen";
  if (s === "por kg" || s === "kg") return "kg";
  if (s === "500g") return "500g";
  if (s === "250g") return "250g";
  if (s === "por litro" || s === "litro") return "liter";
  if (s === "500ml") return "500ml";
  return "custom";
}

export default function EditarProductoPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.productId as string;
  const [loadingProduct, setLoadingProduct] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [netProfitPerUnit, setNetProfitPerUnit] = useState<number | "">("");
  const [category, setCategory] = useState<ProductCategory>("otros");

  const [hasStock, setHasStock] = useState(false);
  const [stock, setStock] = useState<number | "">("");

  const [retailReferencePrice, setRetailReferencePrice] = useState<number | "">("");
  const [fetchingML, setFetchingML] = useState(false);
  const [mlMessage, setMlMessage] = useState<string | null>(null);

  const [minimums, setMinimums] = useState<MinimumForm[]>([
    { type: "quantity", value: "", formats: [{ presetId: "custom", packQty: "", unitLabel: "", unitsPerPack: 1, price: "", colors: [] }] },
  ]);

  const addMinimum = () => {
    setMinimums(prev => [...prev, {
      type: "quantity", value: "",
      formats: [{ presetId: "custom", packQty: "", unitLabel: "", unitsPerPack: 1, price: "", colors: [] }],
    }]);
  };

  const removeMinimum = (mIdx: number) => {
    if (minimums.length <= 1) return;
    setMinimums(prev => prev.filter((_, i) => i !== mIdx));
  };

  const updateMinimumType = (mIdx: number, type: "quantity" | "amount") => {
    setMinimums(prev => prev.map((m, i) => i === mIdx ? { ...m, type } : m));
  };

  const updateMinimumValue = (mIdx: number, value: string) => {
    setMinimums(prev => prev.map((m, i) =>
      i === mIdx ? { ...m, value: value === "" ? "" : Number(value) } : m
    ));
  };

  const addFormat = (mIdx: number) => {
    setMinimums(prev => prev.map((m, i) =>
      i === mIdx ? { ...m, formats: [...m.formats, { presetId: "custom", packQty: "", unitLabel: "", unitsPerPack: 1, price: "", colors: [] }] } : m
    ));
  };

  const removeFormat = (mIdx: number, fIdx: number) => {
    setMinimums(prev => prev.map((m, i) => {
      if (i !== mIdx || m.formats.length <= 1) return m;
      return { ...m, formats: m.formats.filter((_, fi) => fi !== fIdx) };
    }));
  };

  const updateFormat = (mIdx: number, fIdx: number, field: keyof FormatForm, value: string) => {
    setMinimums(prev => prev.map((m, i) => {
      if (i !== mIdx) return m;
      const newFormats = m.formats.map((f, fi) => {
        if (fi !== fIdx) return f;
        if (field === "unitLabel") return { ...f, unitLabel: value };
        return { ...f, [field]: value === "" ? "" : Number(value) };
      });
      return { ...m, formats: newFormats };
    }));
  };

  const addColor = (mIdx: number, fIdx: number, color: string) => {
    const trimmed = color.trim();
    if (!trimmed) return;
    setMinimums(prev => prev.map((m, i) => {
      if (i !== mIdx) return m;
      return {
        ...m,
        formats: m.formats.map((f, fi) => {
          if (fi !== fIdx) return f;
          if (f.colors.includes(trimmed)) return f;
          return { ...f, colors: [...f.colors, trimmed] };
        }),
      };
    }));
  };

  const removeColor = (mIdx: number, fIdx: number, color: string) => {
    setMinimums(prev => prev.map((m, i) => {
      if (i !== mIdx) return m;
      return {
        ...m,
        formats: m.formats.map((f, fi) => {
          if (fi !== fIdx) return f;
          return { ...f, colors: f.colors.filter(c => c !== color) };
        }),
      };
    }));
  };

  const MAX_IMAGES = 6;
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [factoryPickup, setFactoryPickup] = useState(false);
  const [ownLogistics, setOwnLogistics] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);
  const [noShipping, setNoShipping] = useState(false);
  const [ownType, setOwnType] = useState<"per_km" | "zones" | "">("");
  const [pricePerKm, setPricePerKm] = useState<number | "">("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [zones, setZones] = useState({ z1: "", z2: "", z3: "", z4: "" });
  const [thirdPartyPrice, setThirdPartyPrice] = useState<number | "">("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleBuscarEnML() {
    if (!name.trim()) { setMlMessage("⚠️ Primero guardá el nombre del producto."); return; }
    setFetchingML(true);
    setMlMessage(null);
    try {
      const res = await fetch("/api/products/fetch-retail-price-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: name }),
      });
      const data = await res.json();
      if (data.retailReferencePrice) {
        setRetailReferencePrice(data.retailReferencePrice);
        setMlMessage(`✅ Encontrado en MercadoLibre: $${data.retailReferencePrice.toLocaleString("es-AR")}`);
      } else {
        setMlMessage("⚠️ No se encontró en MercadoLibre. Podés cargarlo manualmente.");
      }
    } catch {
      setMlMessage("❌ Error al buscar. Podés cargarlo manualmente.");
    } finally {
      setFetchingML(false);
    }
  }

  useEffect(() => {
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

        setName(product.name || "");
        setDescription(product.description || "");
        setNetProfitPerUnit(product.netProfitPerUnit ?? "");
        setCategory(product.category || "otros");

        if (product.stock !== null && product.stock !== undefined) {
          setHasStock(true);
          setStock(product.stock);
        }

        if (product.retailReferencePrice) {
          setRetailReferencePrice(product.retailReferencePrice);
        }

        if (Array.isArray(product.minimums) && product.minimums.length > 0) {
          // ✅ BLOQUE 8: lee f.price (BASE, sin 4%) — NUNCA f.displayPrice.
          // Si por error leyera displayPrice, al guardar el endpoint le aplicaría
          // otro 4% y los precios se inflarían en cada edición.
          setMinimums(product.minimums.map((m: any) => ({
            type: m.type === "amount" ? "amount" : "quantity",
            value: m.value || "",
            formats: Array.isArray(m.formats)
              ? m.formats.map((f: any) => ({
                  presetId: inferPresetId(f.unitLabel || "", f.unitsPerPack || 1),
                  packQty: "",
                  unitLabel: f.unitLabel || "",
                  unitsPerPack: f.unitsPerPack || 1,
                  price: f.price || "", // ✅ BLOQUE 8: precio BASE
                  colors: Array.isArray(f.colors) ? f.colors : [],
                }))
              : [{ presetId: "custom", packQty: "", unitLabel: "", unitsPerPack: 1, price: "", colors: [] }],
          })));
        } else {
          // ✅ BLOQUE 8: misma regla acá — usa product.price (BASE), no displayPrice
          const base: MinimumForm = {
            type: "quantity",
            value: product.minimumOrder || "",
            formats: [{
              presetId: "custom",
              packQty: "",
              unitLabel: product.unitLabel || "Por unidad",
              unitsPerPack: 1,
              price: product.price || "", // ✅ BLOQUE 8: precio BASE
              colors: [],
            }],
          };
          const extraMins: MinimumForm[] = Array.isArray(product.variants)
            ? product.variants.map((v: any) => ({
                type: "quantity" as const,
                value: v.minimumOrder || "",
                formats: [{
                  presetId: "custom",
                  packQty: "",
                  unitLabel: v.unitLabel || "",
                  unitsPerPack: 1,
                  price: v.price || "", // ✅ BLOQUE 8: precio BASE
                  colors: [],
                }],
              }))
            : [];
          setMinimums([base, ...extraMins]);
        }

        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
          setExistingImageUrls(product.imageUrls);
          setImagePreviews(product.imageUrls);
        }

        const shipping = product.shipping;
        if (shipping) {
          const methods: string[] = shipping.methods || [];
          setFactoryPickup(methods.includes("factory_pickup"));
          setOwnLogistics(methods.includes("own_logistics"));
          setThirdParty(methods.includes("third_party"));
          setNoShipping(shipping.noShipping === true);

          if (methods.includes("own_logistics") && shipping.ownLogistics) {
            const own = shipping.ownLogistics;
            setOwnType(own.type || "");
            if (own.type === "per_km") { setPricePerKm(own.pricePerKm || ""); setRoundTrip(own.roundTrip || false); }
            if (own.type === "zones" && own.zones) {
              setZones({ z1: String(own.zones.z1 || ""), z2: String(own.zones.z2 || ""), z3: String(own.zones.z3 || ""), z4: String(own.zones.z4 || "") });
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

  const totalImages = existingImageUrls.length + imageFiles.length;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - totalImages;
    if (remaining <= 0) { toast.error(`Máximo ${MAX_IMAGES} fotos permitidas`); e.target.value = ""; return; }
    const filesToAdd = files.slice(0, remaining);
    if (files.length > remaining) toast.error(`Solo se agregaron ${remaining} foto(s). Límite: ${MAX_IMAGES}`);
    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    let processed = 0;
    filesToAdd.forEach((file) => {
      const validation = validateImageFile(file);
      if (!validation.valid) { toast.error(`${file.name}: ${validation.error || "Imagen inválida"}`); processed++; return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        validFiles.push(file); newPreviews.push(reader.result as string); processed++;
        if (processed === filesToAdd.length) { setImageFiles(prev => [...prev, ...validFiles]); setImagePreviews(prev => [...prev, ...newPreviews]); }
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
    const updatedPreviews = imagePreviews.slice(0, existingImageUrls.length).concat(
      imagePreviews.slice(existingImageUrls.length).filter((_, i) => i !== index)
    );
    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);
  };

  const handleNoShippingChange = (checked: boolean) => {
    if (checked) { setOwnLogistics(false); setThirdParty(false); setOwnType(""); }
    setNoShipping(checked); setError(null);
  };
  const handleOwnLogisticsChange = (checked: boolean) => {
    if (checked && noShipping) { setError("No podés combinar envío propio con sin envío"); return; }
    if (checked && thirdParty) { setError("No podés elegir envío propio y envío por terceros al mismo tiempo"); return; }
    setOwnLogistics(checked); if (!checked) setOwnType(""); setError(null);
  };
  const handleThirdPartyChange = (checked: boolean) => {
    if (checked && noShipping) { setError("No podés combinar envío por terceros con sin envío"); return; }
    if (checked && ownLogistics) { setError("No podés elegir envío por terceros y envío propio al mismo tiempo"); return; }
    setThirdParty(checked); setError(null);
  };

  async function handleSubmit() {
    setError(null);
    const sanitizedName = sanitizeText(name, 100);
    const sanitizedDescription = sanitizeText(description, 1000);

    if (sanitizedName.length < 3) { setError("El nombre debe tener al menos 3 caracteres"); return; }
    if (sanitizedDescription.length < 10) { setError("La descripción debe tener al menos 10 caracteres"); return; }
    if (netProfitPerUnit === "" || netProfitPerUnit < 0) { setError("Ingresá una ganancia neta válida (0 o mayor)"); return; }

    if (hasStock && (stock === "" || Number(stock) < 0 || !Number.isInteger(Number(stock)))) {
      setError("El stock debe ser un número entero igual o mayor a 0"); return;
    }

    if (minimums.length === 0) { setError("Agregá al menos un mínimo de compra"); return; }

    for (let mi = 0; mi < minimums.length; mi++) {
      const m = minimums[mi];
      if (m.value === "" || Number(m.value) <= 0) {
        setError(`El mínimo ${mi + 1} necesita un valor mayor a 0`); return;
      }
      for (let fi = 0; fi < m.formats.length; fi++) {
        const f = m.formats[fi];
        if (!f.unitLabel.trim()) { setError(`La presentación ${fi + 1} del mínimo ${mi + 1} necesita un nombre`); return; }
        if (f.unitsPerPack === "" || Number(f.unitsPerPack) < 1) { setError(`La presentación ${fi + 1} del mínimo ${mi + 1} necesita unidades por pack (mínimo 1)`); return; }
        if (f.price === "" || Number(f.price) <= 0) { setError(`La presentación ${fi + 1} del mínimo ${mi + 1} necesita un precio válido`); return; }
      }
    }

    if (!factoryPickup && !ownLogistics && !thirdParty && !noShipping) { setError("Elegí al menos un método de envío"); return; }
    if (ownLogistics && thirdParty) { setError("No podés elegir envío propio y envío por terceros al mismo tiempo"); return; }
    if (ownLogistics && !ownType) { setError("Seleccioná cómo calcular el envío propio"); return; }
    if (ownLogistics && ownType === "per_km" && (pricePerKm === "" || pricePerKm <= 0)) { setError("Ingresá un precio por kilómetro válido"); return; }
    if (ownLogistics && ownType === "zones") {
      if (!zones.z1 || !zones.z2 || !zones.z3 || !zones.z4) { setError("Completá los precios de las 4 zonas"); return; }
      if (Number(zones.z1) <= 0 || Number(zones.z2) <= 0 || Number(zones.z3) <= 0 || Number(zones.z4) <= 0) { setError("Los precios de zonas deben ser mayores a 0"); return; }
    }
    if (thirdParty && (thirdPartyPrice === "" || thirdPartyPrice <= 0)) { setError("Ingresá un precio de envío por terceros válido"); return; }

    const shipping: any = { methods: [] };
    if (noShipping) shipping.noShipping = true;
    if (factoryPickup) shipping.methods.push("factory_pickup");
    if (ownLogistics) {
      shipping.methods.push("own_logistics");
      if (ownType === "per_km") shipping.ownLogistics = { type: "per_km", pricePerKm: Number(pricePerKm), roundTrip };
      if (ownType === "zones") shipping.ownLogistics = { type: "zones", zones: { z1: Number(zones.z1), z2: Number(zones.z2), z3: Number(zones.z3), z4: Number(zones.z4) } };
    }
    if (thirdParty) { shipping.methods.push("third_party"); shipping.thirdParty = { fixedPrice: Number(thirdPartyPrice), disclaimerAccepted: true }; }

    setLoading(true);
    let newImageUrls: string[] = [];

    try {
      if (imageFiles.length > 0) {
        setUploadingImage(true);
        toast.loading(`Subiendo ${imageFiles.length} foto(s)...`);
        newImageUrls = await Promise.all(imageFiles.map(file => uploadImage(file, "products")));
        toast.dismiss();
        toast.success("Fotos subidas correctamente");
        setUploadingImage(false);
      }

      const finalImageUrls = [...existingImageUrls, ...newImageUrls];

      // ✅ BLOQUE 8: mandamos los precios BASE al endpoint.
      // El endpoint (/api/products/edit) le aplica el 4% y guarda price + displayPrice.
      // Si por error mandáramos displayPrice acá, el endpoint volvería a aplicar 4%.
      const cleanMinimums = minimums.map(m => ({
        type: m.type,
        value: Number(m.value),
        formats: m.formats.map(f => ({
          unitLabel: f.unitLabel.trim().substring(0, 30),
          unitsPerPack: Number(f.unitsPerPack),
          price: Number(f.price), // ✅ BLOQUE 8: precio BASE
          colors: f.colors || [],
        })),
      }));

      const firstFormat = cleanMinimums[0]?.formats[0];
      const firstMinimum = cleanMinimums[0];
      const stockToSend = hasStock ? Number(stock) : null;

      const res = await fetch("/api/products/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          name: sanitizedName,
          description: sanitizedDescription,
          price: firstFormat?.price ?? 0, // ✅ BLOQUE 8: precio BASE
          minimumOrder: firstMinimum?.type === "quantity" ? firstMinimum.value : 1,
          unitLabel: firstFormat?.unitLabel ?? "",
          netProfitPerUnit: Number(netProfitPerUnit),
          category,
          shipping,
          imageUrls: finalImageUrls,
          minimums: cleanMinimums,
          variants: [],
          stock: stockToSend,
          retailReferencePrice: retailReferencePrice !== "" ? Number(retailReferencePrice) : null,
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

  if (loadingProduct) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Cargando producto...</p></div>;
  }

  const firstFormatPrice = Number(minimums[0]?.formats[0]?.price ?? 0);
  // ✅ BLOQUE 8: precio publicado (con 4% MP) calculado a partir del base
  const firstFormatDisplayPrice = Math.round(firstFormatPrice * 1.04);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/dashboard/fabricante/productos")} className="text-blue-600 hover:text-blue-700 font-medium">← Volver</button>
          <h1 className="text-3xl font-semibold">Editar producto</h1>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">{error}</div>}

        {/* DATOS BÁSICOS */}
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-lg mb-4">Información básica</h2>

          <div>
            <label className="block text-sm mb-1">Nombre del producto</label>
            <input placeholder="Ej: Whey Protein" className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>

          <div>
            <label className="block text-sm mb-1">Descripción del producto <span className="text-red-500">*</span></label>
            <textarea placeholder="Descripción detallada..." className="w-full border rounded px-3 py-2 resize-none" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
            <p className="text-xs text-gray-400 mt-1">{description.length}/1000 caracteres · mínimo 10</p>
          </div>

          <div>
            <label className="block text-sm mb-1">Categoría</label>
            <select className="w-full border rounded px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {/* IMÁGENES */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fotos del producto <span className="text-gray-400 font-normal">(opcional · máx. {MAX_IMAGES})</span>
            </label>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {existingImageUrls.map((src, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img src={src} alt={`Foto ${index + 1}`} className="w-full h-28 object-cover rounded-lg border" />
                    <button type="button" onClick={() => handleRemoveExisting(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    {index === 0 && <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">Principal</span>}
                  </div>
                ))}
                {imageFiles.map((_, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img src={imagePreviews[existingImageUrls.length + index]} alt={`Nueva foto ${index + 1}`} className="w-full h-28 object-cover rounded-lg border border-blue-300" />
                    <button type="button" onClick={() => handleRemoveNew(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <span className="absolute bottom-1 left-1 bg-blue-500/80 text-white text-xs px-1.5 py-0.5 rounded">Nueva</span>
                  </div>
                ))}
              </div>
            )}

            {totalImages < MAX_IMAGES && (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm text-gray-500"><span className="font-semibold">Click para subir</span> o arrastrá fotos</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG o WEBP · MAX. 5MB · {totalImages}/{MAX_IMAGES} subidas</p>
                </div>
                <input type="file" className="hidden" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleImageChange} />
              </label>
            )}
          </div>

          {/* MÍNIMOS DE COMPRA */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm font-semibold text-gray-700">Mínimos de compra</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Definí cuánto debe comprar el minorista y en qué presentaciones puede hacerlo.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-3">
              {minimums.map((m, mIdx) => (
                <div key={mIdx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Mínimo {mIdx + 1}</span>
                    {minimums.length > 1 && (
                      <button type="button" onClick={() => removeMinimum(mIdx)} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                        Eliminar mínimo
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 mb-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={m.type === "quantity"} onChange={() => updateMinimumType(mIdx, "quantity")} />
                      <span className="text-sm text-gray-700">Por cantidad (unidades)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={m.type === "amount"} onChange={() => updateMinimumType(mIdx, "amount")} />
                      <span className="text-sm text-gray-700">Por monto en pesos</span>
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs text-gray-500 mb-1">
                      {m.type === "quantity" ? "Cantidad mínima (unidades)" : "Monto mínimo (pesos)"}
                    </label>
                    <div className="flex items-center gap-2">
                      {m.type === "amount" && <span className="text-sm text-gray-500 font-medium">$</span>}
                      <input
                        type="number"
                        placeholder={m.type === "quantity" ? "Ej: 100" : "Ej: 1000000"}
                        className="border rounded px-3 py-2 text-sm bg-white w-48"
                        value={m.value}
                        onChange={(e) => updateMinimumValue(mIdx, e.target.value)}
                        min={1}
                      />
                      {m.type === "quantity" && <span className="text-sm text-gray-500">uds.</span>}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
                      Presentaciones disponibles para este mínimo
                    </p>
                    <div className="space-y-2">
                      {m.formats.map((f, fIdx) => {
                        // ✅ BLOQUE 8: muestra precio publicado debajo del input
                        const fPriceNum = Number(f.price) || 0;
                        const fDisplayPrice = Math.round(fPriceNum * 1.04);
                        return (
                        <div key={fIdx} className="bg-white border border-gray-100 rounded-lg p-3 space-y-3">

                          {/* Nombre, Uds./pack, Precio */}
                          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Presentación</label>
                              <input
                                placeholder='"Por unidad" o "Pack 6"'
                                className="w-full border rounded px-2 py-1.5 text-sm"
                                value={f.unitLabel}
                                onChange={(e) => updateFormat(mIdx, fIdx, "unitLabel", e.target.value)}
                                maxLength={30}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Uds./pack</label>
                              <input
                                type="number"
                                placeholder="1"
                                className="w-16 border rounded px-2 py-1.5 text-sm"
                                value={f.unitsPerPack}
                                onChange={(e) => updateFormat(mIdx, fIdx, "unitsPerPack", e.target.value)}
                                min={1}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Tu precio (sin comisión)</label>
                              <input
                                type="number"
                                placeholder="5000"
                                className="w-full border rounded px-2 py-1.5 text-sm"
                                value={f.price}
                                onChange={(e) => updateFormat(mIdx, fIdx, "price", e.target.value)}
                                min={0}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFormat(mIdx, fIdx)}
                              disabled={m.formats.length <= 1}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* ✅ BLOQUE 8: precio publicado (lo que ve el comprador) */}
                          {fPriceNum > 0 && (
                            <div className="text-xs space-y-0.5">
                              <p className="text-gray-700">
                                💰 Precio publicado al comprador:{" "}
                                <strong className="text-blue-700">${fDisplayPrice.toLocaleString("es-AR")}</strong>
                                <span className="text-gray-400"> (incluye 4% MP)</span>
                              </p>
                              {f.unitsPerPack !== "" && Number(f.unitsPerPack) > 1 && (
                                <p className="text-blue-600">
                                  Precio/ud para vos: <strong>${Math.round(fPriceNum / Number(f.unitsPerPack)).toLocaleString("es-AR")}</strong>
                                </p>
                              )}
                            </div>
                          )}

                          {/* Colores disponibles */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Colores disponibles</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {f.colors.map(color => (
                                <span key={color} className="flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                                  {color}
                                  <button
                                    type="button"
                                    onClick={() => removeColor(mIdx, fIdx, color)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                placeholder="Ej: Negro, Titanio..."
                                className="flex-1 border rounded px-2 py-1.5 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addColor(mIdx, fIdx, (e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).value = "";
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                  addColor(mIdx, fIdx, input.value);
                                  input.value = "";
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
                              >
                                + Agregar
                              </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Presioná Enter o el botón para agregar cada color</p>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => addFormat(mIdx)}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar presentación
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMinimum}
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 rounded-lg px-3 py-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar otro mínimo
            </button>

            {firstFormatPrice > 0 && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                💳 Vos cargás precios <strong>sin comisión</strong>. La plataforma le suma <strong>4%</strong> al comprador (comisión Mercado Pago) y te transfiere el monto neto.
                <span> Ej: cargás $<strong>{firstFormatPrice.toLocaleString("es-AR")}</strong> → el comprador paga $<strong>{firstFormatDisplayPrice.toLocaleString("es-AR")}</strong>.</span>
              </div>
            )}
          </div>

          {/* PRECIO MINORISTA DE REFERENCIA */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              Precio minorista de referencia{" "}
              <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Aparece tachado en la card para que el comprador vea cuánto ahorra. Podés cargarlo a
              mano o buscarlo en MercadoLibre (gratis).
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Ej: 14200"
                className="flex-1 border rounded px-3 py-2 text-sm"
                value={retailReferencePrice}
                onChange={(e) => { setRetailReferencePrice(e.target.value === "" ? "" : Number(e.target.value)); setMlMessage(null); }}
              />
              <button type="button" onClick={handleBuscarEnML} disabled={fetchingML} className="px-4 py-2 bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm font-semibold rounded-lg hover:bg-yellow-100 transition disabled:opacity-50 whitespace-nowrap">
                {fetchingML ? "Buscando..." : "🔍 Buscar en ML"}
              </button>
            </div>
            {mlMessage && <p className="text-xs mt-2 text-gray-600">{mlMessage}</p>}
            {/* ✅ BLOQUE 8: comparar contra displayPrice (lo que ve el comprador), no contra el base */}
            {retailReferencePrice !== "" && firstFormatDisplayPrice > 0 && Number(retailReferencePrice) > firstFormatDisplayPrice && (
              <p className="text-xs mt-2 text-green-600 font-medium">
                💡 Tus compradores van a ver que ahorran un{" "}
                {Math.round(((Number(retailReferencePrice) - firstFormatDisplayPrice) / Number(retailReferencePrice)) * 100)}%
                respecto al precio minorista.
              </p>
            )}
          </div>

          {/* CONTROL DE STOCK */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" id="hasStockEdit" checked={hasStock} onChange={(e) => { setHasStock(e.target.checked); if (!e.target.checked) setStock(""); }} className="mt-1" />
              <div className="flex-1">
                <label htmlFor="hasStockEdit" className="text-sm font-semibold text-gray-700 cursor-pointer">Controlar stock disponible</label>
                <p className="text-xs text-gray-400 mt-0.5">El producto se pausa automáticamente cuando llega a 0 unidades.</p>
              </div>
            </div>
            {hasStock && (
              <div className="mt-3 ml-7">
                <label className="block text-xs text-gray-500 mb-1">Unidades disponibles actualmente</label>
                <input type="number" placeholder="Ej: 500" className="border rounded px-3 py-2 text-sm w-48" value={stock} onChange={(e) => setStock(e.target.value === "" ? "" : Number(e.target.value))} min={0} step={1} />
                {stock !== "" && Number(stock) === 0 && <p className="text-xs text-amber-600 mt-1.5 font-medium">⚠️ Con stock 0 el producto se pausa.</p>}
                {stock !== "" && Number(stock) > 0 && <p className="text-xs text-green-600 mt-1.5">✅ {Number(stock).toLocaleString("es-AR")} unidades disponibles.</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Ganancia neta por unidad (solo para vos)</label>
            <input type="number" placeholder="200" className="w-full border rounded px-3 py-2" value={netProfitPerUnit} onChange={(e) => setNetProfitPerUnit(Number(e.target.value))} min={0} />
          </div>
        </div>

        {/* ENVÍOS */}
        <div className="bg-white rounded-xl shadow p-6 mb-8 space-y-3">
          <h2 className="font-semibold mb-2">Métodos de envío</h2>
          <p className="text-sm text-gray-600 mb-4">Retiro en fábrica puede combinarse con cualquier otro método. Los demás son exclusivos entre sí.</p>

          <label className="flex items-center gap-2"><input type="checkbox" checked={factoryPickup} onChange={(e) => setFactoryPickup(e.target.checked)} /><span>Retiro en fábrica (gratis)</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={ownLogistics} onChange={(e) => handleOwnLogisticsChange(e.target.checked)} disabled={noShipping} /><span className={noShipping ? "text-gray-400 line-through" : ""}>Envío propio</span></label>

          {ownLogistics && (
            <div className="ml-6 space-y-2 border-l-2 pl-4">
              <label className="flex items-center gap-2"><input type="radio" checked={ownType === "per_km"} onChange={() => setOwnType("per_km")} /><span>Por kilómetro</span></label>
              {ownType === "per_km" && (
                <div className="space-y-3 ml-4 border-l-2 border-gray-200 pl-4">
                  <div><label className="block text-sm mb-1">Precio por kilómetro</label><input type="number" placeholder="Ej: 85" className="border rounded px-3 py-2 w-full" value={pricePerKm} onChange={(e) => setPricePerKm(Number(e.target.value))} min={0} /></div>
                  <div>
                    <label className="block text-sm mb-2 font-medium">Tipo de cálculo:</label>
                    <label className="flex items-center gap-2 mb-2"><input type="radio" checked={!roundTrip} onChange={() => setRoundTrip(false)} /><span>Solo ida</span></label>
                    <label className="flex items-center gap-2"><input type="radio" checked={roundTrip} onChange={() => setRoundTrip(true)} /><span>Ida y vuelta (×2)</span></label>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2"><input type="radio" checked={ownType === "zones"} onChange={() => setOwnType("zones")} /><span>Por zonas de distancia</span></label>
              {ownType === "zones" && (
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Zona 1 (0-15 km)" type="number" className="border px-2 py-1" value={zones.z1} onChange={(e) => setZones({ ...zones, z1: e.target.value })} />
                  <input placeholder="Zona 2 (15-35 km)" type="number" className="border px-2 py-1" value={zones.z2} onChange={(e) => setZones({ ...zones, z2: e.target.value })} />
                  <input placeholder="Zona 3 (35-60 km)" type="number" className="border px-2 py-1" value={zones.z3} onChange={(e) => setZones({ ...zones, z3: e.target.value })} />
                  <input placeholder="Zona 4 (+60 km)" type="number" className="border px-2 py-1" value={zones.z4} onChange={(e) => setZones({ ...zones, z4: e.target.value })} />
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2"><input type="checkbox" checked={thirdParty} onChange={(e) => handleThirdPartyChange(e.target.checked)} disabled={noShipping} /><span className={noShipping ? "text-gray-400 line-through" : ""}>Envío por terceros (precio fijo)</span></label>

          <div className="mt-2 border-t pt-3">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={noShipping} onChange={(e) => handleNoShippingChange(e.target.checked)} className="mt-0.5" />
              <div>
                <span className="font-medium">No realizo envíos</span>
                <p className="text-xs text-gray-500 mt-0.5">Los revendedores solo podrán comprar mediante pedidos fraccionados.</p>
              </div>
            </label>
            {noShipping && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 ml-6">
                <p className="text-sm text-blue-800"><strong>📦 Cómo funciona:</strong> La plataforma agrupa revendedores y organiza el envío desde tu fábrica.</p>
              </div>
            )}
          </div>

          {thirdParty && <input type="number" placeholder="Precio fijo terceros" className="border rounded px-3 py-2 w-64 ml-6" value={thirdPartyPrice} onChange={(e) => setThirdPartyPrice(Number(e.target.value))} min={0} />}
        </div>

        <button onClick={handleSubmit} disabled={loading || uploadingImage} className="w-full bg-blue-600 text-white py-3 rounded-xl disabled:opacity-50 hover:bg-blue-700 transition">
          {loading || uploadingImage ? "Guardando cambios..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}