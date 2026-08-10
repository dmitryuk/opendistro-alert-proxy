FROM node:26-alpine
WORKDIR /app

COPY ./ /app
RUN npm ci

EXPOSE 80
CMD ["npm", "run", "start"]
