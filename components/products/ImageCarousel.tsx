"use client";
// components/products/ImageCarousel.tsx
// Carrusel de imágenes para la página de detalle del producto.
// Muestra flechas de navegación solo cuando hay más de 1 imagen.

import { useState } from "react";

type Props = {
  images: string[];
  productName: string;
};

export default function ImageCarousel({ images, productName }: Props) {
  const [current, setCurrent] = useState(0);

  const total = images.length;

  function prev() {
    setCurrent((c) => (c - 1 + total) % total);
  }

  function next() {
    setCurrent((c) => (c + 1) % total);
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: "400px" }}>

      {/* IMAGEN ACTIVA */}
      <img
        src={images[current]}
        alt={`${productName} — foto ${current + 1}`}
        className="w-full object-cover"
        style={{ minHeight: "400px", maxHeight: "600px" }}
      />

      {/* FLECHAS — solo si hay más de 1 imagen */}
      {total > 1 && (
        <>
          {/* Flecha izquierda */}
          <button
            onClick={prev}
            aria-label="Foto anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Flecha derecha */}
          <button
            onClick={next}
            aria-label="Foto siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* PUNTITOS indicadores */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Ir a foto ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? "bg-white" : "bg-white/50 hover:bg-white/75"
                }`}
              />
            ))}
          </div>

          {/* CONTADOR en esquina */}
          <div className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-1 rounded-full z-10">
            {current + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
}