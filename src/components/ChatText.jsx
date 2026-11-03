import { splitChatText } from '../lib/chatText'

export default function ChatText({ text, staff = false }) {
  const parts = splitChatText(text)
  if (parts.length === 0) return null
  return (
    <p className="break-words whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 hover:no-underline ${
              staff ? 'decoration-white/60' : 'decoration-black/30'
            }`}
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </p>
  )
}
