FROM cloudron/base:5.0.0@sha256:04fd70dbd8ad6149c19de39e35718e024417c3e01dc9c6637eaf4a41ec4e596c

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD public /app/code/public
ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package-lock.json package.json index.html index.js start.sh vite.config.js /app/code/

RUN npm install --no-update-notifier && \
    npm run build && \
    rm -rf node_modules && \
    npm install --omit=dev && \
    npm cache clean --force

CMD [ "/app/code/start.sh" ]
