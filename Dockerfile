FROM node:lts-bullseye

RUN apt-get update\
    && apt-get -yf upgrade\
    && apt-get -yf autoremove\
    && apt-get clean

WORKDIR /opt/MetaNetwork/Worker-Git
COPY . .
RUN yarn install --frozen-lockfile && yarn run build

# ENV NODE_ENV production
# CMD yarn run start:prod
CMD yarn run start:debug
