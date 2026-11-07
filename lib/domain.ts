export const categories = [
  'Phones & Electronics',
  'Laptops & Accessories',
  'Wallets & Money',
  'Identification Cards',
  'Books & Academic Materials',
  'Keys',
  'Bags & Backpacks',
  'Clothing & Accessories',
  'Jewellery',
  'Documents',
  'Other Belongings',
];
export const locations = [
  'Main Library',
  'Physics Laboratory',
  'Chemistry Laboratory',
  'University Gate',
  'Student Union Building',
  'Senate Building',
  'Faculty of Engineering',
  'Faculty of Agriculture',
  'Lecture Theatre',
  'Sports Centre',
  'Hostel Area',
  'Other campus location',
];
export const safety = [
  'Meet in a public place on campus, ideally during daylight hours.',
  'Never share your password, bank details or verification codes.',
  'Do not send money to recover an item — legitimate finders never ask.',
  'Verify the item before handing it over; use the claim questions.',
  'Use FoundIt messaging so your phone number and email stay private.',
];
export function matchScore(a: any, b: any) {
  if (a.type === b.type || a.status !== 'open' || b.status !== 'open') return 0;
  let n = a.category === b.category ? 35 : 0;
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const x = words(a.title + ' ' + a.description),
    y = words(b.title + ' ' + b.description);
  const overlap = [...x].filter((w) => y.has(w)).length;
  n += Math.round((35 * overlap) / Math.max(1, Math.min(x.size, y.size)));
  if (a.location === b.location) n += 20;
  const days = Math.abs(Date.parse(a.date) - Date.parse(b.date)) / 86400000;
  if (days <= 3) n += 10;
  else if (days <= 14) n += 5;
  return n;
}
export function canTransition(from: string, to: string) {
  return (
    (
      {
        pending: ['approved', 'rejected', 'more_info'],
        more_info: ['approved', 'rejected'],
        approved: ['recovered', 'rejected'],
        rejected: [],
        recovered: [],
      } as Record<string, string[]>
    )[from]?.includes(to) ?? false
  );
}
export function required(value: any, label: string, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new Error(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}

export function resolveTaxonomy(stored: any[]) {
  const defaults = [
    ...categories.map((name, i) => ({
      id: 'default-category-' + i,
      kind: 'category',
      name,
      parent: '',
      active: 1,
    })),
    ...locations.map((name, i) => ({
      id: 'default-location-' + i,
      kind: 'location',
      name,
      parent: '',
      active: 1,
    })),
    {
      id: 'default-institution',
      kind: 'institution',
      name: 'University of Ilorin',
      parent: '',
      active: 1,
    },
  ];
  const m = new Map(defaults.map((t) => [t.id, t]));
  for (const t of stored) m.set(t.id, t);
  return [...m.values()];
}
