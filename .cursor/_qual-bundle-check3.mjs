const qual = 'QualificationsPage-DYqUzBCg.js';
const code = await (await fetch(`https://systemgest.netlify.app/assets/${qual}`)).text();
// find formOpen / QualificationForm mount condition
for (const pat of ['formOpen', 'qf-overlay', 'Nuova qualifica', 'getCompanies']) {
  console.log(pat, code.includes(pat));
}
// find setCompanies pattern
const idx = code.indexOf('getCompanies');
console.log('getCompanies ctx:', code.slice(idx, idx + 300));
