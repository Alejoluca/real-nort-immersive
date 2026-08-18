FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
RUN mkdir -p data
ENV PORT=8787
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "src/index.js"]
