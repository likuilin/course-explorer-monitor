FROM node:latest
MAINTAINER kuilin@gmail.com

COPY . /home/srv/app
WORKDIR /home/srv/app
RUN yarn

RUN useradd srv
RUN chown -R srv:srv /home/srv
USER srv

CMD node coursemon.js
