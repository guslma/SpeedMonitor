FROM oven/bun:1 AS client-build

WORKDIR /client
COPY ./client/package.json ./
RUN bun install
COPY ./client ./
RUN bun run build

FROM oven/bun:1 AS server-build

WORKDIR /app

COPY ./server /app/server
COPY ./scripts /app/scripts
COPY ./package.json /app/package.json

RUN bun install
RUN bun run generate-migrations
RUN bun run generate-integrations

FROM oven/bun:1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Etc/UTC

WORKDIR /app

COPY --from=server-build /app/server /app/server
COPY --from=server-build /app/package.json /app/package.json
COPY --from=server-build /app/node_modules /app/node_modules
COPY --from=client-build /client/build /app/build

VOLUME ["/app/data"]

EXPOSE 5216

CMD ["bun", "run", "server/index.js"]
