const {
  applyTechnicalReviewCompletionStamp,
  isTechnicalReviewComplete,
  stampTechnicalReviewChecklistJson,
  TECHNICAL_REVIEW_KEYS,
} = require('./technicalReviewChecklist');

function allChecked() {
  const checklist = {};
  for (const key of TECHNICAL_REVIEW_KEYS) {
    checklist[key] = { checked: true };
  }
  return checklist;
}

describe('technicalReviewChecklist (backend)', () => {
  it('ha 17 chiavi e riconosce il completamento', () => {
    expect(TECHNICAL_REVIEW_KEYS).toHaveLength(17);
    expect(isTechnicalReviewComplete(allChecked())).toBe(true);
    expect(isTechnicalReviewComplete({ materiale_base: { checked: true } })).toBe(false);
  });

  it('stamp JSON al primo completamento', () => {
    const json = stampTechnicalReviewChecklistJson(allChecked(), {
      user_id: 4,
      full_name: 'Studio Admin',
    });
    const parsed = JSON.parse(json);
    expect(parsed._completion.by_user_id).toBe(4);
    expect(parsed._completion.by_name).toBe('Studio Admin');
  });

  it('incompleta: JSON senza _completion', () => {
    const json = stampTechnicalReviewChecklistJson(
      { materiale_base: { checked: true } },
      { user_id: 4, full_name: 'Studio Admin' },
    );
    expect(JSON.parse(json)._completion).toBeUndefined();
  });

  it('conserva il primo timbro', () => {
    const first = applyTechnicalReviewCompletionStamp(allChecked(), {
      user_id: 1,
      full_name: 'Anna',
    }, new Date('2026-02-01T00:00:00.000Z'));
    const second = applyTechnicalReviewCompletionStamp(first, {
      user_id: 2,
      full_name: 'Luca',
    }, new Date('2026-08-16T00:00:00.000Z'));
    expect(second._completion.by_name).toBe('Anna');
  });
});
