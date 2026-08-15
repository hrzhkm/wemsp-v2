export const formatMalaysianIc = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 12)

  return [digits.slice(0, 6), digits.slice(6, 8), digits.slice(8)]
    .filter(Boolean)
    .join('-')
}

export const normalizeMalaysianIc = (value: string) => value.replace(/\D/g, '')

export const isValidMalaysianIc = (value: string, today = new Date()) => {
  const ic = normalizeMalaysianIc(value)
  if (!/^\d{12}$/.test(ic)) return false

  const shortYear = Number(ic.slice(0, 2))
  const month = Number(ic.slice(2, 4))
  const day = Number(ic.slice(4, 6))
  const currentShortYear = today.getFullYear() % 100
  const year =
    shortYear <= currentShortYear ? 2000 + shortYear : 1900 + shortYear
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date <=
      new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  )
}
