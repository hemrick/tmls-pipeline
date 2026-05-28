# syntax=docker/dockerfile:1
FROM python:3.12-slim

# Bring in the uv binary from the official Astral image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first for better layer caching.
# --frozen requires uv.lock to exist (generate it locally with `uv sync`).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Then copy the application code.
COPY app ./app
COPY documentations ./documentations

# Use the virtualenv uv created.
ENV PATH="/app/.venv/bin:$PATH"
# Cloud Run injects PORT (8080); default it for local `docker run`.
ENV PORT=8080

# Shell form so ${PORT} is expanded at runtime. Listen on all interfaces.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
