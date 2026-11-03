import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { subscribeChanges, unsubscribeChanges } from '@/lib/realtime'
import { createPreviewUrl, revokePreviewUrl, uploadAttachment } from '@/lib/supportFiles'
import ChatFilePreview from './ChatFilePreview'
import ChatText from './ChatText'
import SupportAttachment from './SupportAttachment'
import Spinner from './Spinner'

const ENDED = new Set(['closed', 'resolved'])

const GREY = 'bg-[#e5e5ea]'
const BLUE = 'bg-[#007aff]'

function IconChat({ className = '' }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconSend({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

function IconX({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function IconMinimize({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function IconEnd({ className = '' }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v2.19a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h2.18a2 2 0 0 1 2 2.16 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 10.35a16 16 0 0 0-1.1 1.55" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function IconHeadset({ className = '' }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11a9 9 0 0 1 18 0" />
      <path d="M21 16a2 2 0 0 1-4 0v-3a2 2 0 0 1 4 0Z" />
      <path d="M3 16a2 2 0 0 0 4 0v-3a2 2 0 0 0-4 0Z" />
      <path d="M3 13.5V16a5 5 0 0 0 10 0v-2" />
    </svg>
  )
}

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
    .padEnd(1, '?')
}

function staffAvatarUrl(name) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || 'Support')}&backgroundColor=2563eb`
}

function StaffAvatar({ name }) {
  const [broken, setBroken] = useState(false)
  const label = name || 'Support'
  if (broken) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
        {initialsOf(label)}
      </div>
    )
  }
  return (
    <img
      src={staffAvatarUrl(label)}
      alt={label}
      className="h-9 w-9 shrink-0 rounded-full bg-white/15 object-cover ring-2 ring-white/40"
      onError={() => setBroken(true)}
    />
  )
}

function IconPaperclip({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function iOSBubble({ staff, body, time, showAvatar, message }) {
  return (
    <div className={`flex ${staff ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`relative px-3.5 pb-2 pt-2.5 text-[15px] leading-[1.35] animate-[bubbleIn_0.18s_ease-out] ${
          staff
            ? `${GREY} text-black rounded-[20px] rounded-bl-[6px]`
            : `${BLUE} text-white rounded-[20px] rounded-br-[6px]`
        }`}
        style={{ maxWidth: '78%' }}
      >
        <ChatText text={body} staff={staff} />
        {message && <SupportAttachment message={message} onBlue={!staff} />}
        {showAvatar && (
          <span
            className={`absolute bottom-0 h-3.5 w-3.5 ${
              staff
                ? `left-[-6px] ${GREY} [clip-path:polygon(100%_0,100%_100%,0_100%)]`
                : `right-[-6px] ${BLUE} [clip-path:polygon(0_0,100%_100%,0_100%)]`
            }`}
          />
        )}
        <p className="mt-1 text-right text-[10px] leading-3 opacity-50">{time}</p>
      </div>
    </div>
  )
}

const Bubble = { view: iOSBubble }

export { LiveChat }
export default LiveChat
function LiveChat() {
  const { session, profile } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState(null)
  const [chatId, setChatId] = useState(null)
  const [status, setStatus] = useState(null)
  const [supportStaff, setSupportStaff] = useState(null)
  const [unread, setUnread] = useState(0)
  const [greeting, setGreeting] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [ending, setEnding] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [filePreview, setFilePreview] = useState(null)
  const [err, setErr] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  const isAdminArea = location.pathname.startsWith('/baki/stage/admin')

  const firstName = (profile?.full_name || '').split(/\s+/)[0] || profile?.username || 'there'
  const userId = session?.user?.id

  const refreshSummary = useCallback(async () => {
    if (isOpen) {
      setUnread(0)
      return
    }
    const { data } = await supabase.rpc('my_chat_summary')
    if (data) setUnread(data.unread || 0)
  }, [isOpen])

  const applyTicket = useCallback((full) => {
    if (!full) return
    setMessages(Array.isArray(full.messages) ? full.messages : [])
    setStatus(full.ticket?.status || null)
    setSupportStaff(full.ticket?.staff || null)
  }, [])

  const loadChat = useCallback(async () => {
    setMessages(null)
    setErr('')
    const { data, error } = await supabase.rpc('open_support_chat')
    if (error) {
      setErr(error.message)
      setMessages([])
      setChatId(null)
      setStatus(null)
      setSupportStaff(null)
      return
    }
    if (data?.id) {
      setChatId(data.id)
      setStatus(data.status)
      const { data: full } = await supabase.rpc('get_support_ticket', { p_ticket_id: data.id })
      applyTicket(full)
      supabase.rpc('mark_support_ticket_read', { p_ticket_id: data.id })
      refreshSummary()
    } else {
      setChatId(null)
      setStatus(null)
      setSupportStaff(null)
      setMessages([])
      const { data: b } = await supabase.rpc('get_public_branding')
      setGreeting((b?.live_chat_welcome || 'Hello {name}! 👋 Welcome to support. How can we help you today?').replaceAll('{name}', firstName))
    }
  }, [firstName, refreshSummary, applyTicket])

  useEffect(() => {
    const open = () => setIsOpen(true)
    window.addEventListener('openLiveChat', open)
    return () => window.removeEventListener('openLiveChat', open)
  }, [])

  useEffect(() => {
    if (!isOpen || !session || isAdminArea) return
    setUnread(0)
    loadChat()
  }, [isOpen, session, isAdminArea, loadChat])

  useEffect(() => {
    if (!session || isOpen) return
    refreshSummary()
    const t = setInterval(refreshSummary, 20000)
    return () => clearInterval(t)
  }, [session, isOpen, refreshSummary])

  useEffect(() => {
    if (!chatId || !isOpen) return
    const channel = supabase && subscribeChanges(`livechat-${chatId}`, [
      {
        event: 'INSERT',
        table: 'support_messages',
        filter: `ticket_id=eq.${chatId}`,
        onChange: (payload) => {
          const m = payload.new
          const staff = m.is_staff === true
          if (!staff && userId && m.user_id === userId) return
          setMessages((prev) => {
            if (!prev) return prev
            const dup = prev.some((x) => (x.id && x.id === m.id) || (!x.id && x.created_at === m.created_at && x.body === m.body))
            if (dup) return prev
            return [
              ...prev,
              {
                id: m.id,
                body: m.body,
                staff,
                created_at: m.created_at,
                attachment_path: m.attachment_path,
                attachment_name: m.attachment_name,
                attachment_type: m.attachment_type,
                attachment_size: m.attachment_size,
              },
            ]
          })
          if (staff) {
            supabase.rpc('mark_support_ticket_read', { p_ticket_id: chatId })
            refreshSummary()
          }
        },
      },
      {
        event: 'UPDATE',
        table: 'support_tickets',
        filter: `id=eq.${chatId}`,
        onChange: () => {
          supabase.rpc('get_support_ticket', { p_ticket_id: chatId }).then(({ data: full }) => {
            applyTicket(full)
          })
        },
      },
    ])
    return () => {
      unsubscribeChanges(channel)
    }
  }, [chatId, isOpen, refreshSummary, applyTicket, userId])

  // Realtime delivers instantly; this poll is the safety net for dropped events
  // and only runs while a conversation is actually live.
  useEffect(() => {
    if (!chatId || !isOpen || ENDED.has(status)) return undefined
    const t = setInterval(() => {
      if (document.hidden) return
      supabase.rpc('get_support_ticket', { p_ticket_id: chatId }).then(({ data: full }) => {
        if (full) applyTicket(full)
      })
    }, 12000)
    return () => clearInterval(t)
  }, [chatId, isOpen, status, applyTicket])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      if (input.trim()) el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [input])

  const ended = ENDED.has(status)

  const pickFile = () => fileRef.current?.click()

  const onFilePicked = (e) => {
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

  const send = async () => {
    const text = input.trim()
    const file = pendingFile
    if ((!text && !file) || sending || ended || messages === null) return
    setSending(true)
    setUploading(!!file)
    setErr('')
    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...(prev || []),
      {
        id: tempId,
        body: text,
        staff: false,
        created_at: new Date().toISOString(),
        attachment_path: file ? `pending/${file.name}` : null,
        attachment_name: file?.name || null,
        attachment_type: file?.type || null,
        attachment_size: file?.size || null,
        attachment_pending: !!file,
      },
    ])
    setInput('')
    setPendingFile(null)
    // The preview chip unmounts with pendingFile, so the blob URL is done.
    revokePreviewUrl(filePreview)
    setFilePreview(null)

    try {
      let ticketId = chatId
      if (!ticketId) {
        const { data, error: createErr } = await supabase.rpc('ensure_support_ticket')
        if (createErr) throw createErr
        ticketId = (data as any)?.id || (data as any)?.ticket_id || null
        if (!ticketId) throw new Error('Could not start the chat.')
        setChatId(ticketId)
      }

      const attachment = file ? await uploadAttachment({ ticketId, userId, file }) : null
      const { error: sendErr } = await supabase.rpc('reply_support_ticket', {
        p_ticket_id: ticketId,
        p_body: text,
        p_attachment: attachment,
      })
      if (sendErr) throw sendErr

      const { data: full } = await supabase.rpc('get_support_ticket', { p_ticket_id: ticketId })
      applyTicket(full)
      if (full?.ticket?.id) setChatId(full.ticket.id)
      supabase.rpc('mark_support_ticket_read', { p_ticket_id: ticketId })
      refreshSummary()
    } catch (e) {
      setErr(e.message || 'Could not send that message.')
      setMessages((prev) => (prev || []).filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  const endChat = async (resolved) => {
    if (!chatId || ending) return
    setEnding(true)
    setErr('')
    const { error } = await supabase.rpc('end_support_chat', {
      p_ticket_id: chatId,
      p_resolved: !!resolved,
    })
    setEnding(false)
    if (error) {
      setErr(error.message)
      return
    }
    setConfirmEnd(false)
    setChatId(null)
    setStatus(null)
    setSupportStaff(null)
    setMessages(null)
    setUnread(0)
    await loadChat()
  }

  const startNewChat = async () => {
    setChatId(null)
    setStatus(null)
    setSupportStaff(null)
    setMessages(null)
    setErr('')
    await loadChat()
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!session || isAdminArea) return null

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open live chat"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg transition-transform hover:scale-105"
        >
          <IconChat />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96 transition-all ${isMinimized ? 'h-14' : 'h-[500px] max-h-[80vh]'}`}
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[#e5e5ea] bg-white px-4">
            {supportStaff ? (
              <StaffAvatar name={supportStaff.full_name || supportStaff.username} />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007aff] text-white">
                <IconHeadset />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-black">
                {supportStaff ? supportStaff.full_name || supportStaff.username : 'Support'}
              </p>
              <p className={`truncate text-xs leading-tight ${ended ? 'text-[#8e8e93]' : supportStaff ? 'text-[#34c759]' : 'text-slate-400'}`}>
                {ended ? 'Chat ended' : supportStaff ? 'Online' : 'Support team · typically replies in minutes'}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              {status && !ended && (
                <button
                  type="button"
                  onClick={() => setConfirmEnd((c) => !c)}
                  disabled={ending}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors hover:bg-black/5 hover:text-black disabled:opacity-50 ${
                    confirmEnd ? 'bg-black text-white hover:bg-black/80 hover:text-white' : 'text-[#8e8e93]'
                  }`}
                  title="End chat"
                >
                  {ending ? <Spinner /> : <IconEnd />}
                  End
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#8e8e93] transition-colors hover:bg-black/5 hover:text-black"
                aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
              >
                <IconMinimize />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#8e8e93] transition-colors hover:bg-black/5 hover:text-black"
                aria-label="Close chat"
              >
                <IconX />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div ref={scrollRef} className="no-scrollbar flex-1 space-y-2 overflow-y-auto bg-white px-3.5 py-4">
                {messages === null ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : messages.length === 0 ? (
                  chatId ? (
                    <p className="pt-8 text-center text-xs text-slate-400">No messages yet. Send the first message to start the conversation.</p>
                  ) : (
                    <>
                      <p className="text-center text-xs text-slate-400">Live support · typically replies in minutes</p>
                      {greeting && (
                        <Bubble.view
                          staff
                          body={greeting}
                          time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          showAvatar
                        />
                      )}
                    </>
                  )
                ) : (
                  messages.map((m, i) => {
                    const staff = m.is_staff === true || m.staff === true
                    const next = messages[i + 1]
                    const lastOfGroup = i === messages.length - 1 || staff !== (next && (next.is_staff === true || next.staff === true))
                    return (
                      <Bubble.view
                        key={m.id || m.created_at + String(m.body || '').slice(0, 12)}
                        staff={staff}
                        body={m.body || ''}
                        message={m.attachment_path ? m : null}
                        time={new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        showAvatar={lastOfGroup}
                      />
                    )
                  })
                )}
                {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
              </div>

              <div className={`shrink-0 border-t border-[#e5e5ea] bg-[#f9f9f9] ${ended || confirmEnd ? 'p-4' : 'p-2.5'}`}>
                {ended ? (
                  <div className="flex flex-col items-center gap-3 py-1 text-center">
                    <p className="text-[13px] text-[#8e8e93]">This chat has ended.</p>
                    <button type="button" onClick={startNewChat} className="btn btn-primary !py-2 !text-xs">
                      Start a new chat
                    </button>
                  </div>
                ) : confirmEnd ? (
                  <div className="py-1 text-center">
                    <p className="text-[13px] font-semibold text-black">Was your question resolved?</p>
                    <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                      Your answer decides where this chat is filed — nothing else is sent.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => endChat(true)}
                        disabled={ending}
                        className="flex-1 rounded-full bg-[#34c759] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2eb14d] disabled:opacity-50"
                      >
                        {ending && <Spinner />} Yes, resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => endChat(false)}
                        disabled={ending}
                        className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#8e8e93] ring-1 ring-[#d1d1d6] transition-colors hover:bg-slate-50 hover:text-black disabled:opacity-50"
                      >
                        No, close it
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmEnd(false)}
                      className="mt-2.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Keep chatting
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-[#e5e5ea] bg-[#f9f9f9] p-2.5">
                    {uploading && (
                      <p className="mb-1.5 text-center text-[11px] text-[#8e8e93]">Uploading file…</p>
                    )}
                    {pendingFile && (
                      <ChatFilePreview file={pendingFile} previewUrl={filePreview} onRemove={removeFile} />
                    )}
                    <div className="flex items-end gap-2">
                      <input ref={fileRef} type="file" className="hidden" onChange={onFilePicked} />
                      <button
                        type="button"
                        onClick={pickFile}
                        disabled={sending}
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
                        placeholder="Message"
                        value={input}
                        disabled={!session || sending || messages === null}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKey}
                      />
                      <button
                        type="button"
                        onClick={send}
                        disabled={(!input.trim() && !pendingFile) || sending || messages === null}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007aff] text-white transition-all hover:scale-105 active:scale-90 disabled:opacity-40 disabled:hover:scale-100"
                        aria-label="Send message"
                      >
                        {sending ? <Spinner /> : <IconSend />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}