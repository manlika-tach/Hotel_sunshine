/* ==========================================================================
   Boutique Hotel — script.js (ใช้ร่วมกันทุกหน้า)
   rooms.html / order.html / bill.html / admin.html
   สคริปต์ตรวจหน้าจาก element ที่มีอยู่ในหน้า จึงไม่ต้องแยกไฟล์ต่อหน้า
   หมายเหตุ: ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (เช่น Live Server) เพราะใช้ fetch('rooms.json')
   ========================================================================== */

/* ---------- ตั้งค่า URL ---------- */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby81NxbHb9ztrlYoqq4C21XuBgv3U3u1tkxbf7duxjIdyHN3Z01IPGsjcPAHQw6w9vmWw/exec'; // Web App ของ Google Apps Script
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQqOcVMo5_qUUHjyohlEiiMM8wbTl_wxBxUzYv81Q8q56Om1zY0Yyna4yo9_dv9guwzl87tuXmr8iZm/pub?gid=0&single=true&output=csv'; // CSV ที่เผยแพร่จาก Google Sheets

/* ==========================================================================
   Helpers
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  [].concat(children).forEach(c => {
    if (c === null || c === undefined) return;
    node.append(c.nodeType ? c : document.createTextNode(c));
  });
  return node;
}

const formatPrice = n => Number(n).toLocaleString('th-TH');

// 'yyyy-mm-dd' -> Date (เวลาท้องถิ่น ไม่เพี้ยนเพราะ timezone)
function parseLocalDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function formatThaiDate(value) {
  const d = value instanceof Date ? value : (parseLocalDate(value) || new Date(value));
  if (!d || isNaN(d)) return value || '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toDateInputValue(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ==========================================================================
   1) rooms.html — แสดงห้องพัก + กรอง
   ========================================================================== */
const TYPE_FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'standard', label: 'Standard' },
  { value: 'suite', label: 'Suite' },
  { value: 'deluxe', label: 'Deluxe' }
];
const FLOOR_FILTERS = [
  { value: 'all', label: 'ทุกชั้น' },
  { value: '1', label: 'ชั้น 1' },
  { value: '2', label: 'ชั้น 2' },
  { value: '3', label: 'ชั้น 3' }
];

async function initRooms() {
  const list = $('#room-list');
  const bar = $('#filter-bar');
  if (!list) return;

  list.textContent = 'กำลังโหลดข้อมูลห้องพัก...';

  let rooms = [];
  try {
    const res = await fetch('rooms.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    rooms = await res.json();
  } catch (err) {
    console.error(err);
    list.replaceChildren(el('p', {
      class: 'text-soft',
      text: 'ไม่สามารถโหลดข้อมูลห้องพักได้ กรุณาเปิดหน้านี้ผ่านเว็บเซิร์ฟเวอร์แล้วลองใหม่อีกครั้ง'
    }));
    return;
  }

  // ?type=xxx -> กรองอัตโนมัติ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) / รองรับ ?floor=n ด้วย
  const params = new URLSearchParams(location.search);
  const qType = (params.get('type') || 'all').toLowerCase();
  const qFloor = params.get('floor') || 'all';
  const state = {
    type: TYPE_FILTERS.some(f => f.value === qType) ? qType : 'all',
    floor: FLOOR_FILTERS.some(f => f.value === qFloor) ? qFloor : 'all'
  };

  function buildGroup(key, label, options) {
    const group = el('div', { class: 'filters', role: 'group', 'aria-label': label });
    options.forEach(opt => {
      const btn = el('button', {
        type: 'button',
        class: 'filter',
        text: opt.label,
        dataset: { key, value: opt.value }
      });
      btn.addEventListener('click', () => {
        state[key] = opt.value;
        render();
      });
      group.append(btn);
    });
    return group;
  }

  if (bar) {
    bar.replaceChildren(
      buildGroup('type', 'กรองตามประเภทห้องพัก', TYPE_FILTERS),
      buildGroup('floor', 'กรองตามชั้น', FLOOR_FILTERS)
    );
  }

  function roomCard(room) {
    const bookUrl = 'order.html?' + new URLSearchParams({
      roomNumber: room.roomNumber,
      roomType: room.typeName,
      price: room.price
    }).toString();

    const img = el('img', {
      src: room.image,
      alt: `ห้อง ${room.roomNumber} ${room.typeName}`,
      loading: 'lazy'
    });
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });

    return el('article', { class: 'room-card', dataset: { type: room.type, floor: room.floor } }, [
      el('div', { class: 'room-card__media' }, img),
      el('div', { class: 'room-card__body' }, [
        el('div', { class: 'room-card__meta' }, [
          el('span', { class: 'room-card__number', text: `ห้อง ${room.roomNumber}` }),
          el('span', { class: 'tag', text: room.typeName })
        ]),
        el('ul', { class: 'room-card__info' }, [
          el('li', { text: `ชั้น ${room.floor}` }),
          el('li', { text: `พักได้สูงสุด ${room.maxGuests} ท่าน` })
        ]),
        el('hr', { class: 'room-card__rule' }),
        el('p', { class: 'room-card__desc', text: room.description }),
        el('div', { class: 'room-card__footer' }, [
          el('div', { class: 'price' }, [`฿${formatPrice(room.price)} `, el('small', { text: '/ คืน' })]),
          el('a', { class: 'btn', href: bookUrl, text: 'จองห้องพัก' })
        ])
      ])
    ]);
  }

  function render() {
    const shown = rooms.filter(r =>
      (state.type === 'all' || r.type === state.type) &&
      (state.floor === 'all' || String(r.floor) === state.floor)
    );

    $$('.filter', bar || document).forEach(btn => {
      const active = state[btn.dataset.key] === btn.dataset.value;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (!shown.length) {
      list.replaceChildren(el('p', { class: 'text-soft', text: 'ไม่พบห้องพักตามเงื่อนไขที่เลือก' }));
    } else {
      list.replaceChildren(...shown.map(roomCard));
    }

    // อัปเดต URL ให้แชร์ลิงก์ที่กรองไว้ได้
    const p = new URLSearchParams();
    if (state.type !== 'all') p.set('type', state.type);
    if (state.floor !== 'all') p.set('floor', state.floor);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  render();
}

/* ==========================================================================
   2) order.html — ฟอร์มจอง
   ========================================================================== */

/* รายชื่อ 195 ประเทศ (สมาชิก UN 193 + นครรัฐวาติกัน + ปาเลสไตน์) */
const NATIONS_RAW = [
  'AF Afghanistan','AL Albania','DZ Algeria','AD Andorra','AO Angola','AG Antigua and Barbuda',
  'AR Argentina','AM Armenia','AU Australia','AT Austria','AZ Azerbaijan','BS Bahamas','BH Bahrain',
  'BD Bangladesh','BB Barbados','BY Belarus','BE Belgium','BZ Belize','BJ Benin','BT Bhutan',
  'BO Bolivia','BA Bosnia and Herzegovina','BW Botswana','BR Brazil','BN Brunei','BG Bulgaria',
  'BF Burkina Faso','BI Burundi','CV Cabo Verde','KH Cambodia','CM Cameroon','CA Canada',
  'CF Central African Republic','TD Chad','CL Chile','CN China','CO Colombia','KM Comoros',
  'CG Congo','CR Costa Rica','CI Côte d\'Ivoire','HR Croatia','CU Cuba','CY Cyprus','CZ Czechia',
  'CD DR Congo','DK Denmark','DJ Djibouti','DM Dominica','DO Dominican Republic','EC Ecuador',
  'EG Egypt','SV El Salvador','GQ Equatorial Guinea','ER Eritrea','EE Estonia','SZ Eswatini',
  'ET Ethiopia','FJ Fiji','FI Finland','FR France','GA Gabon','GM Gambia','GE Georgia','DE Germany',
  'GH Ghana','GR Greece','GD Grenada','GT Guatemala','GN Guinea','GW Guinea-Bissau','GY Guyana',
  'HT Haiti','HN Honduras','HU Hungary','IS Iceland','IN India','ID Indonesia','IR Iran','IQ Iraq',
  'IE Ireland','IL Israel','IT Italy','JM Jamaica','JP Japan','JO Jordan','KZ Kazakhstan','KE Kenya',
  'KI Kiribati','KP North Korea','KR South Korea','KW Kuwait','KG Kyrgyzstan','LA Laos','LV Latvia',
  'LB Lebanon','LS Lesotho','LR Liberia','LY Libya','LI Liechtenstein','LT Lithuania','LU Luxembourg',
  'MG Madagascar','MW Malawi','MY Malaysia','MV Maldives','ML Mali','MT Malta','MH Marshall Islands',
  'MR Mauritania','MU Mauritius','MX Mexico','FM Micronesia','MD Moldova','MC Monaco','MN Mongolia',
  'ME Montenegro','MA Morocco','MZ Mozambique','MM Myanmar','NA Namibia','NR Nauru','NP Nepal',
  'NL Netherlands','NZ New Zealand','NI Nicaragua','NE Niger','NG Nigeria','MK North Macedonia',
  'NO Norway','OM Oman','PK Pakistan','PW Palau','PS Palestine','PA Panama','PG Papua New Guinea',
  'PY Paraguay','PE Peru','PH Philippines','PL Poland','PT Portugal','QA Qatar','RO Romania',
  'RU Russia','RW Rwanda','KN Saint Kitts and Nevis','LC Saint Lucia','VC Saint Vincent and the Grenadines',
  'WS Samoa','SM San Marino','ST São Tomé and Príncipe','SA Saudi Arabia','SN Senegal','RS Serbia',
  'SC Seychelles','SL Sierra Leone','SG Singapore','SK Slovakia','SI Slovenia','SB Solomon Islands',
  'SO Somalia','ZA South Africa','SS South Sudan','ES Spain','LK Sri Lanka','SD Sudan','SR Suriname',
  'SE Sweden','CH Switzerland','SY Syria','TJ Tajikistan','TZ Tanzania','TH Thailand','TL Timor-Leste',
  'TG Togo','TO Tonga','TT Trinidad and Tobago','TN Tunisia','TR Türkiye','TM Turkmenistan','TV Tuvalu',
  'UG Uganda','UA Ukraine','AE United Arab Emirates','GB United Kingdom','US United States',
  'UY Uruguay','UZ Uzbekistan','VU Vanuatu','VA Vatican City','VE Venezuela','VN Vietnam','YE Yemen',
  'ZM Zambia','ZW Zimbabwe'
];

const flagEmoji = code =>
  String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));

const NATIONS = NATIONS_RAW
  .map(s => {
    const i = s.indexOf(' ');
    const code = s.slice(0, i);
    const name = s.slice(i + 1);
    return { code, name, value: `${flagEmoji(code)} ${name}` };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

function setupNationField() {
  const input = $('#nation');
  if (!input) return;

  let dl = $('#nationList');
  if (!dl) {
    dl = el('datalist', { id: 'nationList' });
    input.after(dl);
  }
  input.setAttribute('list', 'nationList');
  input.setAttribute('autocomplete', 'off');
  dl.replaceChildren(...NATIONS.map(n => el('option', { value: n.value })));

  // ถ้าพิมพ์แค่ชื่อ (เช่น "thailand") ให้เติมธงอัตโนมัติเมื่อออกจากช่อง
  input.addEventListener('change', () => {
    const typed = input.value.trim().toLowerCase();
    const hit = NATIONS.find(n => n.value.toLowerCase() === typed || n.name.toLowerCase() === typed);
    if (hit) input.value = hit.value;
  });
}

const isValidNation = v => NATIONS.some(n => n.value === v);

// ตรวจเลขบัตรประชาชนไทย: ต้องเป็นตัวเลข 13 หลัก (ไม่ตรวจ checksum เพื่อให้กรอกข้อมูลทดสอบได้)
function isValidThaiId(id) {
  return /^\d{13}$/.test(id);
}

function fillFromUrl() {
  const params = new URLSearchParams(location.search);
  [['roomNumber', 'roomNumber'], ['roomType', 'roomType'], ['price', 'price']].forEach(([param, id]) => {
    const field = document.getElementById(id);
    const val = params.get(param);
    if (field && val !== null) field.value = val;
  });
}

function setupDateLimits() {
  const inEl = $('#checkIn');
  const outEl = $('#checkOut');
  if (!inEl || !outEl) return;
  const today = new Date();
  inEl.min = toDateInputValue(today);

  const sync = () => {
    const start = parseLocalDate(inEl.value) || today;
    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    outEl.min = toDateInputValue(next);
    if (outEl.value && outEl.value < outEl.min) outEl.value = '';
  };
  inEl.addEventListener('change', sync);
  sync();
}

function generateBookingId(now) {
  const ymd = toDateInputValue(now).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${ymd}${rand}`;
}

function initOrder() {
  const form = $('#orderForm');
  if (!form) return;

  fillFromUrl();
  setupNationField();
  setupDateLimits();

  let submitting = false;

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (submitting) return;

    const val = id => (document.getElementById(id)?.value || '').trim();
    const radio = name => $(`input[name="${name}"]:checked`)?.value || '';
    const fail = (msg, id) => { alert(msg); if (id) document.getElementById(id)?.focus(); };

    if (!form.reportValidity()) return;
    if (!val('roomNumber') || !val('roomType')) return fail('กรุณาเลือกห้องพักจากหน้า "ห้องพักทั้งหมด" ก่อนทำรายการจอง');

    const thaiId = val('ThaiNationIDCard');
    const passport = val('passport');
    if (!thaiId && !passport) return fail('กรุณากรอกเลขบัตรประชาชน หรือเลขพาสปอร์ตอย่างน้อย 1 อย่าง', 'ThaiNationIDCard');
    if (thaiId && !isValidThaiId(thaiId)) return fail('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลัก)', 'ThaiNationIDCard');
    if (!isValidNation(val('nation'))) return fail('กรุณาเลือกสัญชาติจากรายการ', 'nation');
    if (!radio('visaType')) return fail('กรุณาเลือกประเภทวีซ่า');
    if (!radio('paymentMethod')) return fail('กรุณาเลือกประเภทการชำระเงิน');

    const checkIn = val('checkIn');
    const checkOut = val('checkOut');
    if (checkOut <= checkIn) return fail('วันเช็คเอาต์ต้องอยู่หลังวันเช็คอิน', 'checkOut');

    // payload ส่งเข้า Google Apps Script — 13 field ตามลำดับ
    const payload = {
      fullName: val('fullName'),
      ThaiNationIDCard: thaiId,
      passport: passport,
      nation: val('nation'),
      roomNumber: val('roomNumber'),
      roomType: val('roomType'),
      guests: val('guests'),
      checkIn: checkIn,
      checkOut: checkOut,
      visaType: radio('visaType'),
      paymentMethod: radio('paymentMethod'),
      email: val('email'),
      phone: val('phone')
    };

    // ข้อมูลสำหรับใบเสร็จ (bill.html)
    const now = new Date();
    const nights = Math.round((parseLocalDate(checkOut) - parseLocalDate(checkIn)) / 86400000);
    const price = Number(val('price')) || 0;
    const receiptData = {
      ...payload,
      address: val('address'),
      price: price,
      nights: nights,
      total: price * nights,
      bookingDate: now.toISOString(),
      bookingId: generateBookingId(now)
    };

    try {
      localStorage.setItem('latestBooking', JSON.stringify(receiptData));
    } catch (err) {
      console.error(err);
    }

    submitting = true;
    const submitBtn = $('button[type="submit"]', form);
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'bill.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      submitting = false;
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================================
   3) bill.html — ใบเสร็จ
   ========================================================================== */
function initBill() {
  const tbody = $('#bill-items tbody') || $('#bill-items');
  if (!$('#bill-bookingId') && !tbody) return;

  let data = null;
  try {
    data = JSON.parse(localStorage.getItem('latestBooking') || 'null');
  } catch (err) {
    console.error(err);
  }

  const setText = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };

  if (!data) {
    ['bill-fullName', 'bill-address', 'bill-email', 'bill-date', 'bill-checkIn', 'bill-checkOut', 'bill-bookingId']
      .forEach(id => setText(id, '-'));
    if (tbody) {
      const td = el('td', { colspan: 3, text: 'ไม่พบข้อมูลการจอง กรุณาทำรายการจองใหม่' });
      tbody.replaceChildren(el('tr', {}, td));
    }
    return;
  }

  setText('bill-fullName', data.fullName || '-');
  setText('bill-address', data.address || '-');
  setText('bill-email', data.email || '-');
  setText('bill-date', formatThaiDate(new Date(data.bookingDate)));
  setText('bill-checkIn', formatThaiDate(data.checkIn));
  setText('bill-checkOut', formatThaiDate(data.checkOut));
  setText('bill-bookingId', data.bookingId || '-');

  if (tbody) {
    const row = el('tr', {}, [
      el('td', { text: `${formatThaiDate(data.checkIn)} - ${formatThaiDate(data.checkOut)}` }),
      el('td', { text: `ห้อง ${data.roomNumber} - ${data.roomType}` }),
      el('td', { text: data.paymentMethod || '-' })
    ]);
    tbody.replaceChildren(row);
  }
}

/* ==========================================================================
   4) admin.html — ตารางการจองจาก CSV
   ========================================================================== */

// parse CSV เอง: รองรับ "…" , "" (escape), ขึ้นบรรทัดใหม่ในเซลล์, CRLF/LF, BOM
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter(r => r.some(c => c.trim() !== ''));
}

async function initAdmin() {
  const tbody = $('#ordersTable tbody');
  if (!tbody) return;

  const COLS = 14; // วันเวลาที่จอง + 13 field
  const message = text => {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: COLS, text })));
  };

  message('กำลังโหลดข้อมูล...');

  try {
    const url = CSV_URL + (CSV_URL.includes('?') ? '&' : '?') + 't=' + Date.now(); // กันแคช
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());

    const dataRows = rows.slice(1).reverse(); // ตัดหัวตาราง + ล่าสุดขึ้นก่อน
    if (!dataRows.length) return message('ยังไม่มีรายการจอง');

    tbody.replaceChildren(...dataRows.map(r =>
      el('tr', {}, Array.from({ length: COLS }, (_, i) => el('td', { text: r[i] ?? '' })))
    ));
  } catch (err) {
    console.error(err);
    message('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบ CSV_URL แล้วลองใหม่อีกครั้ง');
  }
}

/* ==========================================================================
   เมนูมือถือ (ใช้ร่วมกันทุกหน้า)
   ========================================================================== */
function initNav() {
  const toggle = $('.nav__toggle');
  const links = $('#nav-links');
  if (!toggle || !links) return;

  const setOpen = open => {
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
  };
  toggle.addEventListener('click', () => setOpen(!links.classList.contains('is-open')));
  links.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}

/* ==========================================================================
   เริ่มทำงาน
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initRooms();
  initOrder();
  initBill();
  initAdmin();
});
