FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 make g++ pkgconfig pixman cairo-dev pango-dev giflib-dev jpeg-dev

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]