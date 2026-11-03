import { supabase } from '@/integrations/supabase/client'

let sequence = 0

// supabase.channel(topic) does NOT create a new channel when the topic already
// exists - it hands back the existing one. So two subscribers for the same topic
// end up sharing a single channel, and the second call to .on() throws:
//
//   cannot add `postgres_changes` callbacks for realtime:notifications-count-...
//   after `subscribe()`
//
// That throw happened inside an effect during render, so with no error boundary
// it unmounted the entire app and the user got a blank white page. The rail is
// rendered twice on a small screen (the desktop aside is `hidden lg:flex`, which
// still mounts its children, and the drawer mounts a second copy), so the nav
// badge subscribed twice and crashed the page the moment the drawer opened.
//
// Every call gets a unique topic so no two subscribers can ever share a channel,
// and the whole thing is wrapped: if realtime still fails, the polling interval
// that each of these hooks already runs keeps the UI correct.
export function subscribeChanges(topic, bindings) {
  const channel = supabase.channel(`${topic}-i${++sequence}`)
  try {
    for (const binding of bindings) {
      const config = { event: binding.event || '*', schema: 'public', table: binding.table }
      if (binding.filter) config.filter = binding.filter
      channel.on('postgres_changes', config, binding.onChange)
    }
    return channel.subscribe()
  } catch (error) {
    console.warn(`Realtime subscribe failed for "${topic}":`, error)
    return null
  }
}

export function unsubscribeChanges(channel) {
  if (channel) supabase.removeChannel(channel)
}
