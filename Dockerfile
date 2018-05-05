FROM cloudron/base:0.10.0

ENV PATH /usr/local/node-6.9.5/bin:$PATH

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package.json index.js start.sh /app/code/

RUN npm install --production

CMD [ "/app/code/start.sh" ]
