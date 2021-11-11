FROM ghcr.io/biscuittin/node:14-impish AS builder
WORKDIR /opt/MetaNetwork/Worker-Git
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn run build
RUN npm prune --production

FROM ghcr.io/biscuittin/node:14-impish
WORKDIR /opt/MetaNetwork/Worker-Git
COPY --from=builder /opt/MetaNetwork/Worker-Git/dist ./dist
COPY --from=builder /opt/MetaNetwork/Worker-Git/node_modules ./node_modules
CMD ["--enable-source-maps","dist/main.js"]
