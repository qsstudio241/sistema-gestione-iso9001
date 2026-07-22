const https = require('https');
https.get('https://systemgest.netlify.app', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const m = data.match(/src="\/assets\/(index-[^"]+\.js)"/);
    if (m) {
      const bundleUrl = 'https://systemgest.netlify.app/assets/' + m[1];
      console.log('BUNDLE=' + m[1]);
      https.get(bundleUrl, (r2) => {
        let bundle = '';
        r2.on('data', d => bundle += d);
        r2.on('end', () => {
          const hasPreview = bundle.includes('Anteprima promemoria NC') || bundle.includes('run-nc-alerts');
          const hasRunBtn  = bundle.includes('Esegui promemoria NC');
          console.log('HAS_PREVIEW_BTN=' + hasPreview);
          console.log('HAS_RUN_BTN=' + hasRunBtn);
          process.exit(hasPreview ? 0 : 1);
        });
      }).on('error', e => { console.log('BUNDLE_ERR=' + e.message); process.exit(1); });
    } else {
      console.log('NO_BUNDLE_FOUND');
      process.exit(1);
    }
  });
}).on('error', e => { console.log('ERR=' + e.message); process.exit(1); });
