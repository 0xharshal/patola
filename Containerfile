# Production image: builds the static site, runs the tests, serves it with nginx.
#   podman build -t patola-playground -f Containerfile .
#   podman run --rm -p 8080:80 patola-playground   # http://localhost:8080
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

FROM docker.io/library/nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
