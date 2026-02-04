// lib/firebase-storage.ts - UTILIDAD PARA SUBIR IMÁGENES

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import app from "./firebase-client"; // 🔧 CORREGIDO: importar como default

const storage = getStorage(app);

/**
 * Sube una imagen a Firebase Storage y retorna la URL pública
 * @param file - Archivo de imagen a subir
 * @param folder - Carpeta donde se guardará (ej: "products")
 * @returns URL pública de la imagen subida
 */
export async function uploadImage(
  file: File,
  folder: string = "products"
): Promise<string> {
  try {
    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `${folder}/${fileName}`;

    // Crear referencia en Storage
    const storageRef = ref(storage, filePath);

    // Subir archivo
    const snapshot = await uploadBytes(storageRef, file);

    // Obtener URL pública
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error al subir imagen:", error);
    throw new Error("No se pudo subir la imagen");
  }
}

/**
 * Valida que el archivo sea una imagen válida
 * @param file - Archivo a validar
 * @returns true si es válido, false si no
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Validar tipo de archivo
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: "El archivo debe ser una imagen (JPG, PNG o WEBP)",
    };
  }

  // Validar tamaño (máximo 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "La imagen no debe superar los 5MB",
    };
  }

  return { valid: true };
}