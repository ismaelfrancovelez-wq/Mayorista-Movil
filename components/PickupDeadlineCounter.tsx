//components/PickupDeadlineCounter.tsx
"use client";

import { useEffect, useState } from "react";
import { getTimeRemaining } from "../lib/business-hours";

type Props = {
  deadline: Date;
  compact?: boolean;
};

export default function PickupDeadlineCounter({ deadline, compact = false }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeRemaining(deadline));
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, [deadline]);

  if (timeLeft.expired) {
    return (
      <div className={compact ? "text-sm" : "text-base"}>
        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-semibold">
          ⏰ VENCIDO
        </span>
      </div>
    );
  }

  const isUrgent = timeLeft.hours <= 24;

  if (compact) {
    return (
      <div className="text-sm">
        <span className={`px-2 py-1 rounded font-medium ${
          isUrgent 
            ? "bg-red-100 text-red-800" 
            : "bg-yellow-100 text-yellow-800"
        }`}>
          ⏰ {timeLeft.formatted}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border-2 ${
      isUrgent
        ? "bg-red-50 border-red-400"
        : "bg-yellow-50 border-yellow-400"
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm mb-1">
            {isUrgent ? "🚨 URGENTE" : "⏰ Tiempo restante"}
          </div>
          <div className={`text-2xl font-bold ${
            isUrgent ? "text-red-700" : "text-yellow-700"
          }`}>
            {timeLeft.formatted}
          </div>
        </div>
        <div className="text-4xl">
          {isUrgent ? "🚨" : "⏰"}
        </div>
      </div>
      {isUrgent && (
        <p className="text-xs text-red-700 mt-2">
          ¡Menos de 24 horas para retirar!
        </p>
      )}
    </div>
  );
}