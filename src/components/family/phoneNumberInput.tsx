import { useMemo, useState } from 'react'
import type { CountryCode } from '@/lib/family/phoneNumber'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getCountries,
  getCountryCallingCode,
  splitPhoneNumber,
} from '@/lib/family/phoneNumber'

interface PhoneNumberInputProps {
  disabled?: boolean
  initialValue?: string | null
}

export function PhoneNumberInput({
  disabled,
  initialValue,
}: PhoneNumberInputProps) {
  const initial = splitPhoneNumber(initialValue)
  const [country, setCountry] = useState<CountryCode>(initial.country)
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    return getCountries()
      .map((code) => ({ code, name: names.of(code) || code }))
      .sort((a, b) =>
        a.code === 'MY'
          ? -1
          : b.code === 'MY'
            ? 1
            : a.name.localeCompare(b.name),
      )
  }, [])

  return (
    <div className="flex gap-2">
      <Select
        name="phoneCountry"
        value={country}
        onValueChange={(value) => setCountry(value as CountryCode)}
        disabled={disabled}
      >
        <SelectTrigger className="w-40" aria-label="Phone country">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {countries.map(({ code, name }) => (
            <SelectItem key={code} value={code}>
              {name} (+{getCountryCallingCode(code)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id="phoneNumber"
        name="phoneNumber"
        type="tel"
        inputMode="tel"
        defaultValue={initial.nationalNumber}
        placeholder="Phone number"
        disabled={disabled}
      />
    </div>
  )
}
