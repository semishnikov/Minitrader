// ДАННЫЕ: реликвии, классы, аукционы, боты, события.
// Все числа тут — единый источник правды. Игра читает их и показывает в «Своде правил».

export const CLASSES = {
  amber: { name: 'ЯНТАРЬ', one: 'янтар', color: '#e3a53f', glow: '#ffd27a' },
  bone: { name: 'КОСТЬ', one: 'костяных', color: '#efe4cf', glow: '#fff6e2' },
  porcel: { name: 'ФАРФОР', one: 'фарфоровых', color: '#79b8d6', glow: '#bfe9ff' },
  glass: { name: 'СТЕКЛО', one: 'стеклянных', color: '#6fd7b6', glow: '#b6ffe8' },
  brass: { name: 'ЛАТУНЬ', one: 'латунных', color: '#c48b52', glow: '#f3c184' },
  ink: { name: 'ЧЕРНИЛА', one: 'чернильных', color: '#9d8cc9', glow: '#cdbfff' },
};

export const RARITY = {
  common: { name: 'РЯДОВАЯ', color: '#8d877a', dots: 1, sell: 1.0 },
  fine: { name: 'ИЗЯЩНАЯ', color: '#c4b590', dots: 2, sell: 1.15 },
  rare: { name: 'РЕДКАЯ', color: '#e0a84e', dots: 3, sell: 1.45 },
  fabled: { name: 'СКАЗАННАЯ', color: '#e2647a', dots: 4, sell: 2.0 },
};

// card: { id, class, rarity, base (вес), name, sig: сигнатура для сортировки, fx }
// fx: правило, которое считается в дуэли — ОДИН понятный эффект.
export const RELICS = [
  { id: 'amber-a1', class: 'amber', rarity: 'common', base: 12, name: 'Слеза софоры' },
  { id: 'amber-a2', class: 'amber', rarity: 'common', base: 14, name: 'Пчелиный гребень' },
  { id: 'amber-a3', class: 'amber', rarity: 'fine', base: 18, name: 'Янтарь-пузырь' },
  { id: 'amber-a4', class: 'amber', rarity: 'rare', base: 26, name: 'Сердце капли' },
  { id: 'bone-b1', class: 'bone', rarity: 'common', base: 11, name: 'Костяной гребень' },
  { id: 'bone-b2', class: 'bone', rarity: 'fine', base: 17, name: 'Позвонок старца' },
  { id: 'bone-b3', class: 'bone', rarity: 'rare', base: 27, name: 'Челюсть певца' },
  { id: 'porcel-c1', class: 'porcel', rarity: 'common', base: 13, name: 'Чашка с трещиной' },
  { id: 'porcel-c2', class: 'porcel', rarity: 'fine', base: 19, name: 'Блюдце русалки' },
  { id: 'porcel-c3', class: 'porcel', rarity: 'rare', base: 28, name: 'Ваза без дна' },
  { id: 'glass-d1', class: 'glass', rarity: 'common', base: 12, name: 'Слепок окна' },
  { id: 'glass-d2', class: 'glass', rarity: 'fine', base: 18, name: 'Мениск' },
  { id: 'glass-d3', class: 'glass', rarity: 'rare', base: 29, name: 'Линза часовщика' },
  { id: 'brass-e1', class: 'brass', rarity: 'common', base: 15, name: 'Шестерня без зуба' },
  { id: 'brass-e2', class: 'brass', rarity: 'fine', base: 21, name: 'Ключ от ниоткуда' },
  { id: 'brass-e3', class: 'brass', rarity: 'rare', base: 31, name: 'Верньер' },
  { id: 'ink-f1', class: 'ink', rarity: 'common', base: 10, name: 'Пятно чернил' },
  { id: 'ink-f2', class: 'ink', rarity: 'fine', base: 16, name: 'Обрывок письма' },
  { id: 'ink-f3', class: 'ink', rarity: 'rare', base: 25, name: 'Подпись без имени' },
];

export const BOT_ARCHETYPES = {
  shark: { name: 'Акула', desc: 'жадная, берёт всё яркое', aggression: 1.25, budget: 1.15 },
  owl: { name: 'Сова', desc: 'осторожная, считает', aggression: 0.8, budget: 0.9 },
  fox: { name: 'Лиса', desc: 'мета-игрок, собирает тройки', aggression: 1.0, budget: 1.0, meta: true },
  rat: { name: 'Крыса', desc: 'перекупает на перепродажу', aggression: 0.9, budget: 1.0, resale: true },
  stone: { name: 'Камень', desc: 'просто хочет домой', aggression: 0.7, budget: 0.8 },
};
