FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production

CMD ["node", "-r", "tsconfig-paths/register", "./dist/index.js"]