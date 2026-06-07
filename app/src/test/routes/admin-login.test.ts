import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyPassword: vi.fn(),
  createAdminSessionToken: vi.fn(),
}))

vi.mock('@/db', () => ({
  prisma: {
    admin: {
      findUnique: mocks.findUnique,
    },
  },
}))

vi.mock('@/lib/admin-auth', () => ({
  verifyPassword: mocks.verifyPassword,
  createAdminSessionToken: mocks.createAdminSessionToken,
}))

import { adminLoginHandlers } from '@/routes/api/admin/login/$'

describe('adminLoginHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when email or password is missing', async () => {
    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await adminLoginHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Email and password are required')
  })

  it('returns 401 for invalid credentials (admin not found)', async () => {
    mocks.findUnique.mockResolvedValueOnce(null)

    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@a.com', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await adminLoginHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Invalid credentials')
  })

  it('returns 401 when admin account is inactive', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      password: 'hashed',
      isActive: false,
    })

    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'secret' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await adminLoginHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Account is inactive')
  })

  it('returns 401 when password is incorrect', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      password: 'hashed',
      isActive: true,
    })
    mocks.verifyPassword.mockResolvedValueOnce(false)

    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'wrong-pass' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await adminLoginHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Invalid credentials')
  })

  it('returns 200 with token on success', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      password: 'hashed',
      isActive: true,
    })
    mocks.verifyPassword.mockResolvedValueOnce(true)
    mocks.createAdminSessionToken.mockResolvedValueOnce('token-123')

    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'secret' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await adminLoginHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.token).toBe('token-123')
    expect(body.admin.email).toBe('admin@test.com')

    // Same-origin session: an HttpOnly admin_session cookie must be set so the
    // /admin route loader (which reads the cookie) can authenticate navigations.
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('admin_session=token-123')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('OPTIONS returns CORS headers', async () => {
    const response = await adminLoginHandlers.OPTIONS()

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5051')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })
})
