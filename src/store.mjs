// Простое файловое хранилище попыток (рассчитано на один процесс Node.js).
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = process.env.DATA_DIR || path.resolve('data');
const FILE = path.join(DIR, 'attempts.json');

let cache = null;
let chain = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

async function save() {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cache, null, 2));
  await fs.rename(tmp, FILE);
}

// Все изменения идут по очереди, чтобы не потерять записи.
function enqueue(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

export async function getAttempts(key) {
  return (await load())[key] ?? [];
}

export function addAttempt(key, attempt) {
  return enqueue(async () => {
    const db = await load();
    (db[key] ??= []).push(attempt);
    await save();
    return attempt;
  });
}

export function updateAttempt(key, id, patch) {
  return enqueue(async () => {
    const db = await load();
    const item = (db[key] ?? []).find((a) => a.id === id);
    if (item) Object.assign(item, patch);
    await save();
    return item;
  });
}
