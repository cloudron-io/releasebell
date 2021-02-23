FROM cloudron/base:3.0.0@sha256:455c70428723e3a823198c57472785437eb6eab082e79b3ff04ea584faf46e92

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package.json index.js start.sh /app/code/

RUN npm install --production

CMD [ "/app/code/start.sh" ]
