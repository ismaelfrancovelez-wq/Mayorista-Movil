"use client";
// components/products/ImageCarousel.tsx

import { useState } from "react";

type Props = {
  images: string[];
  productName: string;
};

export default function ImageCarousel({ images, productName }: Props) {
  const [current, setCurrent] = useState(0);
  const total = images.length;

  return (
    <div className="flex gap-3 p-4 h-full">

      {/* MINIATURAS VERTICALES — solo si hay más de 1 imagen */}
      {total > 1 && (
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "480px" }}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === current ? "border-blue-500" : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img
                src={img}
                alt={`${productName} miniatura ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* IMAGEN PRINCIPAL */}
      <div className="relative flex-1 flex items-center justify-center bg-white rounded-lg overflow-hidden">
        <img
          src={images[current]}
          alt={`${productName} — foto ${current + 1}`}
          className="w-full h-full object-contain"
          style={{ maxHeight: "460px" }}
        />

        {/* FLECHAS — solo si hay más de 1 imagen */}
        {total > 1 && (
          <>
            <button
              onClick={() => setCurrent((c) => (c - 1 + total) % total)}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-full w-9 h-9 flex items-center justify-center transition-colors shadow-sm z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => setCurrent((c) => (c + 1) % total)}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-full w-9 h-9 flex items-center justify-center transition-colors shadow-sm z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

    </div>
  );
}