#!/usr/bin/env node

/**
 * =====================================
 * Script de Migración Automática
 * Fix Dynamic Server Usage Errors
 * =====================================
 * 
 * Este script agrega automáticamente:
 * export const dynamic = 'force-dynamic';
 * 
 * A las 9 rutas API que tienen errores
 * =====================================
 */

const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

// Rutas que necesitan ser migradas
const routesToFix = [
  'app/api/featured/active/route.ts',
  'app/api/lots/active/route.ts',
  'app/api/lots/fraccionado/progress/route.ts',
  'app/api/manufacturers/mp-auth-url/route.ts',
  'app/api/manufacturers/mp-callback/route.ts',
  'app/api/manufacturers/mp-status-public/route.ts',
  'app/api/manufacturers/mp-status/route.ts',
  'app/api/manufacturers/verification/status/route.ts',
  'app/api/products/my-products/route.ts'
];

let successCount = 0;
let skippedCount = 0;
let errorCount = 0;

console.log(`${colors.blue}🚀 Iniciando migración de rutas dinámicas...${colors.reset}\n`);

/**
 * Función principal de migración
 */
function migrateRoute(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  // Verificar si el archivo existe
  if (!fs.existsSync(fullPath)) {
    console.log(`${colors.yellow}⚠️  Archivo no encontrado: ${filePath}${colors.reset}`);
    errorCount++;
    return;
  }
  
  // Leer contenido del archivo
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Verificar si ya tiene el export
  if (content.includes("export const dynamic")) {
    console.log(`${colors.blue}ℹ️  ${filePath} - Ya tiene dynamic export (skipping)${colors.reset}`);
    skippedCount++;
    return;
  }
  
  // Crear backup
  const backupPath = fullPath + '.backup';
  fs.writeFileSync(backupPath, content, 'utf8');
  
  // Procesar el archivo
  const lines = content.split('\n');
  const newLines = [];
  let importsSectionEnded = false;
  let exportAdded = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Agregar la línea actual
    newLines.push(line);
    
    // Detectar fin de imports y agregar el export
    if (!exportAdded && !importsSectionEnded) {
      // Si es una línea de import, continuar
      if (line.trim().startsWith('import ')) {
        continue;
      }
      
      // Si encontramos una línea que no es import ni vacía, insertar el export antes
      if (line.trim() !== '' && !line.trim().startsWith('//')) {
        importsSectionEnded = true;
        // Insertar el export antes de esta línea
        newLines.splice(newLines.length - 1, 0, '');
        newLines.splice(newLines.length - 1, 0, "export const dynamic = 'force-dynamic';");
        newLines.splice(newLines.length - 1, 0, '');
        exportAdded = true;
      }
    }
  }
  
  // Si no se agregó (archivo sin imports), agregar al inicio
  if (!exportAdded) {
    newLines.unshift("export const dynamic = 'force-dynamic';", '');
  }
  
  // Escribir archivo modificado
  const newContent = newLines.join('\n');
  fs.writeFileSync(fullPath, newContent, 'utf8');
  
  console.log(`${colors.green}✅ ${filePath} - Migrado correctamente${colors.reset}`);
  successCount++;
}

/**
 * Ejecutar migración
 */
console.log(`${colors.blue}📝 Procesando ${routesToFix.length} archivos...\n${colors.reset}`);

routesToFix.forEach(route => {
  migrateRoute(route);
});

/**
 * Resumen final
 */
console.log('\n' + '='.repeat(50));
console.log(`${colors.green}✨ Migración completada${colors.reset}`);
console.log('='.repeat(50));
console.log(`${colors.green}✅ Archivos migrados: ${successCount}${colors.reset}`);
console.log(`${colors.blue}ℹ️  Ya tenían el fix: ${skippedCount}${colors.reset}`);
if (errorCount > 0) {
  console.log(`${colors.red}❌ Errores: ${errorCount}${colors.reset}`);
}
console.log('');
console.log(`${colors.blue}💾 Backups creados con extensión .backup${colors.reset}`);
console.log('');
console.log(`${colors.yellow}📋 Próximos pasos:${colors.reset}`);
console.log('   1. Revisar cambios: git diff');
console.log('   2. Probar localmente: npm run dev');
console.log('   3. Commit y push: git add . && git commit -m "fix: add dynamic export to API routes"');
console.log('   4. Vercel redesplegará automáticamente');
console.log('');
console.log(`${colors.yellow}🔄 Para revertir:${colors.reset}`);
console.log('   node revert-migration.js');
console.log('');