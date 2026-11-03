import { formatBytes } from '../lib/supportFiles'

function IconPaperclip({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function IconX({ className = '' }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export default function ChatFilePreview({ file, previewUrl, onRemove }) {
  if (!file) return null
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
      {previewUrl ? (
        <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <IconPaperclip />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-700">{file.name}</span>
        <span className="block text-[11px] text-slate-400">{formatBytes(file.size)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="Remove attachment"
      >
        <IconX />
      </button>
    </div>
  )
}
