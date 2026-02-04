"use client";

import Link from "next/link";

type Props = {
  productName: string;
  daysLeft: number;
};

export default function FeaturedExpirationAlert({
  productName,
  daysLeft,
}: Props) {
  const urgent = daysLeft <= 1;

  return (
    <div
      className={`rounded-xl p-5 mb-6 border ${
        urgent
          ? "bg-red-50 border-red-400 text-red-700"
          : "bg-yellow-50 border-yellow-400 text-yellow-700"
      }`}
    >
      <h3 className="font-semibold text-lg mb-1">
        ⚠️ Tu producto destacado está por vencer
      </h3>

      <p className="mb-3">
        <strong>{productName}</strong> vence en{" "}
        <strong>{daysLeft} día{daysLeft > 1 && "s"}</strong>.
        <br />
        Si no renovás, perderás el lugar automáticamente.
      </p>

      <Link
        href="/dashboard/featured/renew"
        className={`inline-block px-4 py-2 rounded-md text-sm font-medium ${
          urgent
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-yellow-500 text-black hover:bg-yellow-600"
        }`}
      >
        Renovar ahora
      </Link>
    </div>
  );
}