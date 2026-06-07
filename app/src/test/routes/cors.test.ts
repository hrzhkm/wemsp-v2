import { describe, expect, it } from 'vitest'
import { corsHeaders } from '@/lib/cors'

describe('corsHeaders', () => {
  it('includes required CORS keys', () => {
    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('http://localhost:3001')
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('OPTIONS')
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Authorization')
    expect(corsHeaders['Access-Control-Allow-Credentials']).toBe('true')
  })
})
