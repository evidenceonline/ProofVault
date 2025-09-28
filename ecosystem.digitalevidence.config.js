module.exports = {
  apps: [
    {
      name: 'digitalevidence-backend',
      script: './server.js',
      cwd: '/home/nodeadmin/proofvault-digital-evidence/api',
      watch: false,
      env: {
        PORT: 4000,
        NODE_ENV: 'production'
      },
      env_development: {
        PORT: 4000,
        NODE_ENV: 'development'
      },
      instances: 1,
      exec_mode: 'fork',
      max_restarts: 10,
      restart_delay: 4000,
      autorestart: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/digitalevidence-backend-error.log',
      out_file: './logs/digitalevidence-backend-out.log',
      log_file: './logs/digitalevidence-backend-combined.log'
    },
    {
      name: 'digitalevidence-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/nodeadmin/proofvault-digital-evidence/frontend',
      watch: false,
      env: {
        PORT: 4002,
        NODE_ENV: 'development'
      },
      instances: 1,
      exec_mode: 'fork',
      max_restarts: 10,
      restart_delay: 4000,
      autorestart: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/digitalevidence-frontend-error.log',
      out_file: './logs/digitalevidence-frontend-out.log',
      log_file: './logs/digitalevidence-frontend-combined.log'
    }
  ]
};