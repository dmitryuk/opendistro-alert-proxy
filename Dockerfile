FROM node:25.2.1-alpine3.22
WORKDIR /app

COPY ./ /app
RUN npm ci

EXPOSE 80
CMD ["npm", "run", "start"]
