#!/bin/bash
# Конфиг pgbouncer собирается из переменных окружения (см. docker-compose.yml).
set -e

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=5432}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:=postgres}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${POOL_MODE:=transaction}"
: "${MAX_CLIENT_CONN:=1000}"
: "${DEFAULT_POOL_SIZE:=25}"

cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
${DB_NAME} = host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = ${POOL_MODE}
max_client_conn = ${MAX_CLIENT_CONN}
default_pool_size = ${DEFAULT_POOL_SIZE}
server_reset_query = DISCARD ALL
log_connections = 0
log_disconnections = 0
EOF

cat > /etc/pgbouncer/userlist.txt <<EOF
"${DB_USER}" "${DB_PASSWORD}"
EOF

exec "$(command -v pgbouncer)" /etc/pgbouncer/pgbouncer.ini
