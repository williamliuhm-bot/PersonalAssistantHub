FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:8000
ARG VITE_RATE_USD_RUB=90
ARG VITE_RATE_EUR_RUB=98
ARG VITE_RATE_GBP_RUB=115
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RATE_USD_RUB=$VITE_RATE_USD_RUB
ENV VITE_RATE_EUR_RUB=$VITE_RATE_EUR_RUB
ENV VITE_RATE_GBP_RUB=$VITE_RATE_GBP_RUB
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
