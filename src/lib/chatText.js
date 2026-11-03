const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/

export function splitChatText(text) {
  const raw = String(text ?? '')
  if (!raw) return []

  const parts = []
  let cursor = 0

  for (const match of raw.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0
    const url = match[0].replace(TRAILING_PUNCTUATION, '')
    if (!url) continue
    if (index > cursor) parts.push({ type: 'text', value: raw.slice(cursor, index) })
    parts.push({
      type: 'link',
      value: url,
      href: url.toLowerCase().startsWith('www.') ? `https://${url}` : url,
    })
    cursor = index + url.length
  }

  if (cursor < raw.length) parts.push({ type: 'text', value: raw.slice(cursor) })
  return parts
}
