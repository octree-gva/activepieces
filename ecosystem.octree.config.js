module.exports = {
  apps: [
    {
      name: 'activepieces-state-store-bridge',
      script: 'packages/pieces/community/state-store/bin/redis-webhook-bridge.ts',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'ts-node',
      kill_timeout: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      combine_logs: true,
      merge_logs: true,
      time: true,
      out_file: '/var/log/run.log',
      error_file: '/var/log/run.log',
    },
  ],
};
