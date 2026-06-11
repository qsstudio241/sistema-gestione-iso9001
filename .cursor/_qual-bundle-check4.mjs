const qual = 'QualificationsPage-DYqUzBCg.js';
const code = await (await fetch(`https://systemgest.netlify.app/assets/${qual}`)).text();
const idx = code.indexOf('getQualifications');
console.log('getQualifications ctx:', code.slice(idx, idx + 500));
const idx2 = code.indexOf('setQualifications') >= 0 ? code.indexOf('setQualifications') : code.indexOf('.qualifications');
console.log('qualifications assign:', code.slice(Math.max(0, idx2 - 50), idx2 + 200));
