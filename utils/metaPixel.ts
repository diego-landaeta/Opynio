// Meta Pixel + Conversions API helper
// Pixel snippet is loaded in index.html. This module wraps fbq() and forwards
// a duplicate event to our `meta-capi` Edge Function so server-side CAPI can
// dedupe via event_id.

import { supabase } from '../services/supabaseService';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export const META_PIXEL_ID = '1280166973678477';

type EventName = 'ViewContent' | 'CompleteRegistration' | 'Purchase';

interface UserData {
  email?: string | null;
  phone?: string | null;
  external_id?: string | null;
}

interface CustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
}

interface TrackOptions {
  eventId?: string;
  userData?: UserData;
  customData?: CustomData;
  sourceUrl?: string;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function sendCapi(
  eventName: EventName,
  eventId: string,
  options: TrackOptions
): Promise<void> {
  try {
    const user_data: Record<string, string[] | string> = {};
    if (options.userData?.email) {
      user_data.em = [await sha256Hex(options.userData.email)];
    }
    if (options.userData?.phone) {
      user_data.ph = [await sha256Hex(options.userData.phone.replace(/\D/g, ''))];
    }
    if (options.userData?.external_id) {
      user_data.external_id = [await sha256Hex(options.userData.external_id)];
    }
    const fbp = getCookie('_fbp');
    const fbc = getCookie('_fbc');
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;
    if (typeof navigator !== 'undefined') {
      user_data.client_user_agent = navigator.userAgent;
    }

    await supabase.functions.invoke('meta-capi', {
      body: {
        event_name: eventName,
        event_id: eventId,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: options.sourceUrl || window.location.href,
        user_data,
        custom_data: options.customData || {},
      },
    });
  } catch (err) {
    console.warn('[meta-capi] failed to send', err);
  }
}

export async function trackMetaEvent(
  eventName: EventName,
  options: TrackOptions = {}
): Promise<string> {
  const eventId = options.eventId || uuid();

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, options.customData || {}, { eventID: eventId });
  }

  void sendCapi(eventName, eventId, options);

  return eventId;
}

export function trackPageView(): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}
