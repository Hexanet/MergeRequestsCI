FROM node:9

EXPOSE 3000

COPY . /home/node/app/
WORKDIR /home/node/app

RUN npm install

CMD node_modules/.bin/serve -f app/assets/favicon.ico public/