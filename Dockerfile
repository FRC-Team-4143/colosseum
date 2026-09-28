# Stage 1 — build the SvelteKit SPA.
FROM node:22-slim AS spa
WORKDIR /spa
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Cap the heap so the build survives the droplet's 1 GB (Vite, not webpack — this is plenty).
RUN NODE_OPTIONS=--max-old-space-size=768 npm run build

# Stage 2 — the FastAPI backend, serving /api/* and the built SPA.
FROM python:3.11-slim
WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app
COPY --from=spa /spa/build ./static

RUN mkdir -p /app/data && \
    useradd --create-home --uid 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005", "--proxy-headers", "--forwarded-allow-ips=*"]
