// add-dynamic-exports.js
// Script para agregar automáticamente export dynamic y revalidate a APIs

const fs = require('fs');
const path = require('path');

// Lista de archivos a modificar
const filesToModify = [
  // FASE 1 - CRÍTICOS
  'app/api/products/explore/route.ts',
  'app/api/products/my-products/route.ts',
  'app/api/manufacturers/profile/route.ts',
  'app/api/auth/me/route.ts',
  'app/api/lots/active/route.ts',
  'app/api/featured/active/route.ts',
  
  // FASE 2 - IMPORTANTES
  'app/api/lots/fraccionado/progress/route.ts',
  'app/api/manufacturers/verification/status/route.ts',
  'app/api/manufacturers/mp-status/route.ts',
  'app/api/manufacturers/mp-status-public/route.ts',
  'app/api/lots/[productId]/route.ts',
  
  // FASE 3 - OPCIONALES
  'app/api/manufacturers/address/route.ts',
  'app/api/retailers/address/route.ts',
];

// Líneas a agregar
const dynamicExports = `export const dynamic = 'force-dynamic';
export const revalidate = 0;
`;

// Contador de cambios
let modified = 0;
let skipped = 0;
let errors = 0;

console.log('🚀 Iniciando script para agregar exports dinámicos...\n');

filesToModify.forEach((filePath) => {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Archivo no encontrado: ${filePath}`);
      skipped++;
      return;
    }

    // Leer contenido del archivo
    let content = fs.readFileSync(filePath, 'utf8');

    // Verificar si ya tiene los exports
    if (content.includes("export const dynamic = 'force-dynamic'") && 
        content.includes('export const revalidate = 0')) {
      console.log(`✅ Ya actualizado: ${filePath}`);
      skipped++;
      return;
    }

    // Buscar la primera línea de import
    const firstImportMatch = content.match(/^import\s+{[^}]+}\s+from\s+["'][^"']+["'];?/m);
    
    if (!firstImportMatch) {
      console.log(`⚠️  No se encontró import en: ${filePath}`);
      skipped++;
      return;
    }

    const firstImport = firstImportMatch[0];
    const firstImportIndex = content.indexOf(firstImport);
    const afterFirstImport = firstImportIndex + firstImport.length;

    // Verificar si ya existe "export const dynamic"
    if (content.includes("export const dynamic")) {
      // Ya tiene dynamic, solo agregar revalidate si falta
      if (!content.includes('export const revalidate')) {
        const dynamicLineMatch = content.match(/export const dynamic = ['"]force-dynamic['"];?/);
        if (dynamicLineMatch) {
          const dynamicLine = dynamicLineMatch[0];
          const dynamicIndex = content.indexOf(dynamicLine);
          const afterDynamic = dynamicIndex + dynamicLine.length;
          
          content = 
            content.slice(0, afterDynamic) +
            '\nexport const revalidate = 0;' +
            content.slice(afterDynamic);
          
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`✨ Actualizado (agregado revalidate): ${filePath}`);
          modified++;
        }
      } else {
        console.log(`✅ Ya tiene ambos exports: ${filePath}`);
        skipped++;
      }
    } else {
      // No tiene dynamic, agregar ambos
      content = 
        content.slice(0, afterFirstImport) +
        '\n' + dynamicExports +
        content.slice(afterFirstImport);
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✨ Actualizado (agregados exports): ${filePath}`);
      modified++;
    }

  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    errors++;
  }
});

console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN:');
console.log(`✅ Archivos modificados: ${modified}`);
console.log(`⏭️  Archivos omitidos: ${skipped}`);
console.log(`❌ Errores: ${errors}`);
console.log('='.repeat(50));

if (modified > 0) {
  console.log('\n🎉 ¡Cambios completados exitosamente!');
  console.log('\n📝 Próximos pasos:');
  console.log('1. Revisar los cambios: git diff');
  console.log('2. Probar localmente: npm run dev');
  console.log('3. Subir a Vercel:');
  console.log('   git add .');
  console.log('   git commit -m "Make APIs dynamic for real-time updates"');
  console.log('   git push');
} else {
  console.log('\n✨ No hay nada que modificar. Todo está actualizado.');
}