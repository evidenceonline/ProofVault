module.exports = {
  apps: [
    {
      name: 'proofvault-backend',
      script: './api/server.js',
      watch: true,
      env: {
        PORT: 4000,
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
        PORT: 4002,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'proofvault-business-site',
      cwd: './business-site',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3005,
        NODE_ENV: 'production'
      }
    }
  ]
};