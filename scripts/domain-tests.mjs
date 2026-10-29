/**
 * Lightweight domain tests (no Jest). Run: node scripts/domain-tests.mjs
 * Mirrors src/domain + src/lib/dates pure helpers.
 */
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';

function scheduledOccurrenceKey(seriesId, localDate, hhmm) {
  return `${seriesId}:${localDate}:${hhmm}`;
}

function manualOccurrenceKey(uuid) {
  return `manual:${uuid}`;
}

function countOutcomes(outcomes) {
  const counts = {
    total: 0,
    pending: 0,
    done: 0,
    notApplicable: 0,
    blocked: 0,
  };
  for (const outcome of outcomes) {
    counts.total += 1;
    if (outcome === 'pending') counts.pending += 1;
    else if (outcome === 'done') counts.done += 1;
    else if (outcome === 'not_applicable') counts.notApplicable += 1;
    else if (outcome === 'blocked') counts.blocked += 1;
  }
  return counts;
}

function reconcileRunState(current, counts) {
  if (current === 'cancelled') return 'cancelled';
  if (counts.total === 0) return 'finished';
  if (counts.pending === counts.total) return 'not_started';
  if (counts.pending === 0) return 'finished';
  return 'in_progress';
}

function resolveLocalStart(localDate, hhmm, zone) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid local time: ${hhmm}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const [year, month, day] = localDate.split('-').map(Number);
  const resolved = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone },
  );
  if (resolved.isValid) return resolved;
  let cursor = DateTime.fromObject(
    { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone },
  ).plus({ minutes: hour * 60 + minute });
  for (let i = 0; i < 8; i += 1) {
    const wall = DateTime.fromObject(
      {
        year: cursor.year,
        month: cursor.month,
        day: cursor.day,
        hour: cursor.hour,
        minute: cursor.minute,
        second: 0,
        millisecond: 0,
      },
      { zone },
    );
    if (wall.isValid) return wall;
    cursor = cursor.plus({ minutes: 15 });
  }
  throw new Error('unresolved');
}

// --- tests ---
assert.equal(
  scheduledOccurrenceKey('ser-1', '2026-03-08', '09:30'),
  'ser-1:2026-03-08:09:30',
);
assert.equal(manualOccurrenceKey('abc'), 'manual:abc');

{
  const counts = countOutcomes(['done', 'done', 'not_applicable', 'blocked', 'pending']);
  assert.equal(counts.done, 2);
  assert.equal(counts.notApplicable, 1);
  assert.equal(counts.blocked, 1);
  assert.equal(counts.pending, 1);
  assert.equal(reconcileRunState('not_started', counts), 'in_progress');
}

{
  const finished = countOutcomes(['done', 'not_applicable']);
  assert.equal(reconcileRunState('in_progress', finished), 'finished');
}

{
  // US spring-forward: 2026-03-08 02:30 America/New_York does not exist.
  const resolved = resolveLocalStart('2026-03-08', '02:30', 'America/New_York');
  assert.ok(resolved.isValid);
  assert.ok(resolved.hour > 2 || (resolved.hour === 2 && resolved.minute !== 30));
}

{
  // Fall-back repeated hour: prefer earlier instant (Luxon default).
  const resolved = resolveLocalStart('2026-11-01', '01:30', 'America/New_York');
  assert.ok(resolved.isValid);
  assert.equal(resolved.hour, 1);
  assert.equal(resolved.minute, 30);
}

console.log('domain-tests: ok');
