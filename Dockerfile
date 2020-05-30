FROM cloudron/base:2.0.0@sha256:f9fea80513aa7c92fe2e7bf3978b54c8ac5222f47a9a32a7f8833edf0eb5a4f4

RUN mkdir -p /app/code/
WORKDIR /app/code

RUN ln -s /run/database.json /app/code/database.json

ADD backend /app/code/backend
ADD frontend /app/code/frontend
ADD migrations /app/code/migrations
ADD package.json index.js start.sh /app/code/

RUN npm install --production

CMD [ "/app/code/start.sh" ]
