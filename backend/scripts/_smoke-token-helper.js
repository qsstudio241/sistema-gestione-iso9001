// Helper temporaneo per smoke test UAL-3/UAL-4 sul DB test.
// Uso: NODE_ENV=test node scripts/_smoke-token-helper.js <action> <args...>
//   generate <userId> <organizationId> <tokenType>   -> stampa rawToken (JSON)
//   query <userId> <tokenType>                        -> stampa righe (senza token in chiaro)
const { query, closePool } = require('../src/config/database');
const userActionTokenService = require('../src/services/userActionToken.service');

async function main() {
    const [action, ...args] = process.argv.slice(2);
    if (action === 'generate') {
        const [userId, organizationId, tokenType] = args;
        const result = await userActionTokenService.createToken({
            userId: parseInt(userId, 10),
            organizationId: parseInt(organizationId, 10),
            tokenType,
        });
        console.log(JSON.stringify({ rawToken: result.rawToken, expiresAt: result.expiresAt, tokenId: result.tokenId }));
    } else if (action === 'query') {
        const [userId, tokenType] = args;
        const r = await query(`
            SELECT id, token_type, expires_at, used_at, created_at, created_by
            FROM user_action_tokens WHERE user_id = @user_id AND token_type = @token_type
            ORDER BY created_at DESC
        `, { user_id: parseInt(userId, 10), token_type: tokenType });
        console.log(JSON.stringify(r.recordset));
    } else {
        throw new Error('Azione non valida: usa generate|query');
    }
    await closePool();
    process.exit(0);
}
main().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
