/**
 * qualificationVerify — verifica qualifiche vs norma (modulo puro, non agganciato a flussi).
 * Piano: docs/agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md
 */

'use strict';

const { verifyQualification } = require('./verifyEngine');
const { validateFinding } = require('./findingTypes');
const { listRulePacks } = require('./verifyRegistry');

module.exports = { verifyQualification, validateFinding, listRulePacks };
