// components/GooglePlacesAutocomplete.tsx
"use client";

import { useEffect, useRef, useState } from "react";

// 🔧 EXPORTAR el tipo para que pueda ser usado en otros archivos
export type PlaceResult = {
  formattedAddress: string;
  lat: number;
  lng: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
};

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Ingresá tu dirección...",
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  // Cargar el script de Google Maps
  useEffect(() => {
    // Verificar si ya está cargado
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsScriptLoaded(true);
      return;
    }

    // Verificar si ya existe un script en proceso de carga
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => setIsScriptLoaded(true));
      existingScript.addEventListener("error", () => setScriptError(true));
      return;
    }

    // Cargar el script
    const script = document.createElement("script");
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error("❌ Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      setScriptError(true);
      return;
    }

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=AR`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log("✅ Google Maps API cargada");
      setIsScriptLoaded(true);
    };

    script.onerror = () => {
      console.error("❌ Error al cargar Google Maps API");
      setScriptError(true);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup si el componente se desmonta
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  // Inicializar el autocompletado cuando el script esté cargado
  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current) return;

    try {
      // Crear instancia de autocomplete
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "ar" }, // Restringir a Argentina
        fields: ["formatted_address", "geometry", "name"],
        types: ["address"], // Solo direcciones
      });

      autocompleteRef.current = autocomplete;

      // Listener para cuando se selecciona un lugar
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          console.warn("⚠️ No se obtuvieron coordenadas");
          return;
        }

        const result: PlaceResult = {
          formattedAddress: place.formatted_address || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        console.log("📍 Lugar seleccionado:", result);
        onPlaceSelected(result);
      });

      console.log("✅ Autocomplete inicializado");
    } catch (error) {
      console.error("❌ Error al inicializar autocomplete:", error);
    }
  }, [isScriptLoaded, onPlaceSelected]);

  if (scriptError) {
    return (
      <div className="w-full">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
        <p className="text-xs text-red-600 mt-1">
          ⚠️ Error al cargar el autocompletado. Ingresá la dirección manualmente.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {!isScriptLoaded && (
        <p className="text-xs text-gray-500 mt-1">
          Cargando autocompletado...
        </p>
      )}
    </div>
  );
}