import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { Platform } from 'react-native';

import { L, type Lang } from '@/lib/i18n';

export type DocKind = 'fir' | 'kit';
export type DocKey = 'name' | 'age' | 'gender' | 'fir' | 'batch' | 'expiry';
export type DocField = { label: string; value: string; key: DocKey };

export const SAMPLE_TEXT: Record<DocKind, string> = {
  fir: [
    'FIRST INFORMATION REPORT',
    'Police Station: NCB Delhi Zonal Unit',
    'FIR No: 251/2026   Date: 30/09/2026',
    'Name: Vikram Sethi',
    'Age: 29   Gender: Male',
    'Address: Rohini Sector 7, Delhi',
  ].join('\n'),
  kit: [
    'HINDUSTAN ANTIBIOTICS LIMITED',
    'NARCOTIC DRUGS DETECTION KIT',
    'Batch No: HAL-NDK-2703',
    'Mfg: 03/2026   Exp: 02/2028',
    'Pimpri, Pune - 411 018',
  ].join('\n'),
};

export function parseDoc(text: string) {
  const get = (re: RegExp) => {
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    name: get(/name\s*[:\-.]?\s*([A-Za-z][A-Za-z .]{2,40})/i).replace(/\s+(age|s\/o|d\/o|father)\b.*$/i, '').trim(),
    age: get(/age\s*[:\-.]?\s*(\d{1,3})/i),
    gender: get(/gender\s*[:\-.]?\s*(male|female|other)/i).replace(/^./, (c) => c.toUpperCase()),
    fir: get(/fir\s*(?:no\.?|number)?\s*[:\-.#]?\s*(\d{1,5}\s*\/\s*\d{2,4})/i).replace(/\s/g, ''),
    batch: get(/(?:batch|lot)\s*(?:no\.?)?\s*[:\-.#]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i),
    expiry: get(/exp(?:iry)?\.?\s*(?:date)?\s*[:\-.]?\s*(\d{1,2}\s*[/\-.]\s*\d{2,4})/i).replace(/\s/g, ''),
  };
}

export function fieldsFor(kind: DocKind, parsed: ReturnType<typeof parseDoc>): DocField[] {
  const rows: DocField[] =
    kind === 'kit'
      ? [
          { label: 'Kit batch no.', value: parsed.batch, key: 'batch' },
          { label: 'Kit expiry', value: parsed.expiry, key: 'expiry' },
        ]
      : [
          { label: 'Name', value: parsed.name, key: 'name' },
          { label: 'Age', value: parsed.age, key: 'age' },
          { label: 'Gender', value: parsed.gender, key: 'gender' },
          { label: 'FIR no.', value: parsed.fir, key: 'fir' },
        ];
  return rows.filter((row) => row.value);
}

type Tess = { recognize: (image: string, lang: string) => Promise<{ data: { text: string } }> };

function loadTesseract(): Promise<Tess> {
  const w = globalThis as unknown as { Tesseract?: Tess };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('OCR did not start')));
    script.onerror = () => reject(new Error('OCR engine could not load'));
    document.head.appendChild(script);
  });
}

async function jpegBase64(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1200 }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return saved.base64 ?? '';
}

function bytesFromBase64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A black frame means the camera never saw the page. */
export async function photoLooksBlank(uri: string): Promise<boolean> {
  try {
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: 64 }).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.5, base64: true });
    if (!saved.base64) return true;
    const decoded = jpeg.decode(bytesFromBase64(saved.base64), { useTArray: true, formatAsRGBA: true });
    const data = decoded.data as Uint8Array;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      sum += data[i] + data[i + 1] + data[i + 2];
      n += 1;
    }
    return n > 0 && sum / (n * 3) < 22;
  } catch {
    return false;
  }
}

/** Read a document photo. Uses the Sarvam server when a backend URL is saved, otherwise browser OCR. */
export async function readDocument(uri: string, kind: DocKind, backend?: string, lang: Lang = 'en'): Promise<{ text: string; note?: string }> {
  const copy = L(lang);
  if (await photoLooksBlank(uri)) return { text: '', note: copy.docBlack };
  if (backend) {
    try {
      const image = await jpegBase64(uri);
      const res = await fetch(backend.replace(/\/$/, '') + '/api/doc/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, kind, language: lang === 'hi' ? 'hi-IN' : 'en-IN' }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text) return { text: data.text, note: data.error };
      if (data.error) return { text: '', note: data.error };
    } catch {
      return { text: '', note: copy.docUnreachable };
    }
  }
  if (Platform.OS === 'web') {
    try {
      const tess = await loadTesseract();
      const image = await jpegBase64(uri);
      const src = image ? `data:image/jpeg;base64,${image}` : uri;
      const result = await tess.recognize(src, lang === 'hi' ? 'hin+eng' : 'eng');
      return { text: result.data.text ?? '' };
    } catch (err) {
      return { text: '', note: err instanceof Error ? err.message : 'OCR failed' };
    }
  }
  return { text: '', note: copy.docNoServer };
}
