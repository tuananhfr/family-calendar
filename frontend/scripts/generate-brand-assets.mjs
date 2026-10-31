import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { generatePwaIcons } from './generate-pwa-icons.mjs';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'public/brand/family-calendar-mark-source-20261031.png');
const transparentSource=path.join(root,'public/brand/family-calendar-mark-transparent-source-20261031.png');
await sharp(transparentSource).resize(512,512).webp({lossless:true}).toFile(path.join(root,'public/brand/family-calendar-mark-20261031-transparent.webp'));
await generatePwaIcons();
// Thẻ chia sẻ chứa logo thật và chữ, không chứa dữ liệu riêng của gia đình.
const logo=await sharp(source).resize(360,360,{fit:'contain',background:'#fff'}).png().toBuffer();
const artwork=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f4f7fc"/>
<rect x="0" y="0" width="1200" height="14" fill="#0e2a47"/>
<rect x="0" y="616" width="1200" height="14" fill="#d32f2f"/>
<rect x="56" y="90" width="400" height="450" rx="28" fill="#fff"/>
<g font-family="Arial, sans-serif">
<text x="510" y="225" font-size="62" font-weight="700" fill="#0e2a47">Lịch <tspan fill="#d32f2f">Gia Đình</tspan></text>
<text x="512" y="298" font-size="34" font-weight="700" fill="#0e2a47">Kết nối yêu thương</text>
<text x="512" y="369" font-size="24" fill="#475569">Lịch chung · Nhắc việc</text>
<text x="512" y="410" font-size="24" fill="#475569">Chăm sóc gia đình mỗi ngày</text>
<text x="512" y="500" font-size="23" fill="#475569">lpc.vn/lich-gia-dinh</text>
</g></svg>`);
await sharp(artwork).composite([{input:logo,left:76,top:135}]).png().toFile(path.join(root,'public/social/family-calendar-20261031.png'));
console.log('Generated no-circle brand mark, PWA icons, favicon and 1200x630 social card.');
