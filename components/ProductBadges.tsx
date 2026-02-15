// components/ProductBadges.tsx
"use client";

type ProductBadgesProps = {
  isVerified: boolean;
  isIntermediary: boolean;
  size?: "small" | "medium" | "large";
};

export default function ProductBadges({ 
  isVerified, 
  isIntermediary,
  size = "medium" 
}: ProductBadgesProps) {
  
  // Definir tamaños según el prop
  const sizeClasses = {
    small: {
      container: "gap-1.5",
      badge: "px-2 py-0.5 text-xs",
      icon: "text-xs",
    },
    medium: {
      container: "gap-2",
      badge: "px-3 py-1 text-sm",
      icon: "text-sm",
    },
    large: {
      container: "gap-2.5",
      badge: "px-4 py-1.5 text-base",
      icon: "text-base",
    },
  };

  const classes = sizeClasses[size];

  // Si no hay ningún badge, no mostrar nada
  if (!isVerified && !isIntermediary) {
    return null;
  }

  return (
    <div className={`flex items-center flex-wrap ${classes.container}`}>
      
      {/* BADGE DE VERIFICADO */}
      {isVerified && (
        <span className={`inline-flex items-center gap-1 bg-blue-100 text-blue-700 font-semibold rounded-full ${classes.badge}`}>
          <svg 
            className={classes.icon}
            viewBox="0 0 24 24" 
            fill="currentColor"
            width="16"
            height="16"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          Verificado
        </span>
      )}

      {/* BADGE DE INTERMEDIARIO - 🆕 azul sólido (era naranja) */}
      {isIntermediary && (
        <span className={`inline-flex items-center gap-1 bg-blue-600 text-white font-semibold rounded-full ${classes.badge}`}>
          <svg 
            className={classes.icon}
            viewBox="0 0 24 24" 
            fill="currentColor"
            width="16"
            height="16"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
          Intermediario
        </span>
      )}
    </div>
  );
}