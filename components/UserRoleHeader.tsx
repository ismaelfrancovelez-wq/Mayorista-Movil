// components/UserRoleHeader.tsx
//
// ✅ REFACTOR (Fase 1):
// - Eliminado todo el sistema de gamificación: badges hexagonales, racha,
//   logros permanentes, niveles, modal de reputación, descuentos por racha.
// - El header ahora solo muestra: avatar + email + rol activo.
// - Si en el futuro se quiere reintroducir gamificación, hay que armarla de cero.
"use client";

// 4 roles soportados
type Role = "manufacturer" | "retailer" | "distributor" | "wholesaler";

// Mapa de roles a etiqueta en español
const ROLE_LABELS: Record<Role, string> = {
  manufacturer: "Fabricante",
  retailer:     "Revendedor",
  distributor:  "Distribuidor",
  wholesaler:   "Mayorista",
};

// Colores por rol (dot indicador, texto y avatar)
const ROLE_COLORS: Record<Role, { dot: string; text: string; avatar: string }> = {
  manufacturer: { dot: "#3b82f6", text: "#1d4ed8", avatar: "linear-gradient(135deg,#1d4ed8,#3b82f6)" },
  retailer:     { dot: "#8b5cf6", text: "#6d28d9", avatar: "linear-gradient(135deg,#6d28d9,#8b5cf6)" },
  distributor:  { dot: "#9333ea", text: "#7e22ce", avatar: "linear-gradient(135deg,#7e22ce,#a855f7)" },
  wholesaler:   { dot: "#16a34a", text: "#15803d", avatar: "linear-gradient(135deg,#15803d,#22c55e)" },
};

interface UserRoleHeaderProps {
  userEmail?: string;
  activeRole: Role;
  userName?: string;
}

export default function UserRoleHeader({
  userEmail,
  activeRole,
  userName,
}: UserRoleHeaderProps) {
  const currentLabel = ROLE_LABELS[activeRole] ?? activeRole;
  const colors       = ROLE_COLORS[activeRole] ?? ROLE_COLORS.manufacturer;

  const initials = userName
    ? userName.slice(0, 2).toUpperCase()
    : userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: "10px 16px 10px 14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          minWidth: 0,
        }}
      >
        {/* Avatar con iniciales */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: colors.avatar,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
            letterSpacing: "0.04em",
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          }}
        >
          {initials}
        </div>

        {/* Email + rol activo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "#6b7280",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 200,
              lineHeight: 1.3,
            }}
          >
            {userEmail || "Sin sesión"}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: colors.text,
              lineHeight: 1.3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: colors.dot,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Rol activo: {currentLabel}
          </span>
        </div>
      </div>
    </div>
  );
}