import { REAGENTS } from '@/ml/engine';
import { drugText, fmtDate, fmtTime, type AuditRecord } from '@/lib/types';

export type PrahariReply = { text: string; action?: 'scan' | 'logs' | 'home' | 'doc' };

export function prahariReply(q: string, lang: 'en' | 'hi', records: AuditRecord[], focus?: AuditRecord | null): PrahariReply {
  const t = q.toLowerCase();
  const hi = lang === 'hi';
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const last = [...records].sort((a, b) => b.seq - a.seq)[0];

  if (has('explain this', 'this result', 'this test', 'यह परिणाम', 'समझा') && focus) {
    const wells = focus.wells.map((w, i) => `${i + 1}. ${w.colour}${w.drug ? ' → ' + w.drug : ''} (${w.conf}%)`).join('\n');
    return { text: summary(focus, hi) + '\n' + wells + (hi ? '\nयह प्रारंभिक परिणाम है।' : '\nThis is a presumptive result. Send the sample for lab confirmation.') };
  }
  if (has('next', 'what should', 'आगे क्या')) {
    return {
      text: hi
        ? 'परिणाम देखें, हाँ या नहीं चुनें, और नमूना लैब भेजें।'
        : 'Check the result, mark yes or no, and send the sample to the lab.',
    };
  }
  if (has('intact', 'seal', 'hash', 'tamper', 'सील')) {
    return {
      text: hi
        ? 'हर रिकॉर्ड पिछले रिकॉर्ड के हैश के साथ SHA-256 से सील है। पुराना रिकॉर्ड बदलने पर उसके बाद की कड़ी टूटती है। जाँच स्क्रीन बताती है कहाँ।'
        : 'Each record is hashed with SHA-256 together with the previous record’s hash. Editing any old record changes its hash and breaks every link after it. The Verify screen shows where.',
    };
  }
  if (has('kit label', 'scan the kit', 'scan fir', 'document', 'ocr')) {
    return {
      text: hi ? 'दस्तावेज़ स्कैनर खोल रहा हूँ। FIR या किट लेबल चुनें।' : 'Opening the document scanner. Pick an FIR or a kit label.',
      action: 'doc',
    };
  }
  if (has('test b', 'cannabis', 'ganja', 'charas')) return { text: steps('testB', hi) };
  if (has('test e', 'cocaine step', 'e1', 'e2', 'e3')) return { text: steps(has('part 2', 'e3', 'e4') ? 'testE2' : 'testE1', hi) };
  if (has('marquis')) return { text: steps('marquis', hi) };
  if (has('mecke')) return { text: steps('mecke', hi) };
  if (has('mandelin')) return { text: steps('mandelin', hi) };
  if (has('scott')) return { text: steps('scott', hi) };
  if (has('blue mean', 'what does blue', 'नीला', 'नीले')) {
    return {
      text: hi
        ? 'Test E भाग 1 में नीला रंग कोकेन या मेथाक्वालोन का संकेत है। भाग 2 से फर्क करें: हरा कोकेन, पीला मेथाक्वालोन।'
        : 'On Test E part 1, blue means cocaine or methaqualone. Part 2 separates them: green is cocaine, yellow is methaqualone.',
    };
  }
  if (has('start', 'new test', 'naya', 'नया')) return { text: hi ? 'नया टेस्ट खोल रहा हूँ।' : 'Opening a new test.', action: 'scan' };
  if (has('log', 'record', 'history', 'ऑडिट')) return { text: hi ? 'ऑडिट लॉग खोल रहा हूँ।' : 'Opening the audit log.', action: 'logs' };
  if (has('home', 'होम')) return { text: hi ? 'होम पर जा रहा हूँ।' : 'Going home.', action: 'home' };
  if (has('last', 'latest', 'पिछला', 'आखिरी') && last) {
    return { text: summary(last, hi) };
  }
  if (has('today', 'summar', 'आज') ) {
    const today = records.filter((r) => new Date(r.createdAt).toDateString() === new Date().toDateString());
    const pos = today.filter((r) => r.overall.status === 'POSITIVE');
    return {
      text: hi
        ? `आज ${today.length} टेस्ट, ${pos.length} में संकेत मिला।`
        : `Today: ${today.length} tests, ${pos.length} with a detection. ${today.filter((r) => !r.confirmed && !r.disputed).length} still need your yes or no.`,
    };
  }
  if (has('false', 'limit', 'sure', 'court')) {
    return {
      text: hi
        ? 'यह प्रारंभिक रंग परीक्षण है। चीनी, साबुन और कुछ दवाइयाँ भी रंग बदल सकती हैं। नमूना लैब में भेजें।'
        : 'This is a presumptive colour test. Sugar, soap and some medicines can change colour too. Keep sample for the lab. It is not a court identification by itself.',
    };
  }
  if (has('photo', 'camera', 'light', 'blur', 'फोटो')) {
    return {
      text: hi
        ? 'प्लेट को ऊपर से, सीधी रोशनी में, तीनों वेल और आसपास सफेद प्लेट दिखे। परछाई और चमक से बचें।'
        : 'Shoot top-down in even light. All three wells and some white plate around each one must be in frame. Avoid shadow and glare.',
    };
  }
  return {
    text: hi
      ? 'मैं टेस्ट के स्टेप, रंग का मतलब, या आज के रिकॉर्ड बता सकता हूँ। उदाहरण: "Test B के स्टेप"।'
      : 'I can read a reagent’s steps, explain a colour, or summarise today’s records. Try “How do I do Test B?”',
  };
}

function steps(id: string, hi: boolean): string {
  const R = REAGENTS[id];
  const head = hi ? `${R.name} के स्टेप:` : `${R.name}:`;
  return head + '\n' + R.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + (hi ? `\nपॉज़िटिव: ${R.positive}` : `\nPositive: ${R.positive}`);
}

function summary(r: AuditRecord, hi: boolean): string {
  const lang = hi ? 'hi' as const : 'en' as const;
  if (hi) return `${r.suspect.name} (${r.id}): ${drugText(r, lang)}, ${r.overall.conf}% । ${fmtDate(r.createdAt, lang)} ${fmtTime(r.createdAt, lang)}, ${r.location.place}।`;
  return `${r.suspect.name} (${r.id}): ${drugText(r, lang)}, ${r.overall.conf}% confidence. ${fmtDate(r.createdAt, lang)} ${fmtTime(r.createdAt, lang)}, ${r.location.place}. Presumptive only.`;
}

export async function remoteChat(
  backend: string,
  message: string,
  language: 'en' | 'hi',
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const r = await fetch(backend.replace(/\/$/, '') + '/api/voice/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      language: language === 'hi' ? 'hi-IN' : 'en-IN',
      conversation_history: history,
    }),
  });
  if (!r.ok) throw new Error(String(r.status));
  const j = (await r.json()) as { reply?: string };
  if (!j.reply) throw new Error('empty');
  return j.reply;
}

export async function remoteStt(
  backend: string,
  audio: string,
  mime: string,
  language: 'en' | 'hi',
): Promise<string> {
  const r = await fetch(backend.replace(/\/$/, '') + '/api/voice/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, mime, language: language === 'hi' ? 'hi-IN' : 'en-IN' }),
  });
  const j = (await r.json()) as { transcript?: string; error?: string };
  if (!r.ok || !j.transcript) throw new Error(j.error || String(r.status));
  return j.transcript;
}

export async function remoteTts(backend: string, text: string, language: 'en' | 'hi'): Promise<string> {
  const r = await fetch(backend.replace(/\/$/, '') + '/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 500), language: language === 'hi' ? 'hi-IN' : 'en-IN' }),
  });
  const j = (await r.json()) as { audio?: string; error?: string };
  if (!r.ok || !j.audio) throw new Error(j.error || String(r.status));
  return j.audio;
}
