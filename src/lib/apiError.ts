export async function getApiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown
  } | null
  return typeof body?.error === 'string' ? body.error : fallback
}
