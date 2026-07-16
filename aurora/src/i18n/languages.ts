/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Only English and Traditional Chinese are offered. Simplified and the other
// upstream locales (fr/ru/ja/vi) are not exposed — the picker (and
// supportedLngs in config.ts) is restricted to the two we keep current.
// zh-TW.json is generated from the Simplified source via opencc, so fork-added
// pages are fully translated in Traditional too.
export const INTERFACE_LANGUAGE_OPTIONS = [
  { code: 'zhTW', label: '繁體中文' },
  { code: 'en', label: 'English' },
] as const

export type InterfaceLanguageCode =
  (typeof INTERFACE_LANGUAGE_OPTIONS)[number]['code']

export function normalizeInterfaceLanguage(value?: string | null): string {
  if (!value) return 'en'

  // Any Chinese variant (zh, zh-CN, zh-TW, zh-HK, zhTW, …) maps to zhTW,
  // the only Chinese option this fork offers.
  const normalized = value.trim().replace(/_/g, '-').toLowerCase()
  if (normalized.startsWith('zh')) return 'zhTW'

  return INTERFACE_LANGUAGE_OPTIONS.some((lang) => lang.code === normalized)
    ? normalized
    : 'en'
}

/**
 * Convert an interface language code into a valid BCP-47 locale tag the `Intl.*`
 * APIs accept. This fork uses `zhTW` as its Chinese code; `new Intl.*('zhTW')`
 * throws, so map it to `zh-TW`. Unknown values fall back to `undefined` so
 * `Intl` uses the runtime default locale.
 */
export function toIntlLocale(value?: string | null): string | undefined {
  if (!value) return undefined
  if (value === 'zhTW') return 'zh-TW'
  try {
    return Intl.getCanonicalLocales(value)[0]
  } catch {
    return undefined
  }
}
