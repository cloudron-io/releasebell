FROM cloudron/base:4.0.0@sha256:31b195ed0662bdb06a6e8a5ddbedb6f191ce92e8bee04c03fb02dd4e9d0286df

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD public /app/code/public
ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package-lock.json package.json index.html index.js start.sh vite.config.js /app/code/

RUN npm install && npm run build && rm -rf node_modules
RUN npm install --omit=dev

CMD [ "/app/code/start.sh" ]
