// Три задания по HTML/CSS. Идентификаторы и веса: q1/q2/q3 = 3/3/4, максимум 10.
export const MAX_SCORE = 10;

export const QUESTIONS = [
  {
    id: 'q1',
    weight: 3,
    topic: 'HTML',
    text: 'Какой атрибут тега <img> задаёт альтернативный текст изображения?',
    hint: 'Его читают скринридеры, и он показывается, если картинка не загрузилась.',
    accepted: ['alt'],
  },
  {
    id: 'q2',
    weight: 3,
    topic: 'CSS',
    text: 'Какое значение свойства box-sizing включает padding и border в заданную ширину элемента?',
    hint: 'Два слова через дефис.',
    accepted: ['border-box'],
  },
  {
    id: 'q3',
    weight: 4,
    topic: 'CSS',
    text: 'Какое CSS-свойство управляет порядком наложения позиционированных элементов по оси Z?',
    hint: 'Работает у элементов с position, отличным от static.',
    accepted: ['z-index', 'zindex'],
  },
];

export const normalize = (value) =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function grade(answers = {}) {
  let score = 0;
  const details = {};
  for (const q of QUESTIONS) {
    const correct = q.accepted.includes(normalize(answers?.[q.id]));
    details[q.id] = correct;
    if (correct) score += q.weight;
  }
  return { score, max: MAX_SCORE, details };
}

// Вопросы для браузера: без правильных ответов.
export const publicQuestions = () =>
  QUESTIONS.map(({ id, weight, topic, text, hint }) => ({ id, weight, topic, text, hint }));
