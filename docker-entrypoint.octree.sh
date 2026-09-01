#!/bin/sh

export AP_CONTAINER_TYPE="${AP_CONTAINER_TYPE:-WORKER_AND_APP}"
export AP_PORT="${AP_PORT:-80}"
export AP_PM2_INSTANCES="${AP_PM2_INSTANCES:-1}"
export PM2_LOG_ROTATE_MAX_SIZE="${PM2_LOG_ROTATE_MAX_SIZE:-10M}"
export PM2_LOG_ROTATE_RETAIN="${PM2_LOG_ROTATE_RETAIN:-30}"
export HOME=${HOME:-$ROOT}
export AP_PORT=${AP_PORT:-80}

echo "AP_CONTAINER_TYPE: $AP_CONTAINER_TYPE"
echo "AP_PORT: $AP_PORT"
echo "AP_PM2_INSTANCES: $AP_PM2_INSTANCES"

# Auto-generate worker token if not set and JWT secret is available.
# Must match packages/server/api jwt-utils (HS256, issuer activepieces, kid 1) and the same AP_JWT_SECRET the API uses.
# If you set AP_WORKER_TOKEN yourself, it must be a JWT signed with the current AP_JWT_SECRET (not from an old deploy).
if [ -z "$AP_WORKER_TOKEN" ] && [ -n "$AP_JWT_SECRET" ]; then
    echo "Auto-generating AP_WORKER_TOKEN..."
    export AP_WORKER_TOKEN=$(node -e "
        const jwt = require('jsonwebtoken');
        const crypto = require('crypto');
        const secret = String(process.env.AP_JWT_SECRET || '').trim();
        const expiresInSeconds = Math.floor(100 * 365.25 * 24 * 60 * 60);
        const token = jwt.sign(
            { id: crypto.randomUUID(), type: 'WORKER' },
            secret,
            { expiresIn: expiresInSeconds, keyid: '1', algorithm: 'HS256', issuer: 'activepieces' }
        );
        process.stdout.write(token);
    ")
fi

# Precondition:
if [ -z "$AP_REDIS_URL" ]; then
    echo "AP_REDIS_URL must be set"
    exit 1
fi
if [ -z "$AP_STATE_STORE_NAMESPACE" ]; then
    echo "AP_STATE_STORE_NAMESPACE must be set"
    exit 1
fi
if [ -z "$AP_JWT_SECRET" ]; then
    echo "AP_JWT_SECRET must be set"
    exit 1
fi
if [ -z "$AP_WORKER_TOKEN" ]; then
    echo "AP_WORKER_TOKEN must be set"
    exit 1
fi

# Postgres: wait-on TCP. Redis: 3x PING, 3s sleep between failures. AP_SKIP_WAIT_FOR_DEPS=1 skips both.
WAIT_MS=120000
if [ -n "${AP_POSTGRES_HOST:-}" ]; then
    echo "wait-on -t ${WAIT_MS} tcp:${AP_POSTGRES_HOST}:${AP_POSTGRES_PORT:-5432}"
    wait-on -t "$WAIT_MS" "tcp:${AP_POSTGRES_HOST}:${AP_POSTGRES_PORT:-5432}"
fi
if [ -n "${AP_REDIS_URL:-}" ]; then
  if redis-cli -u "$AP_REDIS_URL" PING 2>/dev/null | grep -q PONG; then
    echo "Redis Ready"
  else
    sleep 3
    if redis-cli -u "$AP_REDIS_URL" PING 2>/dev/null | grep -q PONG; then
      echo "Redis Ready"
    else
      echo "Redis Not Ready"
      exit 1
    fi
  fi
fi

# Worker health HTTP binds AP_PORT; PM2 increment_var gives each worker a distinct port. Base = API port + 1 so workers do not collide with the app.
AP_WORKER_HEALTH_PORT_BASE=$((AP_PORT + 1))

# Worker processes use AP_FRONTEND_URL for Socket.IO to the API. The public AP_FRONTEND_URL (browser / Traefik host:port) is often wrong inside the container — use the API listen address unless the operator overrides (e.g. external worker container).
AP_WORKER_FRONTEND_URL="${AP_WORKER_FRONTEND_URL:-http://127.0.0.1:${AP_PORT}}"

# Build PM2 ecosystem config
echo "
module.exports = {
    apps: [
    {
        name: 'activepieces-app',
        script: 'packages/server/api/dist/src/bootstrap.js',
        node_args: '--enable-source-maps',
        exec_mode: 'fork',
        instances: 1,
        env: { AP_CONTAINER_TYPE: 'APP' },
        kill_timeout: 3000,
        min_uptime: '10s',
        restart_delay: 5000,
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        combine_logs: true,
        merge_logs: true,
        time: true,
        out_file: '/var/log/run.log',
        error_file: '/var/log/run.log',
    },
    {
        name: 'activepieces-worker',
        script: 'packages/server/worker/dist/src/bootstrap.js',
        node_args: '--enable-source-maps',
        exec_mode: 'fork',
        env: { AP_CONTAINER_TYPE: 'WORKER', AP_PORT: '${AP_WORKER_HEALTH_PORT_BASE}', AP_FRONTEND_URL: '${AP_WORKER_FRONTEND_URL}' },
        increment_var: 'AP_PORT',
        instances: 3,
        kill_timeout: 3000,
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        combine_logs: true,
        merge_logs: true,
        time: true,
        out_file: '/var/log/run.log',
        error_file: '/var/log/run.log',
    },
    {
        name: 'activepieces-state-store-bridge',
        ...require('./ecosystem.octree.config.js').apps[0],
    }
    ]
};
" > /tmp/ecosystem.config.js

echo "Starting Activepieces with PM2 (${AP_CONTAINER_TYPE} mode)"

# Start PM2 daemon first (needed for pm2 commands to work)
pm2 ping || pm2 kill || true
pm2 ping || true

# Install and configure pm2-logrotate
if ! pm2 list 2>/dev/null | grep -q "pm2-logrotate" || [ ! -d "$HOME/.pm2/modules/pm2-logrotate" ]; then
  pm2 install pm2-logrotate || true
fi

# Configure pm2-logrotate
pm2 set pm2-logrotate:max_size "${PM2_LOG_ROTATE_MAX_SIZE}" || true
pm2 set pm2-logrotate:retain "${PM2_LOG_ROTATE_RETAIN}" || true
pm2 set pm2-logrotate:rotateInterval "0 0 * * *" || true
pm2 set pm2-logrotate:workerInterval 30 || true
pm2 set pm2-logrotate:compress true || true

pm2-runtime start /tmp/ecosystem.config.js


