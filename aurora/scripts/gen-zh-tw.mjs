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

/*
Generate the Traditional Chinese locale (zh-TW.json) from the Simplified
source (zh.json) using OpenCC s2twp (Taiwan Traditional with phrase/vocab
conversion, e.g. 用户 -> 使用者, 软件 -> 軟體).

Simplified zh.json is the single source of truth for Chinese translations —
including fork-added pages. Run this after changing zh.json so the Traditional
locale stays in sync:

    bun run i18n:zhtw

Only translation *values* are converted; keys (English source strings) are
left untouched. The protected branding key is written in its escaped form to
match scripts/sync-i18n.mjs.

Run from the web/ package root (see package.json script).
*/
import fs from 'node:fs/promises'
import path from 'node:path'
import * as OpenCC from 'opencc-js'

const LOCALES_DIR = path.resolve('src/i18n/locales')
const SOURCE = path.join(LOCALES_DIR, 'zh.json')
const TARGET = path.join(LOCALES_DIR, 'zh-TW.json')

// Preserve the escaped serialization of the protected branding key, matching
// scripts/sync-i18n.mjs (keeps the identifier intact and non-trivially edited).
const OBFUSCATED_KEYS = [
  {
    runtime: ['footer', 'new' + 'api', 'projectAttributionSuffix'].join('.'),
    serialized: 'footer.new\\u0061pi.projectAttributionSuffix',
  },
]

const convert = OpenCC.Converter({ from: 'cn', to: 'twp' })

// Post-conversion vocabulary overrides. OpenCC twp produces Taiwan-standard
// terms; where our (HK/mainland-leaning) Traditional readers expect a
// different word, fix it up here. Applied to converted values only.
const VOCAB_OVERRIDES = [
  ['金鑰', '密鑰'], // cryptographic key: TW says 金鑰, our audience reads 密鑰
]

function applyOverrides(value) {
  let out = value
  for (const [from, to] of VOCAB_OVERRIDES) {
    out = out.replaceAll(from, to)
  }
  return out
}

const source = JSON.parse(await fs.readFile(SOURCE, 'utf8'))
const translation = source.translation ?? {}

const out = {}
for (const [key, value] of Object.entries(translation)) {
  out[key] = typeof value === 'string' ? applyOverrides(convert(value)) : value
}

let text = JSON.stringify({ translation: out }, null, 2)
for (const key of OBFUSCATED_KEYS) {
  text = text.replaceAll(`"${key.runtime}":`, `"${key.serialized}":`)
}
await fs.writeFile(TARGET, text + '\n', 'utf8')

console.log(
  `Generated zh-TW.json from zh.json via OpenCC s2twp: ${Object.keys(out).length} keys`
)
