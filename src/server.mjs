import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ltijs from 'ltijs';
import { grade, publicQuestions, MAX_SCORE } from './grading.mjs';
import { getAttempts, addAttempt, updateAttempt } from './store.mjs';

const lti = ltijs.Provider;
const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = Number(env.PORT || 3000);
const MOODLE_URL = (env.MOODLE_URL || '').replace(/\/+$/, '');

const LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';

lti.setup(
  env.LTI_KEY || 'dev-only-change-me',
  { url: env.MONGO_URL || 'mongodb://localhost:27017/lti-trainer' },
  {
    appRoute: '/lti/launch',
    loginRoute: '/lti/login',
    keysetRoute: '/lti/keys',
    cookies: { secure: true, sameSite: 'None' },
    devMode: false,
  },
);
lti.app.set('trust proxy', 1);
lti.whitelist('/healthz');

// Успешный запуск из Moodle -> страница тренажёра (ltik добавится автоматически).
lti.onConnect((token, req, res) => lti.redirect(res, '/app'));

// Данные пользователя берём только из проверенного LTI-запуска, не из браузера.
function context(token) {
  const roles = token.platformContext?.roles ?? [];
  return {
    userId: token.user,
    name: token.userInfo?.name || null,
    courseId: token.platformContext?.context?.id ?? null,
    resourceId: token.platformContext?.resource?.id ?? null,
    isLearner: roles.includes(LEARNER),
    key: [token.iss, token.platformContext?.resource?.id, token.user].join('|'),
  };
}

const view = (a) => ({
  id: a.id, at: a.at, score: a.score, max: a.max, status: a.status, details: a.details,
});

async function sendGrade(token, score) {
  let lineItemId = token.platformContext?.endpoint?.lineitem;
  if (!lineItemId) {
    const items = await lti.Grade.getLineItems(token, { resourceLinkId: true });
    lineItemId = items?.lineItems?.[0]?.id;
  }
  if (!lineItemId) throw new Error('Для элемента курса не найдена строка журнала (AGS).');
  await lti.Grade.submitScore(token, lineItemId, {
    userId: token.user,
    scoreGiven: score,
    scoreMaximum: MAX_SCORE,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  });
}

async function deliver(token, ctx, attempt) {
  try {
    await sendGrade(token, attempt.score);
    await updateAttempt(ctx.key, attempt.id, { status: 'sent', error: null });
    return 'sent';
  } catch (err) {
    console.error('AGS error:', err.message);
    await updateAttempt(ctx.key, attempt.id, { status: 'failed', error: err.message });
    return 'failed';
  }
}

lti.app.get('/healthz', (req, res) => res.json({ ok: true }));
lti.app.get('/app', (req, res) => res.sendFile(path.join(here, '../public/app.html')));

lti.app.get('/api/state', async (req, res) => {
  const ctx = context(res.locals.token);
  const attempts = await getAttempts(ctx.key);
  res.json({
    user: { id: ctx.userId, name: ctx.name },
    courseId: ctx.courseId,
    resourceId: ctx.resourceId,
    isLearner: ctx.isLearner,
    max: MAX_SCORE,
    questions: publicQuestions(),
    attempts: attempts.map(view),
  });
});

lti.app.post('/api/submit', async (req, res) => {
  const token = res.locals.token;
  const ctx = context(token);
  if (!ctx.isLearner) return res.status(403).json({ error: 'Отправлять оценку может только студент.' });

  const attempts = await getAttempts(ctx.key);
  if (attempts.some((a) => a.status === 'failed')) {
    return res.status(409).json({ error: 'Предыдущая оценка не дошла до Moodle. Сначала отправьте её повторно.' });
  }

  const result = grade(req.body?.answers);
  const attempt = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    score: result.score,
    max: result.max,
    details: result.details,
    answers: req.body?.answers ?? {},
    status: 'pending',
  };
  await addAttempt(ctx.key, attempt);
  attempt.status = await deliver(token, ctx, attempt);
  res.json({ attempt: view(attempt) });
});

lti.app.post('/api/resend', async (req, res) => {
  const token = res.locals.token;
  const ctx = context(token);
  if (!ctx.isLearner) return res.status(403).json({ error: 'Недостаточно прав.' });
  const failed = (await getAttempts(ctx.key)).filter((a) => a.status === 'failed').at(-1);
  if (!failed) return res.status(404).json({ error: 'Нет неотправленных результатов.' });
  failed.status = await deliver(token, ctx, failed);
  res.json({ attempt: view(failed) });
});

await lti.deploy({ port: PORT, silent: true });

if (MOODLE_URL && env.MOODLE_CLIENT_ID) {
  try {
    await lti.registerPlatform({
      url: MOODLE_URL,
      name: 'Moodle',
      clientId: env.MOODLE_CLIENT_ID,
      authenticationEndpoint: env.MOODLE_AUTH_URL || `${MOODLE_URL}/mod/lti/auth.php`,
      accesstokenEndpoint: env.MOODLE_TOKEN_URL || `${MOODLE_URL}/mod/lti/token.php`,
      authConfig: { method: 'JWK_SET', key: env.MOODLE_JWKS_URL || `${MOODLE_URL}/mod/lti/certs.php` },
    });
    console.log('Платформа Moodle зарегистрирована:', MOODLE_URL);
  } catch (err) {
    console.log('Регистрация платформы пропущена:', err.message);
  }
} else {
  console.log('MOODLE_URL / MOODLE_CLIENT_ID не заданы: режим подготовки регистрации.');
}

console.log(`Тренажёр запущен на порту ${PORT}`);
