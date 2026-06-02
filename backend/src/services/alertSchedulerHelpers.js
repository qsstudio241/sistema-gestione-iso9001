'use strict';

/**
 * Helper condivisi per alertScheduler.
 * Timezone: usa l'ora locale del server Node (documentare in ops VPS).
 */

const DEFAULT_SEND_TIME = '08:00';

/** @returns {{ hour: number, minute: number }} */
function parseSendTime(sendTime) {
  const raw = String(sendTime || DEFAULT_SEND_TIME).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 8, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}

/** Aggiunge minuti a HH:MM (wrap 24h). */
function addMinutesToSendTime(sendTime, deltaMinutes) {
  const { hour, minute } = parseSendTime(sendTime);
  const total = hour * 60 + minute + deltaMinutes;
  const wrapped = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return {
    hour: Math.floor(wrapped / 60),
    minute: wrapped % 60,
    cron: `${wrapped % 60} ${Math.floor(wrapped / 60)} * * *`,
  };
}

/** Cron node-schedule da send_time (HH:MM). */
function sendTimeToCron(sendTime) {
  const { hour, minute } = parseSendTime(sendTime);
  return `${minute} ${hour} * * *`;
}

/**
 * Soglie escalation NC: config org + 14/7/1 (deduplicate).
 * alert_days_1 tipico 30, alert_days_2 tipico 7 o 14.
 */
function buildEscalationThresholds(alertDays1, alertDays2) {
  const values = [alertDays1, alertDays2, 14, 7, 1]
    .map((d) => parseInt(d, 10))
    .filter((d) => Number.isFinite(d) && d > 0);
  return [...new Set(values)].sort((a, b) => b - a);
}

/** Giorni interi fino a due_date (positivo = futuro, negativo = scaduto). */
function daysUntilDue(dueDate) {
  if (!dueDate) return null;
  const m = String(dueDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const due = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (24 * 60 * 60 * 1000));
}

/**
 * NC alert_nc_open:
 * - due_date entro soglie escalation o scaduta (giornaliera post-scadenza)
 * - oppure NC senza due_date aperta da >= alert_days_1 giorni ("aperte 30gg" UI legacy)
 */
function matchNcAlertRule({ dueDate, createdAt, status, alertDays1, thresholds }) {
  if (['closed', 'verified'].includes(status)) return null;

  const daysLeft = daysUntilDue(dueDate);
  if (daysLeft !== null) {
    if (daysLeft < 0) return { kind: 'overdue', thresholdDays: null };
    if (thresholds.includes(daysLeft)) return { kind: 'threshold', thresholdDays: daysLeft };
    return null;
  }

  if (!createdAt || !alertDays1) return null;
  const created = new Date(String(createdAt).substring(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  created.setHours(0, 0, 0, 0);
  const openDays = Math.round((today - created) / (24 * 60 * 60 * 1000));
  if (openDays >= alertDays1) {
    return { kind: 'open_stale', thresholdDays: alertDays1 };
  }
  return null;
}

function matchActionAlertRule({ dueDate, status, thresholds }) {
  if (status === 'verified' || !dueDate) return null;
  const daysLeft = daysUntilDue(dueDate);
  if (daysLeft === null) return null;
  if (daysLeft < 0) return { kind: 'overdue', thresholdDays: null };
  if (thresholds.includes(daysLeft)) return { kind: 'threshold', thresholdDays: daysLeft };
  return null;
}

function parseRecipientList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function uniqueEmails(list) {
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

module.exports = {
  DEFAULT_SEND_TIME,
  parseSendTime,
  addMinutesToSendTime,
  sendTimeToCron,
  buildEscalationThresholds,
  daysUntilDue,
  matchNcAlertRule,
  matchActionAlertRule,
  parseRecipientList,
  uniqueEmails,
};
