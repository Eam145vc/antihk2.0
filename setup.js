/**
 * Script de configuración inicial para el servidor AntiCheat
 * Este script crea la estructura de directorios necesaria y verifica la configuración
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Configurando Sistema AntiCheat ===\n');

// Crear estructura de directorios
const directories = [
  'logs',
  'public',
  'public/css',
  'public/js',
  'public/images',
  'models',
  'routes',
  'tests'
];

console.log('Creando estructura de directorios...');
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Directorio creado: ${dir}`);
  } else {
    console.log(`✓ Directorio existente: ${dir}`);
  }
});

// Verificar si se necesita crear el archivo .env
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('\nCreando archivo .env con valores predeterminados...');
  try {
    if (fs.existsSync(path.join(__dirname, '.env.example'))) {
      fs.copyFileSync(path.join(__dirname, '.env.example'), path.join(__dirname, '.env'));
      console.log('✓ Archivo .env creado a partir de .env.example');
    } else {
      // Crear un archivo .env básico
      const envContent = `PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/anticheat
JWT_SECRET=anticheat_secure_key_${Math.random().toString(36).substring(2, 15)}
LOG_LEVEL=info
CORS_ORIGIN=*
`;
      fs.writeFileSync(path.join(__dirname, '.env'), envContent);
      console.log('✓ Archivo .env creado con valores predeterminados');
    }
  } catch (error) {
    console.error('✗ Error creando archivo .env:', error.message);
  }
} else {
  console.log('✓ Archivo .env existente');
}

// Verificar MongoDB
console.log('\nVerificando disponibilidad de MongoDB...');
try {
  const { MongoClient } = require('mongodb');
  
  // Determinar URI de MongoDB
  let uri = 'mongodb://localhost:27017/anticheat';
  if (fs.existsSync(path.join(__dirname, '.env'))) {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const mongoUriMatch = envContent.match(/MONGODB_URI=(.*)/);
    if (mongoUriMatch && mongoUriMatch[1]) {
      uri = mongoUriMatch[1].trim();
    }
  }
  
  console.log(`Intentando conectar a MongoDB: ${uri}`);
  
  // Crear un cliente de MongoDB con un timeout corto
  const client = new MongoClient(uri, { 
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  
  // Intentar conectar
  (async () => {
    try {
      await client.connect();
      console.log('✓ Conexión a MongoDB exitosa');
      
      // Crear colecciones iniciales si no existen
      const db = client.db();
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      if (!collectionNames.includes('clients')) {
        await db.createCollection('clients');
        console.log('✓ Colección "clients" creada');
      }
      
      if (!collectionNames.includes('alerts')) {
        await db.createCollection('alerts');
        console.log('✓ Colección "alerts" creada');
      }
      
      await client.close();
    } catch (error) {
      console.error('✗ Error conectando a MongoDB:', error.message);
      console.log('\nAsegúrate de que MongoDB esté ejecutándose y accesible en la URL configurada.');
      console.log('Para instalar MongoDB: https://docs.mongodb.com/manual/installation/');
    }
  })();
} catch (error) {
  console.error('✗ Error al cargar el módulo de MongoDB:', error.message);
  console.log('\nEjecutando "npm install" para instalar dependencias...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✓ Dependencias instaladas correctamente');
  } catch (installError) {
    console.error('✗ Error instalando dependencias:', installError.message);
  }
}

// Verificar archivo principal
if (!fs.existsSync(path.join(__dirname, 'app.js'))) {
  console.error('✗ Error: archivo app.js no encontrado');
  console.log('Asegúrate de que el archivo app.js existe en el directorio raíz.');
} else {
  console.log('✓ Archivo app.js encontrado');
}

// Verificar puerto disponible
const defaultPort = 3000;
console.log(`\nVerificando disponibilidad del puerto ${defaultPort}...`);
try {
  const net = require('net');
  const server = net.createServer();
  
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`✗ El puerto ${defaultPort} ya está en uso.`);
      console.log(`Considera cambiar el puerto en el archivo .env.`);
    } else {
      console.error(`✗ Error verificando puerto:`, err.message);
    }
  });
  
  server.once('listening', () => {
    server.close();
    console.log(`✓ Puerto ${defaultPort} disponible`);
  });
  
  server.listen(defaultPort);
} catch (error) {
  console.error('✗ Error verificando puerto:', error.message);
}

// Verificar archivos de frontend
console.log('\nVerificando archivos de frontend...');
const indexFile = path.join(__dirname, 'public', 'index.html');
if (!fs.existsSync(indexFile)) {
  console.log('✗ Archivo index.html no encontrado');
  console.log('Recuerda copiar los archivos del frontend a la carpeta "public"');
} else {
  console.log('✓ Archivos de frontend encontrados');
}

console.log('\n=== Configuración completada ===');
console.log('\nPara iniciar el servidor, ejecuta:');
console.log('npm start');
console.log('\nPara desarrollo (con recarga automática):');
console.log('npm run dev');