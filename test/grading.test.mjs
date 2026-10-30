import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, QUESTIONS, publicQuestions, MAX_SCORE } from '../src/grading.mjs';

test('веса заданий: 3/3/4, максимум 10', () => {
  assert.deepEqual(QUESTIONS.map((q) => q.id), ['q1', 'q2', 'q3']);
  assert.deepEqual(QUESTIONS.map((q) => q.weight), [3, 3, 4]);
  assert.equal(QUESTIONS.reduce((s, q) => s + q.weight, 0), MAX_SCORE);
});

test('все ответы верны -> 10, регистр и пробелы не важны', () => {
  const r = grade({ q1: '  ALT ', q2: 'Border-Box', q3: 'z-index' });
  assert.equal(r.score, 10);
});

test('пустые ответы -> 0', () => {
  assert.equal(grade({}).score, 0);
  assert.equal(grade().score, 0);
});

test('частичные ответы суммируют веса', () => {
  assert.equal(grade({ q3: 'z-index' }).score, 4);
  assert.equal(grade({ q1: 'alt', q2: 'border-box' }).score, 6);
  assert.equal(grade({ q1: 'title', q2: 'content-box', q3: 'order' }).score, 0);
});

test('браузеру не отдаются правильные ответы', () => {
  for (const q of publicQuestions()) assert.equal('accepted' in q, false);
});
