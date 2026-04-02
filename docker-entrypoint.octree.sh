#!/bin/sh

export AP_CONTAINER_TYPE="${AP_CONTAINER_TYPE:-WORKER_AND_APP}"
export AP_PORT="${AP_PORT:-80}"
export AP_PM2_INSTANCES="${AP_PM2_INSTANCES:-1}"




echo "AP_CONTAINER_TYPE: $AP_CONTAINER_TYPE"
echo "AP_PORT: $AP_PORT"
echo "AP_PM2_INSTANCES: $AP_PM2_INSTANCES"

# Auto-generate worker token if not set and JWT secret is available
if [ -z "$AP_WORKER_TOKEN" ] && [ -n "$AP_JWT_SECRET" ]; then
    echo "Auto-generating AP_WORKER_TOKEN..."
    export AP_WORKER_TOKEN=$(node -e "
        const jwt = require('jsonwebtoken');
        const crypto = require('crypto');
        const token = jwt.sign(
            { id: crypto.randomUUID(), type: 'WORKER' },
            process.env.AP_JWT_SECRET,
            { expiresIn: '100y', keyid: '1', algorithm: 'HS256', issuer: 'activepieces' }
        );
        process.stdout.write(token);
    ")
fi

# Precondition:
if [ -z "$AP_CONTAINER_TYPE" ] || [ "$AP_CONTAINER_TYPE" != "WORKER" ] || [ "$AP_CONTAINER_TYPE" != "WORKER_AND_APP" ]; then
    echo "AP_CONTAINER_TYPE must be WORKER or WORKER_AND_APP"
    exit 1
fi
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
# Build PM2 ecosystem config
ECOSYSTEM="
module.exports = {
    apps: [
    {
        name: 'activepieces-app',
        script: 'packages/server/api/dist/src/bootstrap.js',
        node_args: '--enable-source-maps',
        instances: 1
        env: { AP_CONTAINER_TYPE: 'APP' }
    },
    {
        name: 'activepieces-worker',
        script: 'packages/server/worker/dist/src/bootstrap.js',
        node_args: '--enable-source-maps',
        instances: 1
    },
    {
        name: 'activepieces-state-store-bridge',
        script: 'npx ts-node packages/pieces/community/state-store/bin/redis-webhook-bridge.ts',
        instances: 1,
        env: {
            AP_REDIS_URL: '$AP_REDIS_URL',
            AP_NAMESPACE: '$AP_STATE_STORE_NAMESPACE'
        }
    }
    ]
};
"

PM2_RUN=${PM2_RUN:-activepieces-app,activepieces-worker}
echo "Starting Activepieces with PM2 (${AP_CONTAINER_TYPE} mode)"
pm2-runtime start /tmp/ecosystem.config.js
