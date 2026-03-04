# 1. Usamos un "ordenador" virtual que ya tiene Node.js instalado (versión ligera)
FROM node:20-alpine

# 2. Creamos una carpeta llamada /app dentro de ese ordenador virtual
WORKDIR /app

# 3. Copiamos los archivos de configuración de nuestro proyecto
COPY package*.json ./

# 4. Le decimos que instale las herramientas (Express, SQLite, etc.)
RUN npm install

# 5. Copiamos todo el resto de nuestro código (src, public, etc.)
COPY . .

# 6. Abrimos el puerto 3000 para que pueda conectarse a internet
EXPOSE 3000

# 7. La orden final para encender el servidor cuando el contenedor arranque
CMD ["node", "src/app.js"]