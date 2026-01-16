#!/usr/bin/env node

/**
 * Script de prueba para verificar conexión con Cloudflare R2
 * Uso: node test-r2.js
 */

require('dotenv').config();
const { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL,
};

console.log('\n🔍 Verificando configuración de R2...\n');

// Verificar variables de entorno
const missing = [];
if (!config.accountId) missing.push('R2_ACCOUNT_ID');
if (!config.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
if (!config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
if (!config.bucketName) missing.push('R2_BUCKET_NAME');

if (missing.length > 0) {
  console.error('❌ Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

console.log('✅ Variables de entorno configuradas:');
console.log(`   - R2_ACCOUNT_ID: ${config.accountId}`);
console.log(`   - R2_ACCESS_KEY_ID: ${config.accessKeyId.substring(0, 8)}...`);
console.log(`   - R2_SECRET_ACCESS_KEY: ${config.secretAccessKey.substring(0, 8)}...`);
console.log(`   - R2_BUCKET_NAME: ${config.bucketName}`);
console.log(`   - R2_PUBLIC_URL: ${config.publicUrl || 'No configurada'}\n`);

// Construir endpoint
const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
console.log(`📡 Endpoint: ${endpoint}\n`);

// Crear cliente S3
const s3Client = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

async function testR2() {
  try {
    // Test 1: Listar objetos
    console.log('🧪 Test 1: Listar objetos en el bucket...');
    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucketName,
      MaxKeys: 5,
    });

    const listResult = await s3Client.send(listCommand);
    console.log(`✅ Bucket accesible! Objetos encontrados: ${listResult.KeyCount || 0}`);

    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log('\n📂 Archivos en el bucket:');
      listResult.Contents.forEach((obj, i) => {
        console.log(`   ${i + 1}. ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
      });
    } else {
      console.log('   (El bucket está vacío)');
    }

    // Test 2: Subir archivo de prueba
    console.log('\n🧪 Test 2: Subir archivo de prueba...');
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testKey = 'test/test-connection.txt';

    const putCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    await s3Client.send(putCommand);
    console.log(`✅ Archivo subido exitosamente: ${testKey}`);

    // Test 3: Verificar que existe
    console.log('\n🧪 Test 3: Verificar archivo subido...');
    const headCommand = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
    });

    const headResult = await s3Client.send(headCommand);
    console.log(`✅ Archivo verificado!`);
    console.log(`   - Content-Type: ${headResult.ContentType}`);
    console.log(`   - Size: ${headResult.ContentLength} bytes`);
    console.log(`   - Last Modified: ${headResult.LastModified}`);

    // Mostrar URL pública
    const publicUrl = config.publicUrl
      ? `${config.publicUrl}/${testKey}`
      : `${endpoint}/${config.bucketName}/${testKey}`;

    console.log(`\n🔗 URL del archivo:`);
    console.log(`   ${publicUrl}`);
    console.log(`\n⚠️  NOTA: Para que esta URL funcione, debes habilitar Public Access en Cloudflare R2.`);

    // Resumen
    console.log('\n✅ ¡Todos los tests pasaron exitosamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Habilitar Public Development URL en Cloudflare R2');
    console.log('   2. Agregar la URL pública a R2_PUBLIC_URL en .env');
    console.log('   3. Probar generación de remitos en el sistema');

  } catch (error) {
    console.error('\n❌ Error durante los tests:');
    console.error(`   Tipo: ${error.name}`);
    console.error(`   Mensaje: ${error.message}`);

    if (error.$metadata) {
      console.error(`   HTTP Status: ${error.$metadata.httpStatusCode}`);
    }

    if (error.name === 'InvalidAccessKeyId') {
      console.error('\n💡 Solución: Verifica que R2_ACCESS_KEY_ID sea correcto');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('\n💡 Solución: Verifica que R2_SECRET_ACCESS_KEY sea correcto');
    } else if (error.name === 'NoSuchBucket') {
      console.error('\n💡 Solución: Verifica que el bucket "megasys-remitos" exista');
    } else {
      console.error('\n💡 Revisa la configuración de R2 en Cloudflare Dashboard');
    }

    process.exit(1);
  }
}

console.log('🚀 Iniciando tests de conexión con Cloudflare R2...\n');
testR2().then(() => {
  console.log('\n✨ Tests completados!\n');
  process.exit(0);
});
