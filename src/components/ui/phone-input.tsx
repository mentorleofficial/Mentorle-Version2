import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
} from "@/features/mentee-onboarding/profileOptions";
import { cn } from "@/lib/utils";

const sortedCodes = [...COUNTRY_CODES].sort(
  (a, b) => b.dial.length - a.dial.length
);

function parsePhoneValue(value: string): { countryCode: string; number: string } {
  if (!value) return { countryCode: DEFAULT_COUNTRY_CODE, number: "" };

  if (value.startsWith("+")) {
    const match = sortedCodes.find((c) => value.startsWith(c.dial));
    if (match) {
      const rest = value.slice(match.dial.length).trim().replace(/\D/g, "");
      return { countryCode: match.code, number: rest };
    }
  }

  return { countryCode: DEFAULT_COUNTRY_CODE, number: value.replace(/\D/g, "") };
}

function getCountry(code: string) {
  return COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0];
}

interface PhoneInputProps {
  value: string;
  onChange: (combined: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  className,
}: PhoneInputProps) {
  const parsed = parsePhoneValue(value || "");
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [number, setNumber] = useState(parsed.number);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    const p = parsePhoneValue(value || "");
    setCountryCode(p.countryCode);
    setNumber(p.number);
  }, [value]);

  const emit = useCallback(
    (code: string, n: string) => {
      const country = getCountry(code);
      const combined = n ? `${country.dial} ${n}` : "";
      lastEmitted.current = combined;
      onChange(combined);
    },
    [onChange]
  );

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    const country = getCountry(newCode);
    const truncated = number.slice(0, country.maxDigits);
    setNumber(truncated);
    emit(newCode, truncated);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    const country = getCountry(countryCode);
    const clamped = digits.slice(0, country.maxDigits);
    setNumber(clamped);
    emit(countryCode, clamped);
  };

  const country = getCountry(countryCode);

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={countryCode}
        onValueChange={handleCountryChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[110px] flex-shrink-0">
          <SelectValue>
            {country.flag} {country.dial}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.dial})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="numeric"
        placeholder="Phone number"
        value={number}
        onChange={handleNumberChange}
        maxLength={country.maxDigits}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
