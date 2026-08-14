const ADMIN_ORIGIN =
  process.env.ADMIN_ORIGIN || 'http://localhost:3001'

export const corsHeaders = {
  'Access-Control-Allow-Origin': ADMIN_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}