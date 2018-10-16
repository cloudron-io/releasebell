FROM cloudron/base:1.0.0@sha256:147a648a068a2e746644746bbfb42eb7a50d682437cead3c67c933c546357617

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package.json index.js start.sh /app/code/

RUN npm install --production

CMD [ "/app/code/start.sh" ]
