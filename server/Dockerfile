FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
RUN mkdir -p data
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["node", "src/index.js"]
