process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { embed } = require('/var/www/sgq-backend/src/services/aiProviderAdapter');
(async () => {
  try {
    const result = await embed(['Questo e un test di embedding per verificare quota Gemini']);
    if (result && result[0] && result[0].length > 0) {
      console.log('EMBED_OK dim=' + result[0].length);
    } else {
      console.log('EMBED_FAIL: result vuoto o malformato');
    }
  } catch (e) {
    console.log('EMBED_ERROR: ' + e.message);
  }
  process.exit(0);
})();
