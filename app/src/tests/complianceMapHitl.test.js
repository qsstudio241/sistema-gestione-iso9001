/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  countByHitl,
  filterItemsByHitl,
  canHitlAction,
  hitlActionTitle,
  canCompile,
  compileTitle,
  canProposeLinks,
  proposeLinksTitle,
  countConfirmedHitl,
  canExportMap,
  exportMapTitle,
} from '../utils/complianceMapHitl';

describe('complianceMapHitl — CM-4/CM-5', () => {
  const mapDraft = { id: 1, status: 'draft' };
  const mapApproved = { id: 2, status: 'approved' };
  const proposed = { id: 10, hitl_status: 'proposed' };
  const accepted = { id: 11, hitl_status: 'accepted' };

  it('countByHitl / filterItemsByHitl', () => {
    const items = [proposed, accepted, { id: 12, hitl_status: 'rejected' }, { id: 13, hitl_status: 'edited' }];
    expect(countByHitl(items)).toEqual({
      proposed: 1,
      accepted: 1,
      edited: 1,
      rejected: 1,
    });
    expect(filterItemsByHitl(items, 'proposed')).toEqual([proposed]);
    expect(filterItemsByHitl(items, null)).toHaveLength(4);
  });

  it('canHitlAction: solo proposed + mappa mutabile', () => {
    expect(canHitlAction('accept', proposed, mapDraft)).toBe(true);
    expect(canHitlAction('reject', proposed, mapDraft)).toBe(true);
    expect(canHitlAction('accept', accepted, mapDraft)).toBe(false);
    expect(canHitlAction('accept', proposed, mapApproved)).toBe(false);
  });

  it('hitlActionTitle: gate Ambito / stato', () => {
    expect(hitlActionTitle('accept', proposed, mapDraft, { companyId: null })).toMatch(/Ambito/);
    expect(hitlActionTitle('accept', proposed, mapApproved, { companyId: 5 })).toMatch(/HITL non applicabile/);
    expect(hitlActionTitle('accept', accepted, mapDraft, { companyId: 5 })).toMatch(/proposto/);
  });

  it('canCompile / compileTitle', () => {
    expect(canCompile({ companyId: 1, commercialCaseId: '9' })).toBe(true);
    expect(canCompile({ companyId: null, commercialCaseId: '9' })).toBe(false);
    expect(canCompile({ companyId: 1, commercialCaseId: '' })).toBe(false);
    expect(compileTitle({ companyId: null })).toMatch(/Ambito/);
    expect(compileTitle({ companyId: 1, commercialCaseId: '' })).toMatch(/caso commerciale/);
  });

  it('canProposeLinks: serve item proposed + mappa mutabile', () => {
    expect(canProposeLinks({ companyId: 1, map: mapDraft, items: [proposed] })).toBe(true);
    expect(canProposeLinks({ companyId: 1, map: mapDraft, items: [accepted] })).toBe(false);
    expect(canProposeLinks({ companyId: 1, map: mapApproved, items: [proposed] })).toBe(false);
    expect(proposeLinksTitle({ companyId: 1, map: mapDraft, items: [] })).toMatch(/Nessun item/);
  });

  it('CM-5 canExportMap: solo se esistono accepted|edited', () => {
    expect(countConfirmedHitl([proposed, accepted])).toBe(1);
    expect(canExportMap({ companyId: 1, map: mapDraft, items: [accepted] })).toBe(true);
    expect(canExportMap({ companyId: 1, map: mapDraft, items: [proposed] })).toBe(false);
    expect(canExportMap({ companyId: null, map: mapDraft, items: [accepted] })).toBe(false);
    expect(exportMapTitle({ companyId: 1, map: mapDraft, items: [] })).toMatch(/Nessun item/);
  });
});
