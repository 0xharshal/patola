# Production image: builds the static site, runs the tests, serves it with nginx.
#   podman build --build-arg NODE_VERSION="$(cat .node-version)" -t patola-playground -f Containerfile .
#   podman run --rm -p 8080:80 patola-playground   # http://localhost:8080
ARG NODE_VERSION=24
FROM docker.io/library/node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

FROM docker.io/library/nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
