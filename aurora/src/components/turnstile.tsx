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
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  /**
   * Increment this to force the widget to issue a fresh single-use token.
   * Turnstile tokens are one-time; after each protected request the caller
   * must reset the widget or Cloudflare rejects the reused token with
   * `timeout-or-duplicate`.
   */
  resetSignal?: number
  className?: string
}

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  resetSignal,
  className,
}: TurnstileProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  // Keep callbacks in refs so the render effect stays stable (only depends on
  // siteKey) and never re-renders the widget on every parent re-render.
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  onVerifyRef.current = onVerify
  onExpireRef.current = onExpire

  useEffect(() => {
    let cancelled = false

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return
      if (widgetIdRef.current) return
      try {
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerifyRef.current(token),
          'error-callback': () => onExpireRef.current?.(),
          'expired-callback': () => onExpireRef.current?.(),
        })
      } catch {
        /* empty */
      }
    }

    if (window.turnstile) {
      render()
    } else {
      const scriptId = 'cf-turnstile'
      let script = document.getElementById(
        scriptId
      ) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      // Attach to load even if the script element already exists (a second
      // widget mounting while the shared script is still loading).
      script.addEventListener('load', render)
    }

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* empty */
        }
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  // Reset the widget on demand to obtain a fresh single-use token. Skip the
  // initial mount (nothing consumed yet).
  const isFirstReset = useRef(true)
  useEffect(() => {
    if (isFirstReset.current) {
      isFirstReset.current = false
      return
    }
    if (widgetIdRef.current && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch {
        /* empty */
      }
    }
  }, [resetSignal])

  return <div ref={ref} className={className} />
}
