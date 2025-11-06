# Multi-stage build para Node.js backend
# Stage 1: Build dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluyendo devDependencies para build)
RUN npm ci

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /app

# Instalar dumb-init para manejar señales correctamente
RUN apk add --no-cache dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar node_modules desde builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copiar solo los archivos de producción
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs src ./src

# Cambiar al usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Usar dumb-init para manejar correctamente las señales
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Comando por defecto
CMD ["node", "src/server.js"]
