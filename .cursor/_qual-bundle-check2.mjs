const qual = 'QualificationsPage-DYqUzBCg.js';
const code = await (await fetch(`https://systemgest.netlify.app/assets/${qual}`)).text();
console.log('size', code.length);
const matches = [...code.matchAll(/\.map\(/g)];
console.log('map count', matches.length);
// show context around each map
for (const m of matches) {
  console.log('---', code.slice(Math.max(0, m.index - 120), m.index + 40));
}
