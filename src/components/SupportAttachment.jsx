import { useEffect, useState } from 'react'
import { attachmentUrl, formatBytes, isImageType } from '../lib/supportFiles'

function IconPaperclip({ className = '' }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function IconDownload({ className = '' }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

export default function SupportAttachment({ message, onBlue = false }) {
  const path = message?.attachment_path
  const pending = message?.attachment_pending === true
  const name = message?.attachment_name || 'Attachment'
  const type = message?.attachment_type || ''
  const size = formatBytes(message?.attachment_size)
  const [state, setState] = useState({ path: null, url: null, failed: false })
  const url = state.path === path ? state.url : null
  const failed = state.path === path ? state.failed : false

  const fail = () => setState({ path, url: null, failed: true })

  useEffect(() => {
    if (!path || pending) return undefined
    let alive = true
    attachmentUrl(path).then((u) => {
      if (alive) setState({ path, url: u || null, failed: !u })
    })
    return () => {
      alive = false
    }
  }, [path, pending])

  if (!path) return null

  if (isImageType(type)) {
    // Fixed height so the box is never an empty void while the image resolves
    // or if the signed URL turns out to be unusable.
    return (
      <div className="mt-1.5 w-full max-w-[240px] overflow-hidden rounded-xl bg-black/[0.06]">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={url} alt={name} loading="lazy" onError={fail} className="h-36 w-full object-contain" />
          </a>
        ) : (
          <p className="flex h-36 items-center justify-center px-3 text-center text-xs opacity-70">
            {pending ? 'Uploading image…' : failed ? 'Preview unavailable' : 'Loading preview…'}
          </p>
        )}
      </div>
    )
  }

  const shell = `mt-1.5 flex w-full max-w-[240px] items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${
    onBlue ? 'bg-white text-[#007aff]' : 'bg-white text-slate-700 ring-1 ring-slate-200'
  }`
  const meta = `block text-[11px] ${onBlue ? 'text-[#007aff]/70' : 'text-slate-400'}`

  if (!url) {
    return (
      <span className={`${shell} opacity-80`}>
        <IconPaperclip className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className={meta}>{pending ? 'Uploading…' : failed ? 'Unavailable' : size || 'Preparing…'}</span>
        </span>
      </span>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${shell} font-medium transition-opacity hover:opacity-80`}
    >
      <IconPaperclip className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        <span className={meta}>{size || 'File'}</span>
      </span>
      <IconDownload className="shrink-0" />
    </a>
  )
}
