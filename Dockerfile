# Imagen base con Node.js y Playwright preinstalado
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos al contenedor
COPY . .

# Instalar dependencias de Node.js
RUN npm install

# Exponer el puerto que usa Railway
EXPOSE 3000

# Comando para iniciar tu servidor
CMD ["node", "server.js"]
