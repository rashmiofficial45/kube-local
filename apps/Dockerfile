FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files first (for Docker layer caching)
COPY package*.json ./

RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]