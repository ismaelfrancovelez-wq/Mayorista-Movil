"use client";

// components/products/AddressShippingModal.tsx
// ✅ Auto-carga el script de Google Maps si no está disponible
// ✅ Selector de cantidad + precio dinámico
// ✅ Tabs Plataforma / Fábrica / Retiro (color si disponible, gris si no)
// ✅ Autocompletado Google Places funcionando

import { useState, useEffect, useRef, useCallback } from "react";
import { PlaceResult } from "../GooglePlacesAutocomplete";

type ShippingMode = "pickup" | "factory" | "platform";

type Props = {
  productName: string;
  price: number;
  unitLabel?: string;
  qty: number;
  onQtyChange: (qty: number) => void;
  allowPickup: boolean;
  allowFactoryShipping: boolean;
  noShipping: boolean;
  selectedShipping: ShippingMode;
  onShippingChange: (mode: ShippingMode) => void;
  onConfirm: (address: PlaceResult, shipping: ShippingMode, qty: number) => void;
  onClose: () => void;
  saving: boolean;
};

type Suggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

// ✅ Función para cargar el script de Google Maps (reutiliza si ya existe)
function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ya cargado
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    // Ya existe un script en proceso de carga
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Error cargando Maps")));
      // Si ya terminó de cargar pero no disparó el evento
      if (window.google?.maps?.places) resolve();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Error cargando Google Maps"));
    document.head.appendChild(script);
  });
}

export default function AddressShippingModal({
  productName,
  price,
  unitLabel,
  qty,
  onQtyChange,
  allowPickup,
  allowFactoryShipping,
  noShipping,
  selectedShipping,
  onShippingChange,
  onConfirm,
  onClose,
  saving,
}: Props) {
  const [localQty, setLocalQty] = useState(qty);
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const dummyDivRef = useRef<HTMLDivElement | null>(null);

  const needsAddress = selectedShipping === "platform" || selectedShipping === "factory";
  const canConfirm = !needsAddress || selectedPlace !== null;
  const totalPrice = price * localQty;

  // Tabs disponibles
  const platformAvailable = true;
  const factoryAvailable = allowFactoryShipping && !noShipping;
  const pickupAvailable = allowPickup;

  // ✅ Cargar Google Maps script + inicializar servicios
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadGoogleMapsScript();
        if (cancelled) return;

        // Esperar a que dummyDivRef esté montado
        const waitForDiv = () =>
          new Promise<void>((resolve) => {
            if (dummyDivRef.current) { resolve(); return; }
            const interval = setInterval(() => {
              if (dummyDivRef.current) { clearInterval(interval); resolve(); }
            }, 50);
            setTimeout(() => { clearInterval(interval); resolve(); }, 3000);
          });

        await waitForDiv();
        if (cancelled || !dummyDivRef.current) return;

        autocompleteService.current = new google.maps.places.AutocompleteService();
        placesService.current = new google.maps.places.PlacesService(dummyDivRef.current);
        setMapsReady(true);
      } catch (err) {
        console.error("Error inicializando Google Maps:", err);
        if (!cancelled) setMapsError(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const fetchSuggestions = useCallback((value: string) => {
    if (!autocompleteService.current || value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    autocompleteService.current.getPlacePredictions(
      { input: value, componentRestrictions: { country: "ar" }, types: ["address"] },
      (predictions, status) => {
        setLoadingSuggestions(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        setSuggestions(
          predictions.slice(0, 5).map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting.main_text,
            secondaryText: p.structured_formatting.secondary_text || "",
          }))
        );
        setShowSuggestions(true);
      }
    );
  }, []);

  function handleAddressInput(value: string) {
    setAddressInput(value);
    setSelectedPlace(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  }

  function handleSelectSuggestion(suggestion: Suggestion) {
    setAddressInput(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);

    if (!placesService.current) {
      setSelectedPlace({ formattedAddress: suggestion.description, lat: 0, lng: 0 });
      return;
    }

    placesService.current.getDetails(
      { placeId: suggestion.placeId, fields: ["formatted_address", "geometry"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          setSelectedPlace({
            formattedAddress: place.formatted_address || suggestion.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        } else {
          setSelectedPlace({ formattedAddress: suggestion.description, lat: 0, lng: 0 });
        }
      }
    );
  }

  function handleQtyChange(val: number) {
    const safe = Math.max(1, val);
    setLocalQty(safe);
    onQtyChange(safe);
  }

  function handleConfirm() {
    if (!canConfirm || saving) return;
    const place: PlaceResult = needsAddress && selectedPlace
      ? selectedPlace
      : { formattedAddress: "", lat: 0, lng: 0 };
    onConfirm(place, selectedShipping, localQty);
  }

  function getShippingSubtext(): string {
    switch (selectedShipping) {
      case "platform": return "Envío por plataforma";
      case "factory": return "Envío por fábrica";
      case "pickup": return "Retiro en fábrica";
      default: return "";
    }
  }

  function getAddressExplanation(): string {
    if (selectedShipping === "platform") {
      return "Usamos tu dirección para calcular el precio y comprobar si hay más compradores en tu zona con quienes puedas dividir el precio del envío.";
    }
    return "Usamos tu dirección para calcular el costo del envío desde la fábrica hasta tu domicilio.";
  }

  function getConfirmText(): string {
    if (saving) return "Reservando...";
    if (selectedShipping === "pickup") return "Confirmar — retiro en fábrica sin costo";
    return "Confirmar y reservar mi lugar";
  }

  function tabStyle(mode: ShippingMode, available: boolean): React.CSSProperties {
    const isActive = selectedShipping === mode;
    if (!available) {
      return {
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 500,
        border: "none",
        cursor: "not-allowed",
        background: "#f3f4f6",
        color: "#9ca3af",
        opacity: 0.5,
        transition: "all 0.15s",
      };
    }
    return {
      padding: "6px 14px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: 500,
      border: "none",
      cursor: "pointer",
      background: isActive ? "#2563eb" : "#f3f4f6",
      color: isActive ? "#fff" : "#374151",
      opacity: 1,
      transition: "all 0.15s",
    };
  }

  return (
    <>
      {/* Div para PlacesService — visibility:hidden, NO display:none */}
      <div
        ref={dummyDivRef}
        style={{ position: "fixed", top: 0, left: 0, width: "1px", height: "1px", visibility: "hidden", pointerEvents: "none" }}
      />

      {/* Overlay */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Modal */}
        <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>

          {/* ── Header ── */}
          <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="17" height="17" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#111", margin: 0 }}>
                ¿Dónde enviamos el pedido?
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "4px", borderRadius: "8px", display: "flex" }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Producto + Tabs de envío ── */}
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "0.85rem 1rem" }}>
              {/* Fila: ícono + nombre + tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Ícono producto */}
                <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "#f3f4f6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>

                {/* Nombre + subtexto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {productName}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="12" height="12" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{getShippingSubtext()}</p>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => platformAvailable && onShippingChange("platform")}
                    disabled={!platformAvailable}
                    style={tabStyle("platform", platformAvailable)}
                  >
                    Plataforma
                  </button>
                  <button
                    onClick={() => factoryAvailable && onShippingChange("factory")}
                    disabled={!factoryAvailable}
                    style={tabStyle("factory", factoryAvailable)}
                  >
                    Fábrica
                  </button>
                  {pickupAvailable && (
                    <button
                      onClick={() => onShippingChange("pickup")}
                      style={tabStyle("pickup", pickupAvailable)}
                    >
                      Retiro
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Cantidad + precio dinámico ── */}
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 8px" }}>Cantidad</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => handleQtyChange(localQty - 1)}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #d1d5db", background: "none", cursor: "pointer", fontSize: "18px", color: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                −
              </button>
              <input
                type="number"
                value={localQty}
                min={1}
                onChange={(e) => handleQtyChange(Number(e.target.value))}
                style={{ width: "60px", textAlign: "center", fontSize: "14px", padding: "6px", borderRadius: "8px", border: "1px solid #d1d5db", color: "#111" }}
              />
              <button
                onClick={() => handleQtyChange(localQty + 1)}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #d1d5db", background: "none", cursor: "pointer", fontSize: "18px", color: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                +
              </button>
              <div style={{ marginLeft: "auto", background: "#f3f4f6", borderRadius: "8px", padding: "6px 12px", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>Total</p>
                <p style={{ fontSize: "15px", fontWeight: 500, color: "#111", margin: 0 }}>
                  ${totalPrice.toLocaleString("es-AR")}
                </p>
              </div>
            </div>
          </div>

          {/* ── Contenido según modo de envío ── */}
          {needsAddress ? (
            <div style={{ padding: "1rem 1.5rem 0" }}>
              {/* Texto explicativo */}
              <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 16px", lineHeight: 1.6 }}>
                {getAddressExplanation()}
              </p>

              {/* Label */}
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#374151", margin: "0 0 6px" }}>
                Dirección de entrega
              </p>

              {/* Input con autocompletado */}
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
                  <svg width="15" height="15" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 38px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    color: "#111",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocusCapture={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "#2563eb";
                  }}
                  onBlurCapture={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "#d1d5db";
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                />

                {/* Dropdown de sugerencias */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {suggestions.map((s, i) => (
                      <button
                        key={s.placeId}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(s);
                        }}
                        style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <svg width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", margin: 0 }}>{s.mainText}</p>
                          <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>{s.secondaryText}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Estados */}
                {loadingSuggestions && (
                  <p style={{ fontSize: "11px", color: "#9ca3af", margin: "6px 0 0" }}>Buscando dirección...</p>
                )}
                {!mapsReady && !mapsError && addressInput.length >= 3 && !loadingSuggestions && (
                  <p style={{ fontSize: "11px", color: "#f59e0b", margin: "6px 0 0" }}>Cargando servicio de direcciones...</p>
                )}
                {mapsError && (
                  <p style={{ fontSize: "11px", color: "#ef4444", margin: "6px 0 0" }}>
                    ⚠️ Error al cargar el autocompletado. Ingresá la dirección manualmente.
                  </p>
                )}
              </div>

              {/* Dirección seleccionada */}
              {selectedPlace && (
                <div style={{ marginTop: "10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="13" height="13" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p style={{ fontSize: "12px", color: "#16a34a", margin: 0 }}>{selectedPlace.formattedAddress}</p>
                </div>
              )}
            </div>
          ) : (
            /* Modo retiro */
            <div style={{ padding: "1rem 1.5rem 0" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>📦</span>
                <p style={{ fontSize: "13px", color: "#166534", margin: 0, lineHeight: 1.5 }}>
                  Retiro en fábrica — sin costo de envío. Reservá tu lugar y te avisamos cuando el lote cierre para coordinar el retiro.
                </p>
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              style={{
                width: "100%",
                padding: "14px",
                background: canConfirm && !saving ? "#2563eb" : "#93c5fd",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: canConfirm && !saving ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
            >
              {getConfirmText()}
            </button>
            <button
              onClick={onClose}
              style={{ width: "100%", padding: "12px", background: "none", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}