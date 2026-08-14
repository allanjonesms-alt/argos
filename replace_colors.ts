import * as fs from 'fs';

let content = fs.readFileSync('pages/Promuse.tsx', 'utf8');

const replacements: [string, string][] = [
  ['min-h-screen bg-slate-900 text-slate-100', 'w-full text-navy-950'],
  ['bg-slate-900', 'bg-navy-50'],
  ['bg-slate-950', 'bg-white'],
  ['bg-slate-955', 'bg-white'],
  ['bg-slate-800', 'bg-navy-100'],
  ['bg-slate-850', 'bg-navy-100'],
  ['border-slate-800', 'border-navy-200'],
  ['border-slate-850', 'border-navy-200'],
  ['text-slate-100', 'text-navy-950'],
  ['text-slate-200', 'text-navy-900'],
  ['text-slate-300', 'text-navy-800'],
  ['text-slate-400', 'text-navy-500'],
  ['text-slate-500', 'text-navy-400'],
  ['text-slate-550', 'text-navy-400'],
  ['text-slate-350', 'text-navy-700'],
  ['text-slate-450', 'text-navy-600'],
  ['text-slate-250', 'text-navy-800'],
  ['bg-[#420B34]', 'bg-pink-600'],
  ['border-[#5E164C]/20', 'border-pink-500'],
  ['bg-emerald-600', 'bg-pink-600'],
  ['bg-emerald-700', 'bg-pink-700'],
  ['text-emerald-400', 'text-pink-600'],
  ['text-emerald-500', 'text-pink-500'],
  ['bg-emerald-900', 'bg-pink-100'],
  ['bg-emerald-950', 'bg-pink-50'],
  ['border-emerald-900', 'border-pink-200'],
  ['border-emerald-800', 'border-pink-200'],
  ['text-rose-300', 'text-pink-500'],
  ['text-[#FFCCD6]', 'text-pink-100'],
  ['border-white/10', 'border-white/20'],
  ['bg-black/40', 'bg-white/20']
];

for (const [search, replacement] of replacements) {
  content = content.split(search).join(replacement);
}

fs.writeFileSync('pages/Promuse.tsx', content);
console.log('Replacements complete');
