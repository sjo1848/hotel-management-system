FROM rust:latest

RUN apt-get update && apt-get install -y libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*
RUN pkg-config --version # Diagnóstico: Verifica si pkg-config está instalado
RUN cargo install cargo-watch

WORKDIR /app
COPY Cargo.toml .
CMD ["cargo", "watch", "-x", "run"]
