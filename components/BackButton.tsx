// components/BackButton.tsx
"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  label?: string;
  className?: string;
};

export default function BackButton({ 
  label = "Volver", 
  className = "" 
}: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={`text-blue-600 hover:text-blue-700 flex items-center gap-2 font-medium transition ${className}`}
    >
      ← {label}
    </button>
  );
}