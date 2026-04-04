"use client";

// components/products/AddressShippingModal.tsx

import { useState } from "react";
import GooglePlacesAutocomplete, { PlaceResult } from "../GooglePlacesAutocomplete";

type ShippingMode = "pickup" | "factory" | "platform";

type Props = {
  productName: string;
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

export default function AddressShippingModal({
  productName,
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
  const [address, setAddress] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [localQty, setLocalQty] = useState(qty);

  // Qué opciones están disponibles según configuración del producto
  const platformAvailable = true;
  const factoryAvailable = allowFactoryShipping && !noShipping;
  const pickupAvailable = allowPickup;

  // La dirección no es necesaria para retiro en fábrica
  const needsAddress = selectedShipping === "platform" || selectedShipping === "factory";
  const canConfirm = !needsAddress || selectedPlace !== null;

  // Texto descriptivo según modo seleccionado
  const infoText = selectedShipping === "factory"
    ? "Usamos tu dirección para calcular el costo del envío desde la fábrica hasta tu domicilio."
    : "Usamos tu dirección para calcular el precio y comprobar si hay más compradores en tu zona con quienes puedas dividir el precio del envío.";

  // Label del modo actual para mostrar debajo del nombre del producto
  const shippingModeLabel =
    selectedShipping === "platform" ? "Envío por plataforma" :
    selectedShipping === "factory" ? "Envío por fábrica" :
    "Retiro en fábrica";

  function handleQtyChange(val: number) {
    const safe = Math.max(1, val);
    setLocalQty(safe);
    onQtyChange(safe);
  }

  async function handleConfirm() {
    if (!canConfirm || saving) return;
    const place: PlaceResult = needsAddress && selectedPlace
      ? selectedPlace
      : { formattedAddress: "", lat: 0, lng: 0 };
    onConfirm(place, selectedShipping, localQty);
  }

  // Estilo chip activo vs inactivo
  function chipStyle(active: boolean, disabled: boolean): React.CSSProperties {
    if (disabled) return {
      fontSize: "12px", fontWeight: 500,
      padding: "5px 12px", borderRadius: "20px",
      border: "0.5px solid var(--color-border-tertiary)",
      background: "var(--color-background-secondary)",
      color: "var(--color-text-tertiary)",
      cursor: "not-allowed", opacity: 0.5,
    };
    if (active) return {
      fontSize: "12px", fontWeight: 500,
      padding: "5px 12px", borderRadius: "20px",
      border: "none",
      background: "#2563eb",
      color: "white",
      cursor: "pointer",
    };
    return {
      fontSize: "12px", fontWeight: 500,
      padding: "5px 12px", borderRadius: "20px",
      border: "0.5px solid var(--color-border-secondary)",
      background: "var(--color-background-primary)",
      color: "var(--color-text-secondary)",
      cursor: "pointer",
    };
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-background-primary, #fff)",
        borderRadius: "16px",
        border: "0.5px solid var(--color-border-tertiary, #e5e7eb)",
        width: "100%", maxWidth: "440px",
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "1.25rem 1.5rem 1rem",
          borderBottom: "0.5px solid var(--color-border-tertiary, #e5e7eb)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "50%",
              background: "#dbeafe",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="17" height="17" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary, #111)", margin: 0 }}>
              ¿Dónde enviamos el pedido?
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary, #6b7280)",
            padding: "4px", borderRadius: "8px", display: "flex",
          }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Resumen producto + chips de modo ── */}
        <div style={{ margin: "1rem 1.5rem 0" }}>
          <div style={{
            background: "var(--color-background-secondary, #f9fafb)",
            borderRadius: "10px", padding: "0.85rem 1rem",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            {/* Ícono */}
            <div style={{
              width: "38px", height: "38px", borderRadius: "8px",
              background: "var(--color-background-tertiary, #f3f4f6)",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" fill="none" stroke="var(--color-text-tertiary, #9ca3af)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>

            {/* Nombre + label del modo */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: "13px", fontWeight: 500,
                color: "var(--color-text-primary, #111)",
                margin: "0 0 3px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {productName}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <svg width="11" height="11" fill="none" stroke="var(--color-text-secondary, #6b7280)" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h3m6-11h3l3 3v5h-1m-5-8v8"/>
                </svg>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", margin: 0 }}>
                  {shippingModeLabel}
                </p>
              </div>
            </div>

            {/* Chips de selección de modo */}
            <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
              <button
                onClick={() => platformAvailable && onShippingChange("platform")}
                disabled={!platformAvailable}
                style={chipStyle(selectedShipping === "platform", !platformAvailable)}
              >
                Plataforma
              </button>

              {factoryAvailable && (
                <button
                  onClick={() => onShippingChange("factory")}
                  style={chipStyle(selectedShipping === "factory", false)}
                >
                  Fábrica
                </button>
              )}

              {pickupAvailable && (
                <button
                  onClick={() => onShippingChange("pickup")}
                  style={chipStyle(selectedShipping === "pickup", false)}
                >
                  Retiro
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Cantidad ── */}
        <div style={{ padding: "1rem 1.5rem 0" }}>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary, #6b7280)", margin: "0 0 8px" }}>
            Cantidad
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => handleQtyChange(localQty - 1)}
              style={{
                width: "34px", height: "34px", borderRadius: "8px",
                border: "0.5px solid var(--color-border-secondary, #d1d5db)",
                background: "none", cursor: "pointer", fontSize: "18px",
                color: "var(--color-text-primary, #111)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >−</button>
            <input
              type="number"
              value={localQty}
              min={1}
              onChange={(e) => handleQtyChange(Number(e.target.value))}
              style={{
                width: "64px", textAlign: "center", fontSize: "14px",
                padding: "6px", borderRadius: "8px",
                border: "0.5px solid var(--color-border-secondary, #d1d5db)",
                color: "var(--color-text-primary, #111)",
              }}
            />
            <button
              onClick={() => handleQtyChange(localQty + 1)}
              style={{
                width: "34px", height: "34px", borderRadius: "8px",
                border: "0.5px solid var(--color-border-secondary, #d1d5db)",
                background: "none", cursor: "pointer", fontSize: "18px",
                color: "var(--color-text-primary, #111)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >+</button>
          </div>
        </div>

        {/* ── Texto informativo (cambia según modo) ── */}
        {needsAddress && (
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <p style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #6b7280)",
              margin: 0, lineHeight: 1.6,
            }}>
              {infoText}
            </p>
          </div>
        )}

        {/* ── Dirección (solo si el modo la necesita) ── */}
        {needsAddress && (
          <div style={{ padding: "1rem 1.5rem 0" }}>
            <p style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #6b7280)",
              margin: "0 0 8px",
            }}>
              Dirección de entrega
            </p>
            <GooglePlacesAutocomplete
              value={address}
              onChange={setAddress}
              onPlaceSelected={(place) => {
                setAddress(place.formattedAddress);
                setSelectedPlace(place);
              }}
              placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {selectedPlace && (
              <div style={{
                marginTop: "8px",
                background: "#f0fdf4",
                border: "0.5px solid #86efac",
                borderRadius: "8px",
                padding: "8px 12px",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <svg width="13" height="13" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                <p style={{ fontSize: "12px", color: "#16a34a", margin: 0 }}>
                  {selectedPlace.formattedAddress}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
            style={{
              width: "100%", padding: "13px",
              background: canConfirm && !saving ? "#2563eb" : "#93c5fd",
              color: "white", border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: 500,
              cursor: canConfirm && !saving ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            {saving
              ? "Reservando..."
              : selectedShipping === "pickup"
              ? "Confirmar — retiro en fábrica sin costo"
              : "Confirmar y reservar mi lugar"}
          </button>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "11px",
              background: "none",
              border: "0.5px solid var(--color-border-secondary, #d1d5db)",
              borderRadius: "10px", fontSize: "13px",
              color: "var(--color-text-secondary, #6b7280)", cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}