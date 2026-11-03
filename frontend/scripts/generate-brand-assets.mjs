import path from 'node:path';
import sharp from 'sharp';
import { generatePwaIcons } from './generate-pwa-icons.mjs';

const root = path.resolve(import.meta.dirname, '..');
// Background-removed copy of the supplied logo; shapes and colors must stay untouched.
const source = path.join(root, 'assets/brand/family-calendar-mark-transparent-source-20261031.png');
await sharp(source).resize(512, 512).webp({ lossless: true }).toFile(path.join(root, 'public/brand/family-calendar-mark-20261103-transparent.webp'));
await generatePwaIcons();

// The share card must never contain family data.
const logo = await sharp(source).resize(350, 350, { fit: 'contain', background: '#00000000' }).png().toBuffer();
const artwork = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f4f7fc"/>
<rect y="618" width="1200" height="12" fill="#d32f2f"/>
<g font-family="Arial, sans-serif">
<text x="470" y="193" font-size="62" font-weight="700" fill="#0e2a47">Lịch <tspan fill="#d32f2f">Gia Đình</tspan></text>
<text x="472" y="252" font-size="28" fill="#475569">— Gắn kết gia đình.</text>
<text x="470" y="355" font-size="48" font-weight="700" fill="#0e2a47">Gắn kết gia đình</text>
<text x="470" y="415" font-size="48" font-weight="700" fill="#0e2a47">qua từng ngày.</text>
<text x="472" y="500" font-size="23" fill="#475569">lpc.vn/lich-gia-dinh</text>
</g></svg>`);
await sharp(artwork).composite([{ input: logo, left: 64, top: 136 }]).png().toFile(path.join(root, 'public/social/family-calendar-20261103.png'));
console.log('Generated transparent brand/PWA icons, favicon and 1200×630 social card.');
