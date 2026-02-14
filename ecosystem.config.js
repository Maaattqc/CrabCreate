module.exports = {
  apps: [{
    name: 'kanban-ai',
    script: 'server/index.ts',
    interpreter: 'node_modules/.bin/tsx',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
