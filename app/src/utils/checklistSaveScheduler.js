/**
 * Salvataggio checklist: una domanda, un timer, una richiesta in volo.
 * I retry partono solo da un salvataggio già chiesto dall'utente.
 */

const DEFAULT_DEBOUNCE_MS = 1000;
const MAX_BACKOFF_MS = 60000;

function isRetryableSaveError(err) {
  const status = err?.status;
  const code = err?.code;
  return status === 429
    || status === 0
    || status === 408
    || code === 'NETWORK_ERROR'
    || code === 'TIMEOUT'
    || code === 'OFFLINE'
    || code === 'RATE_LIMIT_API'
    || code === 'EVENTS_SAVE_ERROR';
}

function retryDelayMs(err, attempt) {
  const fromHeader = Number(err?.data?.retryAfterMs);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader;
  const exp = 1000 * (2 ** Math.max(0, attempt - 1));
  return Math.min(exp, MAX_BACKOFF_MS);
}

function createChecklistSaveScheduler({
  debounceMs = DEFAULT_DEBOUNCE_MS,
  send,
  sendMany = null,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  if (typeof send !== 'function') {
    throw new Error('createChecklistSaveScheduler: send obbligatorio');
  }

  const slots = new Map();
  const listeners = new Set();

  function snapshot() {
    let pending = 0;
    let saving = 0;
    let retrying = 0;
    let error = 0;
    let saved = 0;
    for (const slot of slots.values()) {
      if (slot.status === 'pending') pending += 1;
      else if (slot.status === 'saving') saving += 1;
      else if (slot.status === 'retrying') retrying += 1;
      else if (slot.status === 'error') error += 1;
      else if (slot.status === 'saved') saved += 1;
    }
    let phase = 'idle';
    if (error > 0) phase = 'error';
    else if (retrying > 0) phase = 'retrying';
    else if (saving > 0) phase = 'saving';
    else if (pending > 0) phase = 'pending';
    else if (saved > 0) phase = 'saved';
    return {
      phase,
      pending,
      saving,
      retrying,
      error,
      saved,
      unsaved: pending + saving + retrying + error,
    };
  }

  function emit() {
    const snap = snapshot();
    listeners.forEach((fn) => {
      try { fn(snap); } catch (_) { /* listener UI */ }
    });
  }

  function ensure(key) {
    let slot = slots.get(key);
    if (!slot) {
      slot = {
        status: 'idle',
        retry: 0,
        inFlight: false,
        dirty: false,
        timer: null,
        latest: null,
        generation: 0,
        due: false,
      };
      slots.set(key, slot);
    }
    return slot;
  }

  function schedule(key, payload) {
    const slot = ensure(key);
    slot.latest = payload;
    slot.generation += 1;
    const gen = slot.generation;
    if (slot.timer) clearTimer(slot.timer);
    slot.timer = null;
    if (slot.inFlight) {
      slot.dirty = true;
      slot.status = 'saving';
      emit();
      return;
    }
    slot.status = 'pending';
    slot.timer = setTimer(() => { flush(key, gen); }, debounceMs);
    emit();
  }

  let pumping = false;

  async function pump() {
    if (pumping || typeof sendMany !== 'function') return;
    pumping = true;
    try {
      while (true) {
        const batch = [];
        const keys = [];
        for (const [key, slot] of slots) {
          if (!slot.due || slot.latest == null || slot.inFlight) continue;
          batch.push(slot.latest);
          keys.push(key);
          slot.due = false;
          slot.inFlight = true;
          slot.dirty = false;
          slot.status = 'saving';
        }
        if (batch.length === 0) break;
        emit();
        try {
          await sendMany(batch, { keepalive: false });
          for (const key of keys) {
            const slot = slots.get(key);
            if (!slot) continue;
            slot.inFlight = false;
            slot.retry = 0;
            if (slot.dirty) {
              slot.dirty = false;
              slot.due = true;
              slot.status = 'pending';
            } else {
              slot.status = 'saved';
            }
          }
        } catch (err) {
          for (const key of keys) {
            const slot = slots.get(key);
            if (!slot) continue;
            slot.inFlight = false;
            slot.due = false;
            if (isRetryableSaveError(err)) {
              slot.retry += 1;
              slot.status = 'retrying';
              const wait = retryDelayMs(err, slot.retry);
              const gen = slot.generation;
              slot.timer = setTimer(() => { flush(key, gen); }, wait);
            } else {
              slot.status = 'error';
            }
          }
          emit();
          break;
        }
        emit();
      }
    } finally {
      pumping = false;
    }
  }

  async function flush(key, gen, { keepalive = false } = {}) {
    const slot = slots.get(key);
    if (!slot || slot.latest == null) return;
    if (gen != null && slot.generation !== gen && !slot.dirty && !keepalive) return;
    if (slot.inFlight) {
      slot.dirty = true;
      return;
    }
    if (typeof sendMany === 'function' && !keepalive) {
      if (slot.timer) clearTimer(slot.timer);
      slot.timer = null;
      slot.due = true;
      if (slot.status !== 'retrying') slot.status = 'pending';
      emit();
      return pump();
    }
    if (slot.timer) clearTimer(slot.timer);
    slot.timer = null;
    const payload = slot.latest;
    const genAtStart = slot.generation;
    slot.inFlight = true;
    slot.dirty = false;
    slot.status = 'saving';
    emit();
    try {
      await send(payload, { keepalive });
      slot.inFlight = false;
      slot.retry = 0;
      if (slot.dirty || slot.generation !== genAtStart) {
        slot.dirty = false;
        slot.status = 'pending';
        const nextGen = slot.generation;
        slot.timer = setTimer(() => { flush(key, nextGen); }, 0);
      } else {
        slot.status = 'saved';
      }
    } catch (err) {
      slot.inFlight = false;
      if (isRetryableSaveError(err)) {
        slot.retry += 1;
        slot.status = 'retrying';
        const wait = retryDelayMs(err, slot.retry);
        slot.timer = setTimer(() => { flush(key, slot.generation); }, wait);
      } else {
        slot.status = 'error';
      }
    }
    emit();
  }

  function flushAllNow({ keepalive = false } = {}) {
    if (keepalive && typeof sendMany === 'function') {
      const batch = [];
      const keys = [];
      for (const [key, slot] of slots) {
        if (slot.timer) clearTimer(slot.timer);
        slot.timer = null;
        if (slot.latest == null) continue;
        const needsSend = slot.status !== 'saved' || slot.dirty || slot.inFlight;
        if (!needsSend) continue;
        batch.push(slot.latest);
        keys.push(key);
        slot.inFlight = true;
        slot.dirty = false;
        slot.status = 'saving';
      }
      emit();
      if (batch.length === 0) return Promise.resolve();
      return Promise.resolve(sendMany(batch, { keepalive: true }))
        .then(() => {
          for (const key of keys) {
            const slot = slots.get(key);
            if (!slot) continue;
            slot.inFlight = false;
            slot.status = slot.dirty ? 'pending' : 'saved';
          }
          emit();
        })
        .catch((err) => {
          for (const key of keys) {
            const slot = slots.get(key);
            if (!slot) continue;
            slot.inFlight = false;
            slot.status = isRetryableSaveError(err) ? 'retrying' : 'error';
          }
          emit();
        });
    }
    const jobs = [];
    for (const [key, slot] of slots) {
      if (slot.timer) clearTimer(slot.timer);
      slot.timer = null;
      if (slot.latest == null) continue;
      if (slot.inFlight) {
        jobs.push(Promise.resolve(send(slot.latest, { keepalive })).catch(() => {}));
        continue;
      }
      jobs.push(flush(key, slot.generation, { keepalive }));
    }
    return Promise.all(jobs);
  }

  function hasUnsaved() {
    return snapshot().unsaved > 0;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { schedule, flushAllNow, hasUnsaved, subscribe, snapshot };
}

export {
  DEFAULT_DEBOUNCE_MS,
  isRetryableSaveError,
  retryDelayMs,
  createChecklistSaveScheduler,
};
