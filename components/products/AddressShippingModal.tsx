"use client";

// components/products/AddressShippingModal.tsx
// ✅ Autocompletado propio dentro del modal (sin GooglePlacesAutocomplete)
// ✅ Precio dinámico según cantidad

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

export default function AddressShippingModal({
  productName, price, unitLabel, qty, onQtyChange,
  allowPickup, allowFactoryShipping, noShipping,
  selectedShipping, onShippingChange, onConfirm, onClose, saving,
}: Props) {
  const [localQty, setLocalQty] = useState(qty);
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const dummyDivRef = useRef<HTMLDivElement | null>(null);

  const factoryDisabled = !allowFactoryShipping || noShipping;
  const pickupDisabled = !allowPickup;
  const needsAddress = selectedShipping === "platform" || selectedShipping === "factory";
  const canConfirm = !needsAddress || selectedPlace !== null;
  const totalPrice = price * localQty;

  useEffect(() => {
    function initServices() {
      if (!window.google?.maps?.places) return;
      autocompleteService.current = new google.maps.places.AutocompleteService();
      if (dummyDivRef.current) {
        placesService.current = new google.maps.places.PlacesService(dummyDivRef.current);
      }
    }
    if (window.google?.maps?.places) {
      initServices();
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps?.places) { initServices(); clearInterval(interval); }
      }, 300);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchSuggestions = useCallback((value: string) => {
    if (!autocompleteService.current || value.trim().length < 3) {
      setSuggestions([]); setShowSuggestions(false); return;
    }
    setLoadingSuggestions(true);
    autocompleteService.current.getPlacePredictions(
      { input: value, componentRestrictions: { country: "ar" }, types: ["address"] },
      (predictions, status) => {
        setLoadingSuggestions(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setSuggestions([]); setShowSuggestions(false); return;
        }
        setSuggestions(predictions.slice(0, 5).map((p) => ({
          placeId: p.place_id,
          description: p.description,
          mainText: p.structured_formatting.main_text,
          secondaryText: p.structured_formatting.secondary_text || "",
        })));
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

  return (
    <>
      <div ref={dummyDivRef} style={{ display: "none" }} />
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: "16px", border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>

          {/* Header */}
          <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "0.5px solid var(--color-border-tertiary, #e5e7eb)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="17" height="17" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary, #111)", margin: 0 }}>¿Dónde enviamos el pedido?</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary, #6b7280)", padding: "4px", borderRadius: "8px", display: "flex" }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Resumen producto */}
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <div style={{ background: "var(--color-background-secondary, #f9fafb)", borderRadius: "10px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "var(--color-background-tertiary, #f3f4f6)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" fill="none" stroke="var(--color-text-tertiary, #9ca3af)" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary, #111)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{productName}</p>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", margin: 0 }}>${price.toLocaleString("es-AR")}{unitLabel ? ` / ${unitLabel}` : " / u."}</p>
              </div>
            </div>
          </div>

          {/* Cantidad + precio dinámico */}
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary, #6b7280)", margin: "0 0 8px" }}>Cantidad</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button onClick={() => handleQtyChange(localQty - 1)} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "0.5px solid var(--color-border-secondary, #d1d5db)", background: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-primary, #111)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <input type="number" value={localQty} min={1} onChange={(e) => handleQtyChange(Number(e.target.value))} style={{ width: "60px", textAlign: "center", fontSize: "14px", padding: "6px", borderRadius: "8px", border: "0.5px solid var(--color-border-secondary, #d1d5db)", color: "var(--color-text-primary, #111)" }} />
              <button onClick={() => handleQtyChange(localQty + 1)} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "0.5px solid var(--color-border-secondary, #d1d5db)", background: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-primary, #111)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              <div style={{ marginLeft: "auto", background: "var(--color-background-secondary, #f3f4f6)", borderRadius: "8px", padding: "6px 12px", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <p style={{ fontSize: "11px", color: "var(--color-text-tertiary, #9ca3af)", margin: 0 }}>Total</p>
                <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary, #111)", margin: 0 }}>${totalPrice.toLocaleString("es-AR")}</p>
              </div>
            </div>
          </div>

          {/* Opciones de envío */}
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary, #6b7280)", margin: "0 0 8px" }}>Método de envío</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <ShippingBlock selected={selectedShipping === "platform"} disabled={false} label="Envío por plataforma" description="Podés dividir el costo con otros compradores de tu zona" icon={<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>} onClick={() => onShippingChange("platform")} />
              <ShippingBlock selected={selectedShipping === "factory"} disabled={factoryDisabled} label="Envío por fábrica" description={factoryDisabled ? "No disponible para este producto" : "El vendedor realiza el envío a tu domicilio"} icon={<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h3m6-11h3l3 3v5h-1m-5-8v8"/></svg>} onClick={() => !factoryDisabled && onShippingChange("factory")} />
              <ShippingBlock selected={selectedShipping === "pickup"} disabled={pickupDisabled} label="Retiro en fábrica" description={pickupDisabled ? "No disponible para este producto" : "Retirás en la fábrica — sin costo de envío"} icon={<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>} onClick={() => !pickupDisabled && onShippingChange("pickup")} />
            </div>
          </div>

          {/* Dirección con autocompletado propio */}
          {needsAddress && (
            <div style={{ padding: "1rem 1.5rem 0" }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary, #6b7280)", margin: "0 0 4px" }}>Dirección de entrega</p>
              <p style={{ fontSize: "11px", color: "var(--color-text-tertiary, #9ca3af)", margin: "0 0 8px", lineHeight: 1.5 }}>
                {selectedShipping === "platform"
                  ? "Usamos tu dirección para calcular el precio y comprobar si hay más compradores en tu zona con quienes puedas dividir el precio del envío."
                  : "Usamos tu dirección para calcular el costo del envío desde la fábrica hasta tu domicilio."}
              </p>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <svg width="14" height="14" fill="none" stroke="var(--color-text-tertiary, #9ca3af)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
                </div>
                <input
                  type="text" value={addressInput}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                  autoComplete="off"
                  style={{ width: "100%", padding: "10px 10px 10px 34px", fontSize: "14px", boxSizing: "border-box", borderRadius: "8px", border: "0.5px solid var(--color-border-secondary, #d1d5db)", color: "var(--color-text-primary, #111)", outline: "none" }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--color-background-primary, #fff)", border: "0.5px solid var(--color-border-secondary, #d1d5db)", borderRadius: "10px", overflow: "hidden", zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {suggestions.map((s, i) => (
                      <button key={s.placeId} onClick={() => handleSelectSuggestion(s)}
                        style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: i < suggestions.length - 1 ? "0.5px solid var(--color-border-tertiary, #f3f4f6)" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary, #f9fafb)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <svg width="13" height="13" fill="none" stroke="var(--color-text-tertiary, #9ca3af)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary, #111)", margin: 0 }}>{s.mainText}</p>
                          <p style={{ fontSize: "11px", color: "var(--color-text-secondary, #6b7280)", margin: 0 }}>{s.secondaryText}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {loadingSuggestions && <p style={{ fontSize: "11px", color: "var(--color-text-tertiary, #9ca3af)", margin: "4px 0 0" }}>Buscando dirección...</p>}
              </div>
              {selectedPlace && (
                <div style={{ marginTop: "8px", background: "#f0fdf4", border: "0.5px solid #86efac", borderRadius: "8px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="13" height="13" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <p style={{ fontSize: "12px", color: "#16a34a", margin: 0 }}>{selectedPlace.formattedAddress}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button onClick={handleConfirm} disabled={!canConfirm || saving}
              style={{ width: "100%", padding: "13px", background: canConfirm && !saving ? "#2563eb" : "#93c5fd", color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 500, cursor: canConfirm && !saving ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
              {saving ? "Reservando..." : selectedShipping === "pickup" ? "Confirmar — retiro en fábrica sin costo" : "Confirmar y reservar mi lugar"}
            </button>
            <button onClick={onClose} style={{ width: "100%", padding: "11px", background: "none", border: "0.5px solid var(--color-border-secondary, #d1d5db)", borderRadius: "10px", fontSize: "13px", color: "var(--color-text-secondary, #6b7280)", cursor: "pointer" }}>Cancelar</button>
          </div>

        </div>
      </div>
    </>
  );
}

function ShippingBlock({ selected, disabled, label, description, icon, onClick }: { selected: boolean; disabled: boolean; label: string; description: string; icon: React.ReactNode; onClick: () => void; }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: selected ? "2px solid #2563eb" : "0.5px solid var(--color-border-tertiary, #e5e7eb)", background: selected ? "#eff6ff" : disabled ? "var(--color-background-secondary, #f9fafb)" : "var(--color-background-primary, #fff)", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "12px", textAlign: "left", opacity: disabled ? 0.4 : 1, transition: "border-color 0.15s, background 0.15s" }}>
      <div style={{ width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0, background: selected ? "#dbeafe" : "var(--color-background-secondary, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", color: selected ? "#2563eb" : "var(--color-text-secondary, #6b7280)" }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "13px", fontWeight: 500, margin: "0 0 2px", color: disabled ? "var(--color-text-tertiary, #9ca3af)" : selected ? "#1d4ed8" : "var(--color-text-primary, #111)" }}>{label}</p>
        <p style={{ fontSize: "11px", margin: 0, lineHeight: 1.4, color: "var(--color-text-tertiary, #9ca3af)" }}>{description}</p>
      </div>
      <div style={{ width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, border: selected ? "5px solid #2563eb" : "1.5px solid var(--color-border-secondary, #d1d5db)", background: "white", transition: "border 0.15s" }} />
    </button>
  );
}