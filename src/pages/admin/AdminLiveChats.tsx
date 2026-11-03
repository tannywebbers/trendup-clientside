import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { subscribeChanges, unsubscribeChanges } from '@/lib/realtime'
import { createPreviewUrl, revokePreviewUrl, uploadAttachment } from '@/lib/supportFiles'
import ChatFilePreview from '@/components/ChatFilePreview'
import ChatText from '@/components/ChatText'
import SupportAttachment from '@/components/SupportAttachment'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/hooks/use-auth'

const STATUS_STYLES = {
  new: 'bg-sky-50 text-sky-700',
  open: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  resolved: 'bg-brand-50 text-brand-700',
  closed: 'bg-slate-100 text-slate-600',
}
const STATUS_DOTS = {
  new: 'bg-sky-500',
  open: 'bg-emerald-500',
  pending: 'bg-amber-500',
  resolved: 'bg-brand-500',
  closed: 'bg-slate-400',
}
const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]
const PAGE = 12
// The inbox is a full-bleed workspace: it fills everything below the mobile bar
// and the whole viewport on desktop, where the sidebar replaces the top bar.
const PANEL_H = 'h-[calc(100dvh-4rem)] lg:h-[100dvh]'

function IconUser({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconMail({ className = '' }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function IconSearch({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function IconPaperclip({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function MessageBubble({ m, customer = 'Customer', last = true }) {
  const staff = m.is_staff === true || m.staff === true
  return (
    <div className={`flex ${staff ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative px-3.5 pb-2 pt-2.5 text-[15px] leading-[1.35] animate-[bubbleIn_0.18s_ease-out] ${
          staff ? 'bg-[#007aff] text-white rounded-[20px] rounded-br-[6px]' : 'bg-[#e5e5ea] text-black rounded-[20px] rounded-bl-[6px]'
        }`}
        style={{ maxWidth: '78%' }}
      >
        <p className={`mb-0.5 text-[11px] leading-3 ${staff ? 'text-white/80' : 'text-slate-500'}`}>
          {m.author_name || (staff ? 'Support' : customer)}
          {staff && <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">staff</span>}
        </p>
        <ChatText text={m.body} staff={staff} />
        {m.attachment_path && <SupportAttachment message={m} onBlue={staff} />}
        {last && (
          <span
            className={`absolute bottom-0 h-3.5 w-3.5 ${
              staff ? 'right-[-6px] bg-[#007aff] [clip-path:polygon(0_0,100%_100%,0_100%)]' : 'left-[-6px] bg-[#e5e5ea] [clip-path:polygon(100%_0,100%_100%,0_100%)]'
            }`}
          />
        )}
        <p className="mt-1 text-right text-[10px] leading-3 opacity-50">{new Date(m.created_at).toLocaleString()}</p>
      </div>
    </div>
  )
}

function TicketThread({ ticketId, onClose, onRefresh }) {
  const { user } = useAuth() as any
  const session = { user } as any
  const [data, setData] = useState<any>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [reopen, setReopen] = useState(false)
  const [pendingFile, setPendingFile] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [filePreview, setFilePreview] = useState<any>(null)
  const inputRef = useRef<any>(null)
  const fileRef = useRef<any>(null)
  const lastSeenRef = useRef<any>(null)

  const refreshAll = () => {
    onRefresh?.()
    window.dispatchEvent(new Event('admin-inbox-refresh'))
  }

  const load = async () => {
    setErr('')
    const { data: d, error: e } = await supabase.rpc('get_support_ticket', { p_ticket_id: ticketId })
    if (e) {
      setErr(e.message)
      return
    }
    setData(d)
    setErr('')
    const msgs = d?.messages || []
    let newestCustomer = null
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].is_staff !== true && msgs[i].staff !== true) {
        newestCustomer = msgs[i]
        break
      }
    }
    const newestId = newestCustomer?.id || null
    if (newestId && newestId !== lastSeenRef.current) {
      lastSeenRef.current = newestId
      const { error: markErr } = await supabase.rpc('mark_support_ticket_read', { p_ticket_id: ticketId })
      if (!markErr) refreshAll()
    }
  }
  useEffect(() => {
    setReopen(false)
    lastSeenRef.current = null
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const liveStatus = data?.ticket?.status
  useEffect(() => {
    if (!liveStatus || liveStatus === 'closed' || liveStatus === 'resolved') return
    const t = setInterval(() => {
      if (document.hidden) return
      load()
    }, 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, liveStatus])

  useEffect(() => {
    const channel = subscribeChanges(`inbox-${ticketId}`, [
      {
        event: 'INSERT',
        table: 'support_messages',
        filter: `ticket_id=eq.${ticketId}`,
        onChange: () => load(),
      },
      {
        event: 'UPDATE',
        table: 'support_tickets',
        filter: `id=eq.${ticketId}`,
        onChange: () => load(),
      },
    ])
    return () => {
      unsubscribeChanges(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      if (reply.trim()) el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [reply])

  const pickFile = () => fileRef.current?.click()

  const onFilePicked = (e: any) => {
    const file = e.target.files?.[0] || null
    setPendingFile(file)
    if (filePreview) revokePreviewUrl(filePreview)
    setFilePreview(createPreviewUrl(file))
    e.target.value = ''
  }

  const removeFile = () => {
    if (filePreview) revokePreviewUrl(filePreview)
    setPendingFile(null)
    setFilePreview(null)
  }

  const sendReply = async () => {
    const text = reply.trim()
    const file = pendingFile
    if ((!text && !file) || busy) return
    setBusy(true)
    setUploading(!!file)
    setMsg('')
    setErr('')
    try {
      const attachment = file ? await uploadAttachment({ ticketId, userId: session?.user?.id, file }) : null
      const { error: e } = await supabase.rpc('reply_support_ticket', {
        p_ticket_id: ticketId,
        p_body: text,
        p_attachment: attachment,
      })
      if (e) throw e
      setReply('')
      setPendingFile(null)
      setFilePreview(null)
      setReopen(false)
      setMsg('Reply sent.')
      load()
      setTimeout(() => setMsg(''), 2000)
    } catch (ex) {
      setErr(ex.message || 'Could not send that reply.')
    } finally {
      setBusy(false)
      setUploading(false)
    }
  }

  const openTicket = async () => {
    setBusy(true)
    setErr('')
    const { error: e } = await supabase.rpc('open_support_ticket', { p_ticket_id: ticketId })
    setBusy(false)
    if (e) {
      setErr(e.message)
      return
    }
    load()
  }

  const setStatus = async (status) => {
    setBusy(true)
    setErr('')
    await supabase.rpc('set_support_ticket_status', { p_ticket_id: ticketId, p_status: status })
    setBusy(false)
    load()
  }

  if (!data) {
    return (
      <div className="flex min-h-96 items-center justify-center text-slate-500">
        <Spinner />
      </div>
    )
  }

  const ticket = data.ticket
  const closed = ticket.status === 'closed' || ticket.status === 'resolved'
  const assignedName = ticket.staff?.full_name || ticket.staff?.username || null
  const mine = ticket.assigned_to && ticket.assigned_to === session?.user?.id
  const statusColor = assignedName ? 'text-[#34c759]' : closed ? 'text-[#8e8e93]' : 'text-amber-500'
  const statusLine = closed
    ? (ticket.status === 'resolved' ? 'Resolved · chat ended' : 'Chat ended')
    : assignedName
      ? `${assignedName}${mine ? ' (you)' : ''} · Online`
      : 'Waiting for support'

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendReply()
    }
  }

  return (
    <div className={`flex ${PANEL_H} flex-col overflow-hidden bg-white`}>
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#e5e5ea] bg-white/95 px-[18px]">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition-colors hover:bg-black/5 hover:text-black"
          aria-label="Back to all tickets"
        >
          ‹
        </button>
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#007aff] text-xl text-white">💬</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-5 text-black">{ticket.subject || 'Support'}</p>
          <p className={`mt-0.5 truncate text-xs leading-4 ${statusColor}`}>{statusLine}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`badge ${STATUS_STYLES[ticket.status] || 'bg-slate-100 text-slate-600'}`}>{ticket.status}</span>
          {!assignedName && !closed ? (
            <button
              type="button"
              onClick={openTicket}
              disabled={busy}
              className="btn btn-primary !rounded-full !px-3 !py-1.5 !text-xs"
              title="Claim this ticket and start replying"
            >
              {busy && <Spinner />}
              Open ticket
            </button>
          ) : (
            <select
              className="input !w-auto !rounded-full !pl-2 !pr-6 !py-1.5 !text-xs"
              value={ticket.status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          )}
        </div>
      </div>

      {err && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{err}</p>}

      <div className="messages no-scrollbar flex-1 space-y-2 overflow-y-auto bg-white px-3.5 py-4">
        {data.messages?.length === 0 && <p className="pt-8 text-center text-xs text-slate-400">No messages yet.</p>}
        {data.messages?.map((m, i) => {
          const staff = m.is_staff === true || m.staff === true
          const next = data.messages[i + 1]
          const lastOfGroup = i === data.messages.length - 1 || staff !== (next && (next.is_staff === true || next.staff === true))
          return <MessageBubble key={m.id || m.created_at + m.body.slice(0, 8)} m={m} customer={ticket.customer?.full_name || ticket.customer?.username || 'Customer'} last={lastOfGroup} />
        })}
      </div>

      {closed && !reopen ? (
        <div className="shrink-0 border-t border-[#e5e5ea] bg-[#f9f9f9] p-4">
          <p className="text-center text-[13px] text-[#8e8e93]">This ticket is closed.</p>
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => setReopen(true)} className="btn btn-primary !rounded-full !px-4 !py-2 !text-xs">
              Reply to reopen
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-[#e5e5ea] bg-[#f9f9f9] p-2.5">
          {(msg || uploading) && (
            <p className="mb-1.5 text-center text-[11px] text-emerald-600">
              {uploading ? 'Uploading file…' : msg}
            </p>
          )}
          {pendingFile && (
            <ChatFilePreview file={pendingFile} previewUrl={filePreview} onRemove={removeFile} />
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" className="hidden" onChange={onFilePicked} />
            <button
              type="button"
              onClick={pickFile}
              disabled={busy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition-colors hover:bg-black/5 hover:text-black disabled:opacity-40"
              aria-label="Attach a file"
              title="Attach a file"
            >
              <IconPaperclip />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              className="min-h-10 max-h-[120px] flex-1 resize-none rounded-[20px] border border-[#d1d1d6] bg-white px-3.5 py-2 text-[15px] text-black outline-none transition-colors placeholder:text-slate-400 focus:border-[#007aff]"
              placeholder={closed ? 'Reply to reopen — this will reopen the ticket…' : 'Message'}
              value={reply}
              disabled={busy}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={onKey}
            />
            <button
              type="button"
              onClick={sendReply}
              disabled={busy || (!reply.trim() && !pendingFile)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007aff] text-lg font-semibold text-white transition-all hover:scale-105 active:scale-90 disabled:opacity-40 disabled:hover:scale-100"
              aria-label="Send reply"
            >
              {busy ? <Spinner /> : closed ? '↺' : '↑'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminInbox() {
  const { session } = useAuth()
  const [items, setItems] = useState(null)
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [activeId, setActiveId] = useState(null)

  // Memoized so the effects below can depend on it directly. Without this the
  // list filters, the realtime refresh listener and the pagination buttons all
  // closed over a different `load` per render.
  const load = useCallback(
    (target = page) => {
      supabase
        .rpc('list_support_tickets', { p_status: status || null, p_search: search.trim() || null, p_limit: PAGE, p_offset: target * PAGE })
        .then(({ data, error: err }) => {
          if (err) {
            setItems([])
            return
          }
          setItems(data?.items || [])
          setCount(data?.count || 0)
        })
    },
    [page, status, search]
  )

  useEffect(() => {
    load(0)
  }, [status, search, load])

  useEffect(() => {
    const onRefresh = () => load()
    window.addEventListener('admin-inbox-refresh', onRefresh)
    return () => window.removeEventListener('admin-inbox-refresh', onRefresh)
  }, [load])

  // Anything landing in the inbox (new chat, new message, status change) reaches
  // the list and the tab badge immediately; the burst timer keeps it to one reload.
  useEffect(() => {
    let timer = null
    const ping = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => window.dispatchEvent(new Event('admin-inbox-refresh')), 350)
    }
    const channel = subscribeChanges('admin-inbox-feed', [
      { table: 'support_tickets', onChange: ping },
      { table: 'support_messages', onChange: ping },
    ])
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribeChanges(channel)
    }
  }, [])

  const pages = Math.max(1, Math.ceil(count / PAGE))
  const current = items?.find((i) => i.id === activeId) || null

  // Each column carries PANEL_H, so the grid takes that height on its own and the
// two panes always line up. No percentage height needed on the wrappers.
return (
    <div className="bg-white">
      <div className="grid lg:grid-cols-[clamp(300px,24%,380px)_1fr]">
            <div className={`flex ${PANEL_H} flex-col border-r border-slate-100`}>
              <div className="shrink-0 border-b border-slate-100 p-4">
                <div className="relative">
                  <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    className="input !rounded-xl !pl-9"
                    placeholder="Search by subject…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(0)
                      setActiveId(null)
                    }}
                  />
                </div>
              </div>
              <div className="shrink-0 border-b border-slate-100 px-2.5 py-2">
                {/* Kept on a single row: flex-nowrap plus tight pills, so all five
                    statuses stay visible instead of wrapping to a second line. */}
                <div className="flex flex-nowrap items-center gap-1">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => {
                        setStatus(f.value)
                        setPage(0)
                        setActiveId(null)
                      }}
                      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold leading-none transition-colors ${
                        status === f.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="no-scrollbar flex-1 overflow-y-auto">
                {!items ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-400">
                    <Spinner /> Loading tickets…
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    <p>No tickets{status ? ` with status “${status}”` : ''} right now.</p>
                    <p className="mt-1 text-xs text-slate-300">Customer support messages land here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveId(t.id)}
                      className={`block w-full px-4 py-4 text-left transition-colors hover:bg-slate-50/70 ${
                        activeId === t.id ? 'bg-brand-50/60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100/70 text-brand-600">
                          <IconUser />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-bold text-ink-950">{t.subject}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-600'}`}>
                              {t.status}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <IconMail className="shrink-0" />
                            <span className="truncate">
                              {t.customer?.full_name || t.customer?.username || '—'} · {t.customer?.email || '—'}
                            </span>
                          </div>
                          {t.assigned && (
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">
                              Assigned to {t.assigned.full_name || t.assigned.username}
                              {t.assigned.id === session?.user?.id ? ' (you)' : ''}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              {t.message_count ?? 0} message{(t.message_count ?? 0) === 1 ? '' : 's'} ·{' '}
                              {new Date(t.updated_at).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-2">
                              {t.unread_replies > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                  {t.unread_replies > 9 ? '9+' : t.unread_replies}
                                </span>
                              )}
                              <span className={`h-2 w-2 rounded-full ${STATUS_DOTS[t.status] || 'bg-slate-300'}`} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  </div>
                )}
              </div>
              {pages > 1 && (
                <div className="flex shrink-0 items-center justify-center gap-1 border-t border-slate-100 p-3">
                  <button
                    disabled={page === 0}
                    onClick={() => {
                      setPage(page - 1)
                      setActiveId(null)
                      load(page - 1)
                    }}
                    className="btn !px-2 !py-1 !text-xs"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-2 text-xs text-slate-500">
                    {page + 1} / {pages}
                  </span>
                  <button
                    disabled={page >= pages - 1}
                    onClick={() => {
                      setPage(page + 1)
                      setActiveId(null)
                      load(page + 1)
                    }}
                    className="btn !px-2 !py-1 !text-xs"
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
            <div className="min-w-0">
              {current ? (
                <TicketThread
                  key={current.id}
                  ticketId={current.id}
                  onClose={() => setActiveId(null)}
                  onRefresh={() => load()}
                />
              ) : (
                <div className={`grid ${PANEL_H} place-items-center text-center`}>
                  <div>
                    <p className="text-lg font-medium text-ink-950">Select a ticket</p>
                    <p className="mt-1 text-sm text-slate-400">Choose a conversation from the list to start responding.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
    </div>
  )
}