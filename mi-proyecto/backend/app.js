const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./database/db'); // Tu base de datos

const app = express();
const PORT = 3000;

// --- CONFIGURACIONES ---
// 1. Permitir que el servidor lea los datos de los formularios HTML (Checklist: Validación)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. Configurar las sesiones (Checklist: Autenticación)
app.use(session({
    secret: 'clave_super_secreta_para_mi_tienda', 
    resave: false,
    saveUninitialized: false
}));

// 3. Decirle al servidor dónde estarán los archivos HTML (Frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// --- RUTAS DE AUTENTICACIÓN ---

// Ruta para procesar el REGISTRO
app.post('/api/registro', async (req, res) => {
    const { username, password } = req.body;

    // Validación básica: que no envíen campos vacíos
    if (!username || !password) {
        return res.send('Error: Debes completar todos los campos. <a href="/registro.html">Volver</a>');
    }

    try {
        // Encriptar la contraseña (¡NUNCA en texto plano!)
        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        // Guardar en la base de datos
        const query = `INSERT INTO usuarios (username, password) VALUES (?, ?)`;
        db.run(query, [username, passwordHasheada], function(err) {
            if (err) {
                // Si da error, suele ser porque el username ya existe (lo pusimos UNIQUE)
                return res.send('Error: El nombre de usuario ya existe. <a href="/registro.html">Volver</a>');
            }
            res.send('¡Registro exitoso! Ya puedes <a href="/login.html">Iniciar Sesión</a>.');
        });
    } catch (error) {
        console.error(error);
        res.send('Error interno del servidor.');
    }
});


// --- RUTAS DE LOGIN Y AUTENTICACIÓN ---

// Ruta para procesar el LOGIN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.send('Error: Campos vacíos. <a href="/login.html">Volver</a>');
    }

    // 1. Buscamos al usuario en la base de datos
    const query = `SELECT * FROM usuarios WHERE username = ?`;
    db.get(query, [username], async (err, user) => {
        if (err) return res.send('Error en la base de datos.');
        
        // Si no existe el usuario
        if (!user) return res.send('Usuario no encontrado. <a href="/login.html">Volver</a>');

        // 2. Comparamos la contraseña escrita con el hash guardado
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.send('Contraseña incorrecta. <a href="/login.html">Volver</a>');
        }

        // 3. ¡Login exitoso! Creamos la sesión (la "pulsera VIP")
        req.session.userId = user.id;
        req.session.username = user.username;
        
        // Lo mandamos a su zona privada
        res.redirect('/mi-cuenta');
    });
});

// Ruta PROTEGIDA (Checklist: ¿Puedo acceder sin loguearme? ¡NO!)

// --- RUTAS DE MI PANEL (Dashboard) ---

// 1. Enviar la página HTML del panel (Protegida)
app.get('/mi-cuenta', protegerRuta, (req, res) => {
    // Usamos sendFile para enviarle un archivo HTML de verdad
    res.sendFile(path.join(__dirname, '../public/mi-cuenta.html'));
});

// 2. API que devuelve SOLO los productos que vende este usuario
app.get('/api/mis-productos', protegerRuta, (req, res) => {
    const query = `SELECT * FROM productos WHERE vendedor_id = ? ORDER BY id DESC`;
    
    db.all(query, [req.session.userId], (err, filas) => {
        if (err) return res.status(500).json({ error: 'Error al buscar tus productos' });
        res.json(filas);
    });
});

// 3. API que devuelve el historial de COMPRAS de este usuario
app.get('/api/mis-compras', protegerRuta, (req, res) => {
    // Cruzamos las tablas "pedidos" y "productos" para saber el nombre y precio de lo que compró
    const query = `
        SELECT p.nombre, p.precio, ped.fecha 
        FROM pedidos ped 
        JOIN productos p ON ped.producto_id = p.id 
        WHERE ped.comprador_id = ? 
        ORDER BY ped.fecha DESC
    `;
    
    db.all(query, [req.session.userId], (err, filas) => {
        if (err) return res.status(500).json({ error: 'Error al buscar tus compras' });
        res.json(filas);
    });
});

// Ruta para CERRAR SESIÓN
app.get('/api/logout', (req, res) => {
    req.session.destroy(); // Rompemos la pulsera VIP
    res.redirect('/login.html'); // Lo devolvemos al inicio
});

// --- MIDDLEWARE DE SEGURIDAD ---
// Esta función actúa como un guardia. La pondremos en las rutas que queramos proteger.
function protegerRuta(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).send('¡Alto ahí! 🛑 <a href="/login.html">Inicia sesión primero</a>');
    }
    next(); // Si tiene la sesión, le dejamos pasar a la ruta
}

// --- RUTAS DE PRODUCTOS ---

// Ruta para dar de alta un producto (Fíjate que le pasamos 'protegerRuta' en medio)
app.post('/api/productos', protegerRuta, (req, res) => {
    // 1. Recibimos los datos del formulario
    const { nombre, descripcion, precio } = req.body;
    
    // 2. Sacamos el ID del vendedor directamente de su sesión segura
    const vendedor_id = req.session.userId;

    // 3. Validación de datos en el servidor (Checklist)
    if (!nombre || !descripcion || !precio) {
        return res.send('Error: Todos los campos son obligatorios. <a href="/vender.html">Volver</a>');
    }

    if (Number(precio) <= 0) {
        return res.send('Error: El precio debe ser un número positivo. <a href="/vender.html">Volver</a>');
    }

    // 4. Guardamos en la base de datos
    const query = `INSERT INTO productos (vendedor_id, nombre, descripcion, precio) VALUES (?, ?, ?, ?)`;
    
    db.run(query, [vendedor_id, nombre, descripcion, precio], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Hubo un error al guardar el producto.');
        }
        
        // Si todo va bien, le mostramos un mensaje de éxito
        res.send(`
            <h2>¡Producto publicado con éxito! 🎉</h2>
            <p>Has publicado: <strong>${nombre}</strong> por ${precio}€</p>
            <a href="/vender.html">Publicar otro producto</a> | <a href="/mi-cuenta">Volver a mi panel</a>
        `);
    });
});


// --- RUTA DEL CATÁLOGO ---

// Ruta pública para ver todos los productos (Devuelve JSON)
app.get('/api/catalogo', (req, res) => {
    // Usamos un JOIN de SQL para unir la tabla productos con la tabla usuarios
    // Así podemos mostrar el nombre del vendedor en lugar de solo su ID
    const query = `
        SELECT p.id, p.nombre, p.descripcion, p.precio, u.username AS vendedor
        FROM productos p
        JOIN usuarios u ON p.vendedor_id = u.id
        ORDER BY p.id DESC -- Los más recientes primero
    `;
    
    db.all(query, [], (err, filas) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hubo un error al cargar los productos.' });
        }
        // Devolvemos la lista de productos en formato JSON
        res.json(filas);
    });
});



// --- RUTAS DEL CARRITO Y COMPRA ---

// 1. Añadir al carrito (usamos la sesión para guardar los IDs de los productos)
app.post('/api/carrito', protegerRuta, (req, res) => {
    const { producto_id } = req.body;
    
    // Si el usuario no tiene carrito en su sesión, le creamos un array vacío
    if (!req.session.carrito) {
        req.session.carrito = [];
    }
    
    // Añadimos el producto al carrito
    req.session.carrito.push(producto_id);
    
    // Respondemos con éxito y la cantidad de cosas que tiene
    res.json({ 
        mensaje: 'Añadido al carrito con éxito', 
        totalItems: req.session.carrito.length 
    });
});

// 2. Ver el carrito (Generamos el HTML directamente desde el servidor por rapidez)
app.get('/carrito', protegerRuta, (req, res) => {
    const carrito = req.session.carrito || [];
    
    if (carrito.length === 0) {
        return res.send(`
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
            <main class="container">
                <h2>Tu carrito está vacío 🛒</h2>
                <a href="/index.html" role="button">Volver al catálogo</a>
            </main>
        `);
    }

    // Si tiene productos, le mostramos el botón de pagar
    res.send(`
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
        <main class="container">
            <h2>Tu Carrito 🛒</h2>
            <p>Tienes <strong>${carrito.length}</strong> productos listos para comprar.</p>
            
            <form action="/api/comprar" method="POST">
                <button type="submit">Finalizar Compra</button>
            </form>
            <br>
            <a href="/index.html" class="secondary">Seguir comprando</a>
        </main>
    `);
});

// 3. Procesar la compra (Guardar en la Base de Datos)
app.post('/api/comprar', protegerRuta, (req, res) => {
    const carrito = req.session.carrito || [];
    if (carrito.length === 0) return res.send('No hay nada que comprar.');

    const comprador_id = req.session.userId;
    
    // Magia negra de SQL para insertar múltiples pedidos de golpe
    // Crea algo como: VALUES (?, ?), (?, ?)
    const placeholders = carrito.map(() => '(?, ?)').join(', ');
    const values = [];
    carrito.forEach(producto_id => {
        values.push(comprador_id, producto_id);
    });

    const query = `INSERT INTO pedidos (comprador_id, producto_id) VALUES ${placeholders}`;
    
    db.run(query, values, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al registrar la compra en la base de datos.');
        }
        
        // ¡Importante! Vaciamos el carrito de la sesión después de comprar
        req.session.carrito = [];
        
        res.send(`
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
            <main class="container">
                <h2>¡Compra completada con éxito! 🎉🛒</h2>
                <p>Tus pedidos han sido registrados y el vendedor ha sido notificado (simulado).</p>
                <a href="/index.html" role="button">Volver al catálogo</a>
            </main>
        `);
    });
});








// Encender el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});