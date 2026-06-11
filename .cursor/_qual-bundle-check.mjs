const html = await (await fetch('https://systemgest.netlify.app/')).text();
const qual = html.match(/QualificationsPage-[^"]+\.js/)?.[0];
console.log('qual bundle:', qual || 'NOT_FOUND');
if (qual) {
  const code = await (await fetch(`https://systemgest.netlify.app/assets/${qual}`)).text();
  const idx = code.indexOf('qualifications');
  console.log('has qualifications string:', idx >= 0);
  const snippets = [...code.matchAll(/\.map\(/g)].length;
  console.log('map calls:', snippets);
  // find setQualifications pattern
  for (const pat of ['qualifications||', 'qualifications||[', 'Array.isArray', 'setQualifications']) {
    console.log(pat, code.includes(pat));
  }
  console.log('snippet around qualifications:', code.slice(Math.max(0, idx - 80), idx + 200));
}
