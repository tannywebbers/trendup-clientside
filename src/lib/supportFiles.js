import { supabase } from '@/integrations/supabase/client'

export const ATTACHMENT_BUCKET = 'support-attachments'
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const signedUrls = new Map()

function safeName(name) {
  return (name || 'file')
    .replace(/[^\w.-]+/g, '_')
    .slice(-80)
}

export function isImageType(type) {
  return /^image\//i.test(type || '')
}

export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// <ticket_id>/<uploader_uid>-<timestamp>-<rand>-<name>
// The ticket id is the first folder segment: the storage RLS policies read it
// to decide whether the requester may read or write the object.
export function attachmentPath(ticketId, userId, file) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${ticketId}/${userId || 'anon'}-${Date.now()}-${rand}-${safeName(file.name)}`
}

export async function uploadAttachment({ ticketId, userId, file }) {
  if (!file) return null
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('That file is larger than 10 MB.')

  const path = attachmentPath(ticketId, userId, file)
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)

  return {
    path,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  }
}

export async function attachmentUrl(path) {
  if (!path) return null
  if (signedUrls.has(path)) return signedUrls.get(path)
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return null
  signedUrls.set(path, data.signedUrl)
  return data.signedUrl
}

// Local preview for the file the sender just picked, before it is uploaded.
export function createPreviewUrl(file) {
  if (!file || !isImageType(file.type)) return null
  try {
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}

export function revokePreviewUrl(url) {
  if (url) URL.revokeObjectURL(url)
}
