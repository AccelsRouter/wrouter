/*
Default GeoBlock families. Stays in sync with backend defaults in
setting/system_setting/geo_block.go (frontend defaults are fallback only
when the backend hasn't persisted a value yet).
*/
import type { GeoBlockFamily, GeoBlockPageSettings } from './types'

export const DEFAULT_FAMILIES: GeoBlockFamily[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    prefixes: [
      'gpt-',
      'o1-',
      'o3-',
      'o4-',
      'chatgpt-',
      'text-embedding-',
      'dall-e-',
      'tts-',
      'whisper-',
    ],
    blocked_countries: ['CN', 'HK'],
  },
  {
    key: 'claude',
    label: 'Anthropic Claude',
    prefixes: ['claude-'],
    blocked_countries: ['CN', 'HK'],
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    prefixes: ['gemini-', 'imagen-', 'veo-'],
    blocked_countries: ['CN', 'HK'],
  },
  {
    key: 'grok',
    label: 'xAI Grok',
    prefixes: ['grok-'],
    blocked_countries: ['CN', 'HK'],
  },
]

export const DEFAULT_GEO_BLOCK_SETTINGS: GeoBlockPageSettings = {
  'geo_block.enabled': false,
  'geo_block.families': JSON.stringify(DEFAULT_FAMILIES),
}
