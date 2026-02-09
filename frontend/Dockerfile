FROM node:20-alpine
WORKDIR /app
COPY package.json .
# Instalamos dependencias (si package.json existe, sino creará uno básico al iniciar si montamos volumen)
RUN npm install
CMD ["npm", "run", "dev", "--", "--host"]
