// components/OnboardingChecklist.tsx
// ✅ NUEVO: Onboarding guiado post-registro
//
// Cómo funciona:
// - Se muestra solo si el usuario NO completó el onboarding todavía
// - Detecta automáticamente qué pasos ya hizo (dirección cargada, primer lote)
// - Se oculta permanentemente cuando el usuario hace clic en "Listo" o completa los 3 pasos
// - El estado "dismisseado" se guarda en localStorage para no volver a aparecer
//
// Dónde insertar:
// - En app/dashboard/pedidos-fraccionados/page.tsx, arriba de todo el contenido principal
// - Ejemplo: <OnboardingChecklist userId={userId} hasAddress={!!address} hasOrders={orders.length > 0} />

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Props = {
  // ID del usuario para hacer la clave de localStorage única por cuenta
  userId: string;
  // Si el usuario ya tiene dirección cargada en su perfil
  hasAddress: boolean;
  // Si el usuario ya tiene al menos un pedido o reserva
  hasOrders: boolean;
};

type Step = {
  id: string;
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
};

export default function OnboardingChecklist({ userId, hasAddress, hasOrders }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `onboarding_dismissed_${userId}`;

  // Verificar si ya fue dismisseado en sesiones anteriores
  useEffect(() => {
    if (!userId) return;
    const isDismissed = localStorage.getItem(storageKey) === "true";
    if (!isDismissed) {
      setVisible(true);
    }
  }, [userId, storageKey]);

  const steps: Step[] = [
    {
      id: "profile",
      icon: "📍",
      title: "Completá tu dirección",
      description: "Necesitás tu dirección para calcular el costo de envío de tus pedidos.",
      href: "/dashboard/pedidos-fraccionados/perfil",
      cta: "Ir al perfil →",
      done: hasAddress,
    },
    {
      id: "explore",
      icon: "🔍",
      title: "Explorá los productos",
      description: "Buscá entre cientos de productos a precio de fábrica y encontrá lo que necesitás.",
      href: "/explorar",
      cta: "Explorar ahora →",
      done: false, // Siempre false — es un paso de descubrimiento, no verificable
    },
    {
      id: "order",
      icon: "📦",
      title: "Unite a tu primer lote",
      description: "Cuando encontrés un producto, sumarte es un solo clic. El lote se completa con otros compradores.",
      href: "/explorar",
      cta: "Ver productos →",
      done: hasOrders,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  function handleDismiss() {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
    // Animación de salida
    setTimeout(() => setVisible(false), 300);
  }

  // Auto-dismiss cuando completa los 3 pasos
  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(handleDismiss, 2000);
      return () => clearTimeout(timer);
    }
  }, [allDone]);

  if (!visible || dismissed) return null;

  return (
    <div
      className={`mb-8 bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden transition-all duration-300 ${
        dismissed ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">
            {allDone ? "¡Todo listo! 🎉" : "Primeros pasos"}
          </h2>
          <p className="text-blue-100 text-sm mt-0.5">
            {allDone
              ? "Completaste tu configuración inicial."
              : `${completedCount} de ${steps.length} pasos completados`}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/70 hover:text-white transition text-sm flex items-center gap-1"
          aria-label="Cerrar onboarding"
        >
          <span>Cerrar</span>
          <span className="text-lg leading-none">×</span>
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-blue-50">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Pasos */}
      <div className="divide-y divide-gray-50">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start gap-4 px-6 py-4 transition-colors ${
              step.done ? "bg-green-50/40" : "bg-white"
            }`}
          >
            {/* Icono / check */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold mt-0.5 ${
                step.done
                  ? "bg-green-100 text-green-600"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              {step.done ? "✓" : step.icon}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <p
                className={`font-semibold text-sm ${
                  step.done ? "text-green-700 line-through" : "text-gray-900"
                }`}
              >
                {step.title}
              </p>
              {!step.done && (
                <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              )}
            </div>

            {/* CTA */}
            {!step.done && (
              <Link
                href={step.href}
                className="flex-shrink-0 text-blue-600 hover:text-blue-700 text-sm font-semibold whitespace-nowrap transition"
              >
                {step.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Footer con acción principal */}
      {!allDone && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Podés cerrar esto cuando quieras — no vuelve a aparecer.
          </p>
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium transition"
          >
            Ya lo entiendo, cerrar
          </button>
        </div>
      )}
    </div>
  );
}