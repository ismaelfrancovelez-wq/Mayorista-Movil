// components/ManufacturerInfoCard.tsx - VERSIÓN ACTUALIZADA
"use client";

import ProductBadges from "./ProductBadges";

type DaySchedule = {
  open: string;
  close: string;
  closed: boolean;
};

type WeekSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

type Props = {
  businessName: string;
  profileImageUrl?: string;
  address?: {
    formattedAddress: string;
  };
  phone?: string;
  email?: string;
  schedule?: WeekSchedule;
  verified?: boolean; // Badge de verificado
  isIntermediary?: boolean; // 🆕 NUEVO: Badge de intermediario
};

export default function ManufacturerInfoCard({
  businessName,
  profileImageUrl,
  address,
  phone,
  email,
  schedule,
  verified = false,
  isIntermediary = false, // 🆕 NUEVO
}: Props) {
  
  // Formatear horarios de forma compacta
  function getCompactSchedule(): string {
    if (!schedule) return "No especificado";

    const days = [
      { key: 'monday', short: 'Lun' },
      { key: 'tuesday', short: 'Mar' },
      { key: 'wednesday', short: 'Mié' },
      { key: 'thursday', short: 'Jue' },
      { key: 'friday', short: 'Vie' },
      { key: 'saturday', short: 'Sáb' },
      { key: 'sunday', short: 'Dom' },
    ];

    // Agrupar días con mismo horario
    const groups: { days: string[]; hours: string }[] = [];
    
    for (const day of days) {
      const daySchedule = schedule[day.key as keyof WeekSchedule];
      
      if (daySchedule.closed) continue;
      
      const hours = `${daySchedule.open} - ${daySchedule.close}`;
      const existingGroup = groups.find(g => g.hours === hours);
      
      if (existingGroup) {
        existingGroup.days.push(day.short);
      } else {
        groups.push({ days: [day.short], hours });
      }
    }

    if (groups.length === 0) return "Cerrado";

    return groups.map(g => `${g.days.join(', ')}: ${g.hours}`).join(' | ');
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        🏢 Información del Fabricante
      </h3>

      {/* FOTO Y NOMBRE */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b">
        <div className="relative">
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={businessName}
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
              🏭
            </div>
          )}
          
          {/* ✅ BADGE VERIFICADO SOBRE LA FOTO (solo si verified=true) */}
          {verified && (
            <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white text-xs font-bold shadow-md">
              ✓
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <h4 className="font-bold text-lg text-gray-900 mb-2">
            {businessName}
          </h4>
          
          {/* 🆕 BADGES USANDO EL NUEVO COMPONENTE */}
          <ProductBadges 
            isVerified={verified}
            isIntermediary={isIntermediary}
            size="small"
          />
          
          {address && (
            <p className="text-sm text-gray-600 flex items-center gap-1 mt-2">
              📍 {address.formattedAddress}
            </p>
          )}
        </div>
      </div>

      {/* HORARIOS */}
      {schedule && (
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <span className="text-gray-700 font-medium text-sm">📅</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Horarios de atención:
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {getCompactSchedule()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTACTO */}
      {(phone || email) && (
        <div className="pt-4 border-t space-y-2">
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700">📞</span>
              <a
                href={`tel:${phone}`}
                className="text-blue-600 hover:underline"
              >
                {phone}
              </a>
            </div>
          )}
          
          {email && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700">📧</span>
              <a
                href={`mailto:${email}`}
                className="text-blue-600 hover:underline"
              >
                {email}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}