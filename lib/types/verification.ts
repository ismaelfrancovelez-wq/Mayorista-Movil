// lib/types/verification.ts

/**
 * Estado de verificación
 */
export type VerificationStatus = 
  | 'unverified'      // Sin verificar (recién registrado)
  | 'pending'         // En revisión (documentos enviados)
  | 'verified'        // Verificado ✅
  | 'rejected';       // Rechazado (documentos inválidos)

/**
 * Tipo de documento
 */
export type DocumentType =
  | 'cuit'              // Constancia AFIP
  | 'address_proof'     // Comprobante domicilio fiscal
  | 'facade_photo'      // Foto fachada
  | 'dni_front'         // DNI frente
  | 'dni_back'          // DNI dorso
  | 'license'           // Habilitación (opcional)
  | 'certificate';      // Certificados (opcional)

/**
 * Documento subido
 */
export interface VerificationDocument {
  type: DocumentType;
  url: string;           // URL en Firebase Storage
  fileName: string;
  uploadedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

/**
 * Solicitud de verificación
 */
export interface VerificationRequest {
  id?: string;
  manufacturerId: string;
  
  // Información básica
  cuit: string;
  legalName: string;      // Razón social
  businessAddress: string;
  
  // Documentos
  documents: VerificationDocument[];
  
  // Estado
  status: VerificationStatus;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;    // Admin que revisó
  
  // Notas
  notes?: string;         // Notas del admin
  rejectionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Info de verificación en el perfil del fabricante
 */
export interface ManufacturerVerification {
  status: VerificationStatus;
  verifiedAt?: Date;
  cuit?: string;
  legalName?: string;
  
  // Para mostrar en UI
  badge: {
    show: boolean;
    label: string;
    color: 'gray' | 'yellow' | 'blue' | 'red';
    icon: string;
  };
}

/**
 * Helper para obtener info del badge según status
 */
export function getVerificationBadge(status: VerificationStatus): ManufacturerVerification['badge'] {
  switch (status) {
    case 'verified':
      return {
        show: true,
        label: 'Empresa Verificada',
        color: 'blue',
        icon: '✓',
      };
    
    case 'pending':
      return {
        show: true,
        label: 'En Verificación',
        color: 'yellow',
        icon: '⏳',
      };
    
    case 'rejected':
      return {
        show: true,
        label: 'Verificación Rechazada',
        color: 'red',
        icon: '✕',
      };
    
    case 'unverified':
    default:
      return {
        show: false,
        label: 'Sin Verificar',
        color: 'gray',
        icon: '',
      };
  }
}