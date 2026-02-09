# ANTES: FROM rust:1.76-slim
# AHORA:
FROM rust:latest

# El resto queda igual...
RUN apt-get update && apt-get install -y libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-watch

WORKDIR /app
COPY Cargo.toml .
CMD ["cargo", "watch", "-x", "run"]
