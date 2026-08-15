export const formatMalaysianIc = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 12)

  return [digits.slice(0, 6), digits.slice(6, 8), digits.slice(8)]
    .filter(Boolean)
    .join('-')
}
