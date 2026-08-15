export const cleanAssetValue = (value: string) => value.replace(/,/g, '')

export const parsePositiveAssetValue = (value: string) => {
  const clean = cleanAssetValue(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null

  const number = Number(clean)
  return Number.isFinite(number) && number > 0 ? number : null
}
