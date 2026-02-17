export type CountryOption = {
  iso2: string;
  name: string;
  flag: string;
  ddi: string;
  phoneNationalMask: string;
  phoneNationalPlaceholder: string;
};

export const COUNTRIES: CountryOption[] = [
  { iso2: "AR", name: "Argentina", flag: "🇦🇷", ddi: "+54", phoneNationalMask: "(##) ####-####", phoneNationalPlaceholder: "(11) 1234-5678" },
  { iso2: "AU", name: "Australia", flag: "🇦🇺", ddi: "+61", phoneNationalMask: "#### ### ###", phoneNationalPlaceholder: "0412 345 678" },
  { iso2: "BE", name: "Belgium", flag: "🇧🇪", ddi: "+32", phoneNationalMask: "### ## ## ##", phoneNationalPlaceholder: "470 12 34 56" },
  { iso2: "BR", name: "Brasil", flag: "🇧🇷", ddi: "+55", phoneNationalMask: "(##) #####-####", phoneNationalPlaceholder: "(11) 98888-7777" },
  { iso2: "CA", name: "Canada", flag: "🇨🇦", ddi: "+1", phoneNationalMask: "(###) ###-####", phoneNationalPlaceholder: "(604) 555-1234" },
  { iso2: "CH", name: "Switzerland", flag: "🇨🇭", ddi: "+41", phoneNationalMask: "## ### ## ##", phoneNationalPlaceholder: "78 123 45 67" },
  { iso2: "CL", name: "Chile", flag: "🇨🇱", ddi: "+56", phoneNationalMask: "# #### ####", phoneNationalPlaceholder: "9 6123 4567" },
  { iso2: "CN", name: "China", flag: "🇨🇳", ddi: "+86", phoneNationalMask: "### #### ####", phoneNationalPlaceholder: "131 2345 6789" },
  { iso2: "CO", name: "Colombia", flag: "🇨🇴", ddi: "+57", phoneNationalMask: "### #######", phoneNationalPlaceholder: "321 1234567" },
  { iso2: "DE", name: "Germany", flag: "🇩🇪", ddi: "+49", phoneNationalMask: "#### ########", phoneNationalPlaceholder: "1512 3456789" },
  { iso2: "DK", name: "Denmark", flag: "🇩🇰", ddi: "+45", phoneNationalMask: "## ## ## ##", phoneNationalPlaceholder: "20 12 34 56" },
  { iso2: "ES", name: "Spain", flag: "🇪🇸", ddi: "+34", phoneNationalMask: "### ## ## ##", phoneNationalPlaceholder: "612 34 56 78" },
  { iso2: "FR", name: "France", flag: "🇫🇷", ddi: "+33", phoneNationalMask: "# ## ## ## ##", phoneNationalPlaceholder: "6 12 34 56 78" },
  { iso2: "GB", name: "United Kingdom", flag: "🇬🇧", ddi: "+44", phoneNationalMask: "#### ######", phoneNationalPlaceholder: "7400 123456" },
  { iso2: "IE", name: "Ireland", flag: "🇮🇪", ddi: "+353", phoneNationalMask: "## ### ####", phoneNationalPlaceholder: "85 123 4567" },
  { iso2: "IN", name: "India", flag: "🇮🇳", ddi: "+91", phoneNationalMask: "##### #####", phoneNationalPlaceholder: "98765 43210" },
  { iso2: "IT", name: "Italy", flag: "🇮🇹", ddi: "+39", phoneNationalMask: "### ### ####", phoneNationalPlaceholder: "312 345 6789" },
  { iso2: "JP", name: "Japan", flag: "🇯🇵", ddi: "+81", phoneNationalMask: "## #### ####", phoneNationalPlaceholder: "90 1234 5678" },
  { iso2: "KR", name: "South Korea", flag: "🇰🇷", ddi: "+82", phoneNationalMask: "## #### ####", phoneNationalPlaceholder: "10 1234 5678" },
  { iso2: "MX", name: "Mexico", flag: "🇲🇽", ddi: "+52", phoneNationalMask: "## #### ####", phoneNationalPlaceholder: "55 1234 5678" },
  { iso2: "NL", name: "Netherlands", flag: "🇳🇱", ddi: "+31", phoneNationalMask: "# ########", phoneNationalPlaceholder: "6 12345678" },
  { iso2: "NO", name: "Norway", flag: "🇳🇴", ddi: "+47", phoneNationalMask: "### ## ###", phoneNationalPlaceholder: "406 12 345" },
  { iso2: "NZ", name: "New Zealand", flag: "🇳🇿", ddi: "+64", phoneNationalMask: "## ### ####", phoneNationalPlaceholder: "21 123 4567" },
  { iso2: "PE", name: "Peru", flag: "🇵🇪", ddi: "+51", phoneNationalMask: "### ### ###", phoneNationalPlaceholder: "912 345 678" },
  { iso2: "PT", name: "Portugal", flag: "🇵🇹", ddi: "+351", phoneNationalMask: "### ### ###", phoneNationalPlaceholder: "912 345 678" },
  { iso2: "PY", name: "Paraguay", flag: "🇵🇾", ddi: "+595", phoneNationalMask: "### ######", phoneNationalPlaceholder: "981 123456" },
  { iso2: "SE", name: "Sweden", flag: "🇸🇪", ddi: "+46", phoneNationalMask: "## ### ## ##", phoneNationalPlaceholder: "70 123 45 67" },
  { iso2: "US", name: "United States", flag: "🇺🇸", ddi: "+1", phoneNationalMask: "(###) ###-####", phoneNationalPlaceholder: "(201) 555-0123" },
  { iso2: "UY", name: "Uruguay", flag: "🇺🇾", ddi: "+598", phoneNationalMask: "## ### ###", phoneNationalPlaceholder: "94 123 456" }
];

export function countryDisplay(option: CountryOption) {
  return `${option.flag} ${option.name}`;
}

export function resolveCountryIso2(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const byNameOrDisplay = COUNTRIES.find(
    (country) =>
      country.name.toLowerCase() === normalized || countryDisplay(country).toLowerCase() === normalized
  );
  if (byNameOrDisplay) {
    return byNameOrDisplay.iso2;
  }

  if (normalized.length === 2) {
    const byIso2 = COUNTRIES.find((country) => country.iso2.toLowerCase() === normalized);
    return byIso2?.iso2 ?? null;
  }

  return null;
}

export function countryDisplayFromIso2(iso2: string) {
  const country = COUNTRIES.find((item) => item.iso2 === iso2.toUpperCase());
  return country ? countryDisplay(country) : iso2.toUpperCase();
}

export function phonePlaceholderByCountryIso2(iso2: string) {
  const country = COUNTRIES.find((item) => item.iso2 === iso2.toUpperCase());
  return country?.phoneNationalPlaceholder ?? "11988887777";
}

export function countryDdiByIso2(iso2: string) {
  const country = COUNTRIES.find((item) => item.iso2 === iso2.toUpperCase());
  return country?.ddi ?? "";
}

export function countryFlagSvgUrlByIso2(iso2: string) {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

export function phoneMaskByCountryIso2(iso2: string) {
  const country = COUNTRIES.find((item) => item.iso2 === iso2.toUpperCase());
  return country?.phoneNationalMask ?? "###############";
}

export function maxPhoneDigitsByCountryIso2(iso2: string) {
  return (phoneMaskByCountryIso2(iso2).match(/#/g) ?? []).length;
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function applyMask(rawValue: string, mask: string) {
  const digits = digitsOnly(rawValue);
  const maxDigits = (mask.match(/#/g) ?? []).length;
  const limitedDigits = digits.slice(0, maxDigits);
  if (limitedDigits.length === 0) return "";

  const firstPlaceholderIndex = mask.indexOf("#");
  let result = "";
  let digitIndex = 0;

  for (const [index, char] of Array.from(mask).entries()) {
    if (char === "#") {
      if (digitIndex >= limitedDigits.length) break;
      result += limitedDigits[digitIndex];
      digitIndex += 1;
      continue;
    }

    // Keep literal prefix (like "(") once user starts typing.
    if (digitIndex > 0 || index < firstPlaceholderIndex) {
      result += char;
    }
  }

  return result;
}

export function formatNationalPhoneByCountryIso2(rawValue: string, iso2: string) {
  const country = COUNTRIES.find((item) => item.iso2 === iso2.toUpperCase());
  if (!country) return digitsOnly(rawValue);
  return applyMask(rawValue, country.phoneNationalMask);
}

export function nationalDigitsFromE164(phoneE164: string, iso2: string) {
  const allDigits = digitsOnly(phoneE164);
  const ddiDigits = digitsOnly(countryDdiByIso2(iso2));
  if (ddiDigits && allDigits.startsWith(ddiDigits)) {
    return allDigits.slice(ddiDigits.length);
  }
  return allDigits;
}

export function formatLeadPhoneForDisplay(phoneE164: string, iso2: string) {
  const upperIso2 = iso2.toUpperCase();
  const ddi = countryDdiByIso2(upperIso2);
  if (!ddi) return phoneE164;
  const nationalDigits = nationalDigitsFromE164(phoneE164, upperIso2);
  const maskedNational = formatNationalPhoneByCountryIso2(nationalDigits, upperIso2);
  if (!maskedNational) return phoneE164;
  return `${ddi} ${maskedNational}`;
}

export function countDigitsBeforeCaret(value: string, caret: number) {
  return (value.slice(0, caret).match(/\d/g) ?? []).length;
}

export function caretFromDigitIndex(maskedValue: string, digitIndex: number) {
  if (digitIndex <= 0) return 0;
  let digitsSeen = 0;
  for (let i = 0; i < maskedValue.length; i += 1) {
    if (/\d/.test(maskedValue[i])) {
      digitsSeen += 1;
      if (digitsSeen === digitIndex) {
        return i + 1;
      }
    }
  }
  return maskedValue.length;
}

export function removeDigitAtIndex(rawDigits: string, index: number) {
  if (index < 0 || index >= rawDigits.length) return rawDigits;
  return rawDigits.slice(0, index) + rawDigits.slice(index + 1);
}
