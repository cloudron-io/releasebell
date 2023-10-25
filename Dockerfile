FROM cloudron/base:4.2.0@sha256:46da2fffb36353ef714f97ae8e962bd2c212ca091108d768ba473078319a47f4

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD public /app/code/public
ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package-lock.json package.json index.html index.js start.sh vite.config.js /app/code/

RUN npm install && \
    npm run build && \
    rm -rf node_modules && \
    npm install --omit=dev && \
    npm cache clean --force

CMD [ "/app/code/start.sh" ]
