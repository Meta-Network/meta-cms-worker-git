FROM ghcr.io/biscuittin/node:14-impish AS builder
WORKDIR /opt/MetaNetwork/Worker-Git
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn run build
RUN npm prune --production

FROM ghcr.io/biscuittin/node:14-impish
ENV SEVENZIP_VERSION=2103
RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
  && case "${dpkgArch##*-}" in \
    amd64) ARCH='x64';; \
    arm64) ARCH='arm64';; \
    i386) ARCH='x86';; \
    *) echo "unsupported architecture"; exit 1 ;; \
  esac \
  && set -ex \
  && curl -fLOSs "https://7-zip.org/a/7z$SEVENZIP_VERSION-linux-$ARCH.tar.xz" \
  && mkdir -p /opt/7z \
  && tar -xJf "7z$SEVENZIP_VERSION-linux-$ARCH.tar.xz" -C /opt/7z \
  && rm "7z$SEVENZIP_VERSION-linux-$ARCH.tar.xz" \
  && ln -s /opt/7z/7zz /usr/local/bin/7zz \
  && 7zz
WORKDIR /opt/MetaNetwork/Worker-Git
COPY --from=builder /opt/MetaNetwork/Worker-Git/dist ./dist
COPY --from=builder /opt/MetaNetwork/Worker-Git/node_modules ./node_modules
CMD ["--enable-source-maps","dist/main.js"]
