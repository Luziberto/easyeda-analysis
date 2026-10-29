FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    sqlite3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
