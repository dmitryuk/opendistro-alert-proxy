FROM node:25.2.1-alpine3.22
WORKDIR /app

CMD ["node", "app.ts"]
COPY ./src /app

EXPOSE 80
