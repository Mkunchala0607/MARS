function required(name, fallback) {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Missing required environment variable ${name}`)
  return v
}

const env = process.env.NODE_ENV || 'development'

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', env === 'test' ? 'postgres://postgres:postgres@127.0.0.1:5499/postgres' : undefined),
  dbPoolMax: Number(process.env.DB_POOL_MAX || 10),
  // In production JWT_SECRET must be set explicitly; dev/test get a throwaway value.
  jwtSecret: env === 'production' ? required('JWT_SECRET') : process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRememberExpiresIn: '30d',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        from: process.env.SMTP_FROM || 'GPMS <no-reply@mars.local>',
      }
    : null,
}
