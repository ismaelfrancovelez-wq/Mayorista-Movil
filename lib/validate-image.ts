/**
 * Validación de imágenes para productos
 * Uso futuro cuando se implemente upload de imágenes
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImage(file: File): ImageValidationResult {
  // Tamaño máximo: 5MB
  const maxSize = 5 * 1024 * 1024;
  
  // Formatos permitidos
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  
  // Validar tipo
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Formato no permitido. Solo se aceptan JPEG, PNG y WEBP."
    };
  }
  
  // Validar tamaño
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "Imagen demasiado grande. El máximo es 5MB."
    };
  }
  
  // Todo OK
  return { valid: true };
}

/**
 * Ejemplo de uso (cuando implementes el upload):
 * 
 * const validation = validateImage(file);
 * if (!validation.valid) {
 *   alert(validation.error);
 *   return;
 * }
 * // Continuar con el upload...
 */