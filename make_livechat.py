ref_path = 'C:/Users/DELL/Documents/vs-code/trendup-api-frontend/src/components/LiveChat.jsx'
target_path = 'C:/Users/DELL/Downloads/tikswap-main/trendup/src/components/LiveChat.tsx'
ref = open(ref_path).read()
idx = ref.find('function IconChat')
rest = ref[idx:]
header = """import { useCallback, useEffect, useRef, useState } from 'react'
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

"""
combined = header + rest
combined = combined.replace("  const { user, profile } = useAuth() as any\n  const session = { user } as any", "  const { session, profile } = useAuth() as any")
combined = combined.replace("  const isAdminArea =\n    location.pathname.startsWith('/back/stage/admin')", "  const isAdminArea = location.pathname.startsWith('/baki/stage/admin')")
open(target_path,'w').write(combined)
