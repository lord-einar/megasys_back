#!/usr/bin/env node
/**
 * Script para migrar archivos CommonJS a ES Modules
 * Ejecutar: node scripts/migrate-to-esm.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src');

// Patrones de reemplazo
const transformations = [
    // require('dotenv').config() -> import 'dotenv/config'
    {
        pattern: /require\(['"]dotenv['"]\)\.config\(\);?/g,
        replacement: "import 'dotenv/config';"
    },
    // const X = require('package') -> import X from 'package'
    {
        pattern: /const\s+(\w+)\s*=\s*require\(['"]([^'"./][^'"]*)['"]\);?/g,
        replacement: "import $1 from '$2';"
    },
    // const { X } = require('package') -> import { X } from 'package'
    {
        pattern: /const\s+(\{[^}]+\})\s*=\s*require\(['"]([^'"./][^'"]*)['"]\);?/g,
        replacement: "import $1 from '$2';"
    },
    // const X = require('./local') -> import X from './local.js'
    {
        pattern: /const\s+(\w+)\s*=\s*require\(['"](\.\.?\/[^'"]+)['"]\);?/g,
        replacement: (match, varName, modulePath) => {
            // Agregar .js si no tiene extensión
            const jsPath = modulePath.endsWith('.js') ? modulePath : `${modulePath}.js`;
            return `import ${varName} from '${jsPath}';`;
        }
    },
    // const { X } = require('./local') -> import { X } from './local.js'
    {
        pattern: /const\s+(\{[^}]+\})\s*=\s*require\(['"](\.\.?\/[^'"]+)['"]\);?/g,
        replacement: (match, destructure, modulePath) => {
            const jsPath = modulePath.endsWith('.js') ? modulePath : `${modulePath}.js`;
            return `import ${destructure} from '${jsPath}';`;
        }
    },
    // module.exports = X -> export default X
    {
        pattern: /module\.exports\s*=\s*(\w+);?$/gm,
        replacement: 'export default $1;'
    },
    // module.exports = { ... } -> export { ... } or export default { ... }
    {
        pattern: /module\.exports\s*=\s*(\{[\s\S]*?\});?$/gm,
        replacement: 'export default $1;'
    },
    // exports.X = Y -> export const X = Y
    {
        pattern: /exports\.(\w+)\s*=\s*/g,
        replacement: 'export const $1 = '
    },
    // __dirname replacement (needs manual review)
    // path.join(__dirname, ...) -> with fileURLToPath
];

// Archivos/carpetas a ignorar
const ignorePaths = [
    'node_modules',
    'migrations',
    'seeders',
    '__tests__',
    '.js.map'
];

function shouldProcess(filePath) {
    return !ignorePaths.some(ignore => filePath.includes(ignore));
}

function processFile(filePath) {
    if (!filePath.endsWith('.js') || !shouldProcess(filePath)) {
        return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Ya está usando ES Modules?
    if (content.includes('import ') && content.includes('export ')) {
        console.log(`✓ Ya migrado: ${filePath}`);
        return false;
    }

    // Aplicar transformaciones
    for (const { pattern, replacement } of transformations) {
        content = content.replace(pattern, replacement);
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Migrado: ${filePath}`);
        return true;
    }

    return false;
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    let count = 0;

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && shouldProcess(filePath)) {
            count += walkDir(filePath);
        } else if (stat.isFile()) {
            if (processFile(filePath)) {
                count++;
            }
        }
    }

    return count;
}

console.log('🔄 Iniciando migración a ES Modules...');
console.log(`📂 Directorio: ${srcDir}`);
console.log('');

const migratedCount = walkDir(srcDir);

console.log('');
console.log(`✅ Migración completada: ${migratedCount} archivos actualizados`);
console.log('');
console.log('⚠️  IMPORTANTE: Revisa manualmente los siguientes casos:');
console.log('   - Uso de __dirname y __filename');
console.log('   - require() dinámicos');
console.log('   - Circular dependencies');
console.log('   - Top-level await donde sea necesario');
