// ============================================================================
// ГРАВЮРА РЕЛИКВИЙ. Стиль: каталожная пластина XIX века.
// Три разных силуэта на класс (выбор по зерну имени) + настоящая штриховка.
// Никаких эмодзи, никаких наклеек: только контур, штрих и латунь.
// ============================================================================

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};
const f = (n, d = 1) => Number(n.toFixed(d));

/** Штриховка внутри области: линии под углом, с шагом. */
function hatch(id, { x = 0, y = 0, w = 100, h = 100, gap = 3.2, angle = 35, width = 0.45, op = 0.32 }) {
  let out = '';
  const rad = (angle * Math.PI) / 180;
  const diag = Math.hypot(w, h);
  const n = Math.ceil(diag / gap);
  for (let i = 0; i <= n; i++) {
    const t = i * gap - diag / 2;
    const cx = x + w / 2, cy = y + h / 2;
    const dx = Math.cos(rad) * diag / 2, dy = Math.sin(rad) * diag / 2;
    const nx = Math.cos(rad + Math.PI / 2) * t, ny = Math.sin(rad + Math.PI / 2) * t;
    out += `<line x1="${f(cx - dx + nx)}" y1="${f(cy - dy + ny)}" x2="${f(cx + dx + nx)}" y2="${f(cy + dy + ny)}" stroke="currentColor" stroke-width="${width}" opacity="${op}"/>`;
  }
  return `<g clip-path="url(#${id}-clip)">${out}</g>`;
}

/** Точки-«зерно» для каменных и костяных поверхностей. */
function stipple(id, seed, count = 34, { x = 10, y = 10, w = 80, h = 80 } = {}) {
  let out = '';
  let s = seed * 9973;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${f(x + rnd() * w)}" cy="${f(y + rnd() * h)}" r="${f(0.35 + rnd() * 0.5, 2)}" fill="currentColor" opacity="${f(0.16 + rnd() * 0.28, 2)}"/>`;
  }
  return `<g clip-path="url(#${id}-clip)">${out}</g>`;
}

// ---------------------------------------------------------------------------
// ЯНТАРЬ — три формы капли
const AMBER = [
  // вытянутая капля с насекомым
  (s, id) => {
    const d = 'M50 14 C60 30 70 44 70 58 C70 74 61 86 50 86 C39 86 30 74 30 58 C30 44 40 30 50 14 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-aus)" stroke="currentColor" stroke-width="1.5"/>
        ${hatch(id, { gap: 2.6, angle: 62, op: .22, width: .4 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M50 24 C56 40 62 50 62 60 C62 70 57 78 50 78" fill="none" stroke="currentColor" stroke-width=".7" opacity=".55"/>
        <g stroke="currentColor" stroke-width="1" fill="none" opacity=".9">
          <ellipse cx="50" cy="56" rx="3.4" ry="6.4"/>
          <path d="M46.6 53 L41 47.5 M53.4 53 L59 47.5 M46.6 59 L41.5 64.5 M53.4 59 L58.5 64.5 M50 49.5 L50 45"/>
          <path d="M50 45 L46 41 M50 45 L54 41" stroke-width=".7"/>
        </g>`,
    };
  },
  // округлый «пузырь» с пузырьком воздуха
  (s, id) => {
    const d = 'M50 18 C68 18 80 33 80 51 C80 70 68 84 50 84 C32 84 20 70 20 51 C20 33 32 18 50 18 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-aus)" stroke="currentColor" stroke-width="1.5"/>
        ${hatch(id, { gap: 3.4, angle: 20, op: .18 })}
        ${stipple(id, s, 30, { x: 24, y: 24, w: 52, h: 54 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="43" cy="44" r="7" fill="none" stroke="currentColor" stroke-width=".9" opacity=".8"/>
        <circle cx="43" cy="44" r="2.6" fill="none" stroke="currentColor" stroke-width=".7" opacity=".6"/>
        <path d="M60 62 q6 -4 9 0 q-3 6 -9 4" fill="none" stroke="currentColor" stroke-width=".8" opacity=".6"/>`,
    };
  },
  // гранёный кусок с двумя пчёлами
  (s, id) => {
    const d = 'M30 30 L50 20 L72 32 L76 56 L58 80 L36 74 L24 52 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-aus)" stroke="currentColor" stroke-width="1.5"/>
        ${hatch(id, { gap: 3, angle: 48, op: .22 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M50 20 L44 50 L36 74 M44 50 L76 56 M44 50 L24 52" stroke="currentColor" stroke-width=".65" opacity=".55" fill="none"/>
        <g stroke="currentColor" stroke-width=".9" fill="none" opacity=".85">
          <ellipse cx="57" cy="40" rx="2.6" ry="4.6"/><path d="M54.4 38 L51 35 M59.6 38 L63 35"/>
          <ellipse cx="35" cy="58" rx="2.2" ry="4"/><path d="M32.8 56 L30 53.5"/>
        </g>`,
    };
  },
];

// ---------------------------------------------------------------------------
// КОСТЬ — резьба
const BONE = [
  // позвонок
  (s, id) => {
    const d = 'M50 16 C58 16 63 22 61 29 C70 31 74 39 70 47 C66 55 57 57 50 54 C43 57 34 55 30 47 C26 39 30 31 39 29 C37 22 42 16 50 16 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-bon)" stroke="currentColor" stroke-width="1.5"/>
        ${hatch(id, { gap: 3, angle: 70, op: .2 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M50 30 L50 54 M40 40 Q50 45 60 40 M40 48 Q50 53 60 48" stroke="currentColor" stroke-width=".8" fill="none" opacity=".6"/>
        <circle cx="50" cy="54" r="3.4" fill="none" stroke="currentColor" stroke-width=".9" opacity=".7"/>
        <path d="M50 67 C47 72 45 78 46 84 M50 67 C53 72 55 78 54 84" stroke="currentColor" stroke-width=".9" fill="none" opacity=".7"/>`,
    };
  },
  // гребень с зубцами
  (s, id) => {
    const d = 'M22 84 L22 46 C22 32 34 22 50 22 C66 22 78 32 78 46 L78 84 L68 84 L68 50 L62 50 L62 84 L54 84 L54 50 L46 50 L46 84 L38 84 L38 50 L32 50 L32 84 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-bon)" stroke="currentColor" stroke-width="1.3"/>
        ${hatch(id, { gap: 3.2, angle: 80, op: .22 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3"/>
        <path d="M26 42 C34 32 66 32 74 42" stroke="currentColor" stroke-width=".8" fill="none" opacity=".6"/>
        <circle cx="40" cy="36" r="2" fill="none" stroke="currentColor" stroke-width=".7" opacity=".7"/>
        <circle cx="60" cy="36" r="2" fill="none" stroke="currentColor" stroke-width=".7" opacity=".7"/>`,
    };
  },
  // трубка/мундштук
  (s, id) => {
    const d = 'M26 78 C26 60 32 44 46 32 C54 25 66 22 74 26 C80 29 80 36 74 39 C66 43 60 47 56 55 C52 64 52 72 54 80 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-bon)" stroke="currentColor" stroke-width="1.4"/>
        ${hatch(id, { gap: 2.8, angle: 55, op: .24 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <ellipse cx="70" cy="32" rx="6" ry="4" transform="rotate(20 70 32)" fill="#0b0e12" stroke="currentColor" stroke-width=".9"/>
        <path d="M34 66 C36 54 40 44 48 36" stroke="currentColor" stroke-width=".7" fill="none" opacity=".55"/>
        <path d="M40 74 C42 62 46 52 53 45" stroke="currentColor" stroke-width=".7" fill="none" opacity=".4"/>`,
    };
  },
];

// ---------------------------------------------------------------------------
// ФАРФОР — сосуды
const PORCEL = [
  // чашка с трещиной и ручкой
  (s, id) => {
    const d = 'M24 30 L76 30 C76 50 70 60 62 64 C70 68 72 76 72 82 L28 82 C28 76 30 68 38 64 C30 60 24 50 24 30 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-por)" stroke="currentColor" stroke-width="1.4"/>
        ${hatch(id, { gap: 4, angle: 8, op: .14 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M76 36 C88 38 88 54 76 56" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <ellipse cx="50" cy="30" rx="26" ry="4.2" fill="none" stroke="currentColor" stroke-width="1"/>
        <path d="M30 38 Q50 43 70 38" stroke="currentColor" stroke-width=".6" fill="none" opacity=".5"/>
        <path d="M50 82 L47 70 L53 63 L48 52 L51 43" stroke="currentColor" stroke-width=".8" fill="none" opacity=".8"/>`,
    };
  },
  // ваза с узким горлом
  (s, id) => {
    const d = 'M42 20 L58 20 L58 34 C68 42 74 54 70 68 C67 80 59 86 50 86 C41 86 33 80 30 68 C26 54 32 42 42 34 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-por)" stroke="currentColor" stroke-width="1.4"/>
        ${hatch(id, { gap: 3.6, angle: 20, op: .16 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <ellipse cx="50" cy="20" rx="8" ry="2.6" fill="none" stroke="currentColor" stroke-width="1"/>
        <path d="M50 20 L50 34" stroke="currentColor" stroke-width=".7" opacity=".5"/>
        <g stroke="currentColor" stroke-width=".7" fill="none" opacity=".65">
          <path d="M36 60 Q50 52 64 60"/><path d="M34 69 Q50 61 66 69"/>
          <path d="M40 48 q4 -6 8 0 q4 6 8 0"/>
        </g>`,
    };
  },
  // блюдце с узором
  (s, id) => {
    const d = 'M18 62 C18 46 32 36 50 36 C68 36 82 46 82 62 C82 74 68 82 50 82 C32 82 18 74 18 62 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-por)" stroke="currentColor" stroke-width="1.4"/>
        ${hatch(id, { gap: 3.4, angle: 15, op: .16 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <ellipse cx="50" cy="62" rx="22" ry="12" fill="none" stroke="currentColor" stroke-width=".9" opacity=".75"/>
        <ellipse cx="50" cy="62" rx="12" ry="6.5" fill="none" stroke="currentColor" stroke-width=".7" opacity=".55"/>
        <g stroke="currentColor" stroke-width=".7" fill="none" opacity=".6">
          <path d="M50 50 l3 6 l-3 6 l-3 -6 z"/>
        </g>
        <path d="M30 78 Q50 84 70 78" stroke="currentColor" stroke-width=".7" fill="none" opacity=".5"/>`,
    };
  },
];

// ---------------------------------------------------------------------------
// СТЕКЛО — линзы и осколки
const GLASS = [
  // линза в оправе
  (s, id) => {
    const d = 'M50 18 C68 18 82 32 82 50 C82 68 68 82 50 82 C32 82 18 68 18 50 C18 32 32 18 50 18 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-gla)" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="23" fill="none" stroke="currentColor" stroke-width=".7" opacity=".45"/>
        <path d="M28 44 Q50 30 72 44" stroke="currentColor" stroke-width="1" fill="none" opacity=".75"/>
        <path d="M30 58 Q50 72 70 58" stroke="currentColor" stroke-width="1" fill="none" opacity=".55"/>
        <path d="M33 33 L26 24 M67 33 L74 24" stroke="currentColor" stroke-width=".8" opacity=".5"/>
        ${hatch(id, { gap: 5, angle: 40, op: .1, width: .5 })}`,
    };
  },
  // осколок витража
  (s, id) => {
    const d = 'M34 16 L66 22 L80 50 L62 86 L30 78 L20 44 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-gla)" stroke="currentColor" stroke-width="1.4"/>
        <path d="M34 16 L50 52 L30 78 M50 52 L80 50 M50 52 L62 86" stroke="currentColor" stroke-width=".7" opacity=".5" fill="none"/>
        ${hatch(id, { gap: 4, angle: 70, op: .12 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
    };
  },
  // капля-плафон
  (s, id) => {
    const d = 'M50 14 C50 14 76 44 76 62 C76 76 65 86 50 86 C35 86 24 76 24 62 C24 44 50 14 50 14 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-gla)" stroke="currentColor" stroke-width="1.4"/>
        <path d="M50 24 C50 24 66 46 66 62 C66 71 59 78 50 78" fill="none" stroke="currentColor" stroke-width=".75" opacity=".6"/>
        <ellipse cx="42" cy="52" rx="6" ry="10" fill="none" stroke="currentColor" stroke-width=".7" opacity=".4"/>
        ${hatch(id, { gap: 4.2, angle: 30, op: .1 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
    };
  },
];

// ---------------------------------------------------------------------------
// ЛАТУНЬ — механизмы
function gearPath(cx, cy, rOut, teeth, depth, phase = 0) {
  const step = (Math.PI * 2) / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a0 = phase + i * step, a1 = a0 + step * 0.3, a2 = a0 + step * 0.5, a3 = a0 + step * 0.8;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a0) * rOut)},${f(cy + Math.sin(a0) * rOut)}`;
    d += `L${f(cx + Math.cos(a1) * (rOut + depth))},${f(cy + Math.sin(a1) * (rOut + depth))}`;
    d += `L${f(cx + Math.cos(a2) * (rOut + depth))},${f(cy + Math.sin(a2) * (rOut + depth))}`;
    d += `L${f(cx + Math.cos(a3) * rOut)},${f(cy + Math.sin(a3) * rOut)}`;
  }
  return d + 'Z';
}

const BRASS = [
  // шестерня с дырой
  (s, id) => {
    const teeth = 9 + Math.round(s * 5);
    const d = gearPath(50, 50, 25, teeth, 7);
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-bra)" stroke="currentColor" stroke-width="1.3"/>
        ${hatch(id, { gap: 3.4, angle: 60, op: .2 })}
        <circle cx="50" cy="50" r="13" fill="#0a0d11" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="50" cy="50" r="5" fill="none" stroke="currentColor" stroke-width=".9" opacity=".7"/>
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3"/>
        <g stroke="currentColor" stroke-width=".7" opacity=".5" fill="none">
          <circle cx="50" cy="50" r="20"/><path d="M50 30 L50 37 M70 50 L63 50 M50 70 L50 63 M30 50 L37 50"/>
        </g>`,
    };
  },
  // ключ бородкой
  (s, id) => {
    const d = 'M46 14 L54 14 L54 58 L58 58 L58 66 L54 66 L54 74 L60 74 L60 82 L46 82 L46 74 L50 74 L50 66 L46 66 L46 58 L50 58 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-bra)" stroke="currentColor" stroke-width="1.3"/>
        ${hatch(id, { gap: 3, angle: 80, op: .2 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="50" cy="30" r="11" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="50" cy="30" r="6" fill="#0a0d11" stroke="currentColor" stroke-width="1"/>
        <path d="M61 26 h5 M60 34 h4" stroke="currentColor" stroke-width="1.4"/>`,
    };
  },
  // верньер / метроном — треугольная шкала
  (s, id) => {
    const d = 'M50 14 L82 82 L18 82 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-bra)" stroke="currentColor" stroke-width="1.4"/>
        ${hatch(id, { gap: 3.6, angle: 30, op: .16 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M40 72 L50 30 L60 72" fill="none" stroke="currentColor" stroke-width=".7" opacity=".5"/>
        <g stroke="currentColor" stroke-width=".8" opacity=".7">
          <path d="M32 74 L36 74 M40 62 L45 62 M48 50 L53 50 M56 38 L60 38"/>
        </g>
        <circle cx="50" cy="76" r="2.6" fill="none" stroke="currentColor" stroke-width=".8" opacity=".8"/>`,
    };
  },
];

// ---------------------------------------------------------------------------
// ЧЕРНИЛА — пятна и печати
const INK = [
  // клякса с лучами
  (s, id) => {
    let d = 'M50 20';
    const arms = 11;
    for (let i = 0; i < arms; i++) {
      const a = -Math.PI / 2 + (i / arms) * Math.PI * 2;
      const len = 14 + Math.sin(i * 1.9 + s * 7) * 8;
      const w = Math.sin(a * 3 + s * 5) * 4;
      d += `L${f(50 + Math.cos(a) * (10 + len) + Math.sin(a) * w)},${f(50 + Math.sin(a) * (10 + len) + Math.cos(a) * w)}`;
    }
    d += 'Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-ink)" stroke="currentColor" stroke-width="1.2"/>
        ${stipple(id, s, 26, { x: 22, y: 22, w: 56, h: 56 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <path d="M38 50 Q46 38 58 42 Q68 46 62 56 Q56 66 42 60" fill="none" stroke="currentColor" stroke-width=".8" opacity=".55"/>
        <circle cx="50" cy="50" r="2.2" fill="none" stroke="currentColor" stroke-width=".9" opacity=".8"/>`,
    };
  },
  // печать с гербом
  (s, id) => {
    const d = 'M50 16 C66 16 78 28 78 44 C78 60 66 72 50 72 C34 72 22 60 22 44 C22 28 34 16 50 16 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-ink)" stroke="currentColor" stroke-width="1.3"/>
        ${hatch(id, { gap: 4, angle: 25, op: .15 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="50" cy="44" r="15" fill="none" stroke="currentColor" stroke-width=".8" opacity=".6"/>
        <path d="M50 32 L58 40 L50 58 L42 40 Z" fill="none" stroke="currentColor" stroke-width=".9" opacity=".8"/>
        <path d="M38 74 L50 68 L62 74 L58 86 L42 86 Z" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".85"/>`,
    };
  },
  // пятно с пером
  (s, id) => {
    const d = 'M28 66 C24 48 34 30 52 24 C70 18 80 30 76 46 C72 62 56 74 40 76 C34 77 30 73 28 66 Z';
    return {
      defs: `<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`,
      body: `<path d="${d}" fill="url(#${id}-ink)" stroke="currentColor" stroke-width="1.2"/>
        ${stipple(id, s, 22, { x: 26, y: 26, w: 50, h: 46 })}
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <path d="M34 62 C42 44 56 30 74 24" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".85"/>
        <g stroke="currentColor" stroke-width=".6" opacity=".55" fill="none">
          <path d="M40 58 L36 50 M46 50 L42 42 M52 43 L49 35 M58 37 L56 30 M64 32 L63 25"/>
        </g>`,
    };
  },
];

const SETS = { amber: AMBER, bone: BONE, porcel: PORCEL, glass: GLASS, brass: BRASS, ink: INK };

// Имя → индекс силуэта. Гравюра должна соответствовать названию.
const VARIANT_BY_NAME = {
  'Слеза софоры': 0, 'Пчелиный гребень': 2, 'Янтарь-пузырь': 1, 'Сердце капли': 0,
  'Смола с пальцем': 2, 'Пчела в камне': 2,
  'Костяной гребень': 1, 'Позвонок старца': 0, 'Челюсть певца': 1, 'Трубка из бедра': 2,
  'Палец аббата': 0, 'Клык с насечкой': 2,
  'Чашка с трещиной': 0, 'Блюдце русалки': 2, 'Ваза без дна': 1, 'Голова куклы': 1,
  'Суповой сервиз': 0, 'Пиала с изъяном': 2,
  'Слепок окна': 1, 'Мениск': 0, 'Линза часовщика': 0, 'Капля собора': 2,
  'Плафон': 2, 'Осколок витража': 1,
  'Шестерня без зуба': 0, 'Ключ от ниоткуда': 1, 'Верньер': 2, 'Гиря в оправе': 0,
  'Метроном': 2, 'Замок без двери': 1,
  'Пятно чернил': 0, 'Обрывок письма': 2, 'Подпись без имени': 1, 'Печать нотариуса': 1,
  'Письмо без адреса': 2, 'Клякса в форме сердца': 0,
};

const GRADS = {
  aus: `<linearGradient id="aus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe1a0" stop-opacity=".9"/><stop offset=".45" stop-color="#d9932f" stop-opacity=".62"/><stop offset="1" stop-color="#6e3c0e" stop-opacity=".9"/></linearGradient>`,
  bon: `<linearGradient id="bon" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fffaf0" stop-opacity=".92"/><stop offset=".55" stop-color="#d8c9ae" stop-opacity=".5"/><stop offset="1" stop-color="#6f6553" stop-opacity=".78"/></linearGradient>`,
  por: `<linearGradient id="por" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e2f6ff" stop-opacity=".85"/><stop offset=".55" stop-color="#6aa9c7" stop-opacity=".4"/><stop offset="1" stop-color="#22465a" stop-opacity=".85"/></linearGradient>`,
  gla: `<radialGradient id="gla" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#e0fff7" stop-opacity=".8"/><stop offset=".45" stop-color="#5ac3a5" stop-opacity=".34"/><stop offset="1" stop-color="#0d332c" stop-opacity=".88"/></radialGradient>`,
  bra: `<linearGradient id="bra" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#ffe3ae" stop-opacity=".9"/><stop offset=".5" stop-color="#b47a36" stop-opacity=".6"/><stop offset="1" stop-color="#4d300f" stop-opacity=".88"/></linearGradient>`,
  ink: `<radialGradient id="ink" cx=".42" cy=".34" r=".85"><stop offset="0" stop-color="#cbbcff" stop-opacity=".45"/><stop offset=".5" stop-color="#5d4b8f" stop-opacity=".45"/><stop offset="1" stop-color="#170f29" stop-opacity=".92"/></radialGradient>`,
};

const PIPS = { common: 1, fine: 2, rare: 3, fabled: 4 };

/** Гравюра реликвии. uid обязателен, чтобы градиенты и клипы не пересекались. */
const GRAD_KEY = { amber: 'aus', bone: 'bon', porcel: 'por', glass: 'gla', brass: 'bra', ink: 'ink' };

/** Орнамент вокруг предмета — свой у каждого имени. Тонкая латунная вязь. */
function ornament(seed, rar) {
  const kind = Math.floor(seed * 5) % 5;
  const ring = `<circle cx="50" cy="50" r="${rar >= 3 ? 41 : 38}" fill="none" stroke="currentColor" stroke-width=".45" opacity=".38" stroke-dasharray="${rar >= 3 ? '1 3' : '2 6'}"/>`;
  const marks = (n, r0, r1, w = .5) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + seed * 3;
    return `<line x1="${f(50 + Math.cos(a) * r0)}" y1="${f(50 + Math.sin(a) * r0)}" x2="${f(50 + Math.cos(a) * r1)}" y2="${f(50 + Math.sin(a) * r1)}" stroke="currentColor" stroke-width="${w}" opacity=".34"/>`;
  }).join('');
  if (kind === 0) return ring + marks(12, 36, 41);
  if (kind === 1) return marks(8, 34, 42, .55) + marks(8, 30, 32, .4);
  if (kind === 2) return `<path d="M50 9 L54 16 L50 23 L46 16 Z M50 91 L54 84 L50 77 L46 84 Z" fill="none" stroke="currentColor" stroke-width=".5" opacity=".4"/>` + ring;
  if (kind === 3) return `<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width=".4" opacity=".3"/>` + marks(4, 40, 45, .6) + marks(4, 33, 35, .4);
  return ring + `<circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width=".35" opacity=".22"/>`;
}

export function relicArt(relic) {
  const seed = hash(relic.name + relic.class);
  const set = SETS[relic.class] || SETS.amber;
  const byName = VARIANT_BY_NAME[relic.name];
  const variant = byName != null ? byName % set.length : Math.floor(seed * set.length) % set.length;
  const id = `q${Math.floor(seed * 1e7).toString(36)}${(relic.uid || '').replace(/\D/g, '').slice(-3)}`;
  const { defs, body } = set[variant](seed, id);
  const grad = GRADS[GRAD_KEY[relic.class] || 'aus'].replaceAll('id="', `id="${id}-`);
  const rar = PIPS[relic.rarity] || 1;
  return `<svg viewBox="10 6 80 90" class="art" aria-hidden="true" style="color:currentColor">
    <defs>${grad}${defs}</defs>
    <g opacity=".85">${ornament(seed, rar)}</g>
    ${body}</svg>`;
}

export function crest(size = 76) {
  const id = Math.random().toString(36).slice(2, 8);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" aria-hidden="true">
    <defs><linearGradient id="cg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe6b8"/><stop offset=".55" stop-color="#d9a253"/><stop offset="1" stop-color="#7d5323"/>
    </linearGradient>
    <clipPath id="cc${id}"><circle cx="50" cy="50" r="40"/></clipPath></defs>
    <circle cx="50" cy="50" r="43" stroke="url(#cg${id})" stroke-width="1" opacity=".85"/>
    <circle cx="50" cy="50" r="37" stroke="url(#cg${id})" stroke-width=".5" opacity=".5" stroke-dasharray="1 5"/>
    <g clip-path="url(#cc${id})" opacity=".5">
      ${Array.from({ length: 22 }, (_, i) => `<line x1="14" y1="${10 + i * 4}" x2="86" y2="${-4 + i * 4}" stroke="url(#cg${id})" stroke-width=".3"/>`).join('')}
    </g>
    <path d="M50 20 L70 40 L50 80 L30 40 Z" stroke="url(#cg${id})" stroke-width="1.2" fill="rgba(217,162,83,.08)"/>
    <path d="M30 40 L70 40 M50 20 L50 80 M39 40 L50 60 M61 40 L50 60" stroke="url(#cg${id})" stroke-width=".55" opacity=".55"/>
    <path d="M46 22 L54 22 L54 58 L57 58 L57 64 L54 64 L54 70 L58 70 L58 76 L42 76 L42 70 L46 70 L46 64 L43 64 L43 58 L46 58 Z" fill="url(#cg${id})" opacity=".92"/>
    <circle cx="50" cy="58" r="3.4" fill="#0b0d11" stroke="url(#cg${id})" stroke-width=".8"/>
  </svg>`;
}

export const ICONS = {
  market: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M6 9V6l2-2h8l2 2v3M5 9l1 11h12l1-11M9 13h6"/></svg>`,
  table: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 6V4h8v2M9 18v2M15 18v2M7 11h3M14 11h3"/></svg>`,
  duel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L16 8M18 4l-2 2 4 4 2-2-4-4zM3 15l6 6M17 8l3 3-8 8-3-3"/></svg>`,
  ledger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 115 .3c0 1.6-2.2 1.6-2.2 3.3M12 16.8h.01"/></svg>`,
};
