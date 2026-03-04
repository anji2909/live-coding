const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Le decimos dónde guardar el archivo de la base de datos
const dbPath = path.resolve(__dirname, 'marketplace.sqlite');

// Conectamos a la base de datos (si el archivo no existe, lo crea automáticamente)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('✅ Base de datos SQLite conectada con éxito.');
    }
});

// Creamos las tablas necesarias
db.serialize(() => {
    // 1. Tabla de Usuarios (con contraseña y saldo)
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        saldo REAL DEFAULT 0.00
    )`);

    // 2. Tabla de Productos (relacionada con el usuario que la vende)
    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendedor_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        precio REAL NOT NULL,
        FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    )`);

    // 3. Tabla de Compras/Pedidos
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comprador_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comprador_id) REFERENCES usuarios(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`);
});

// Exportamos la base de datos para poder usarla en otros archivos
module.exports = db;