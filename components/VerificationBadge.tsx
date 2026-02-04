// components/VerificationBadge.tsx
"use client";

type Props = {
  verified: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export default function VerificationBadge({ 
  verified,
  showLabel = true,
  size = 'md' 
}: Props) {
  
  // ✅ SOLO MOSTRAR SI ESTÁ VERIFICADO
  if (!verified) return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (!showLabel) {
    // Solo ícono circular
    return (
      <div 
        className={`
          inline-flex items-center justify-center
          bg-blue-600 text-white border-2 border-white
          ${size === 'sm' ? 'w-5 h-5 text-xs' : size === 'md' ? 'w-6 h-6 text-sm' : 'w-8 h-8 text-base'}
          rounded-full font-bold shadow-md
        `}
        title="Empresa Verificada"
      >
        ✓
      </div>
    );
  }

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5
        bg-blue-100 text-blue-800 border-2 border-blue-300
        ${sizeClasses[size]}
        rounded-full font-semibold
      `}
    >
      <span className={`${iconSizes[size]} font-bold`}>
        ✓
      </span>
      <span>Verificada</span>
    </span>
  );
}