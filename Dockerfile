FROM node:lts-bullseye

ENV SEVENZIP_VERSION 2103

RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
  && case "${dpkgArch##*-}" in \
    amd64) ARCH='x64';; \
    arm64) ARCH='arm64';; \
    i386) ARCH='x86';; \
    *) echo "unsupported architecture"; exit 1 ;; \
  esac \
  && set -ex \
  && apt-get update\
  && apt-get -yf upgrade\
  && apt-get -yf autoremove\
  && apt-get clean\
  && curl -fLOSs "https://7-zip.org/a/7z$SEVENZIP_VERSION-linux-$ARCH.tar.xz"\
  && mkdir -p /opt/7z\
  && tar -xJf "7z$SEVENZIP_VERSION-linux-$ARCH.tar.xz" -C /opt/7z\
  && rm "7z$SEVENZIP_VERSION-linux-$ARCH.tar.xz"\
  && ln -s /opt/7z/7zz /usr/local/bin/7zz\
  && 7zz

WORKDIR /opt/MetaNetwork/Worker-Git
COPY . .
RUN yarn install --frozen-lockfile && yarn run build

ENV NODE_ENV production
CMD yarn run start:prod
