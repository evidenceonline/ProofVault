module.exports = {
  apps: [
    {
      name: 'proofvault-backend',
      script: './api/server.js',
      watch: true,
      env: {
        PORT: 3003,
        NODE_ENV: 'production'
      },
      ignore_watch: ['node_modules', 'logs', '.git']
    },
    {
      name: 'proofvault-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      }
    }
  ]
};