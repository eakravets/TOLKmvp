import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import OpenAI from 'openai';

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 25 * 1024 * 1024 } });
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const readingTexts = [
  `Один из самых эффективных способов обучения — объяснять материал другим людям. Когда человек пытается пересказать новую информацию своими словами, он быстрее замечает пробелы в понимании и лучше запоминает ключевые идеи. Именно поэтому преподаватели часто рекомендуют обсуждать изученное с коллегами или друзьями.`,

  `Многие считают многозадачность полезным навыком, однако исследования показывают обратное. Когда человек постоянно переключается между задачами, его внимание рассеивается, а количество ошибок увеличивается. Намного эффективнее завершать дела последовательно, уделяя каждому из них полное внимание.`,

  `Короткие ежедневные привычки оказывают большее влияние на жизнь, чем редкие масштабные усилия. Несколько страниц книги в день, десятиминутная прогулка или регулярная практика нового навыка постепенно приводят к заметным результатам. Главное — сохранять последовательность.`,

  `Уверенная речь не означает отсутствие волнения. Большинство опытных спикеров признаются, что продолжают испытывать волнение перед выступлениями. Разница заключается в том, что они научились управлять своим состоянием и направлять энергию на взаимодействие с аудиторией.`
];

function getRandomText() {
  return readingTexts[Math.floor(Math.random() * readingTexts.length)];
}

app.get('/api/text', (_req, res) => {
  const text = getRandomText();
  res.json({ text });
});

function fallbackAnalysis(transcript = '') {
  const words = transcript.toLowerCase().match(/[а-яёa-z0-9]+/gi) || [];
  const total = Math.max(words.length, 1);
  const unique = new Set(words).size;
  const repeats = Math.max(35, Math.min(92, 100 - Math.round((total - unique) / total * 80)));
  const vocab = Math.max(35, Math.min(94, Math.round(unique / total * 120)));
  const confidence = Math.max(45, Math.min(90, total > 35 ? 74 : 58));
  const sense = Math.max(50, Math.min(93, /реч|мысл|ясн|практик|увер/i.test(transcript) ? 84 : 62));
  return {
    scores: { repetitions: repeats, vocabulary: vocab, confidence, meaning: sense },
    comment: 'Вы передали основную мысль. Стоит добавить больше структуры, меньше пауз и разнообразить формулировки.',
    transcript
  };
}

app.post('/api/analyze', upload.single('audio'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Audio file is required' });

  try {
    if (!client) {
      return res.json(fallbackAnalysis('Демо-режим: добавьте OPENAI_API_KEY на backend, чтобы включить транскрибацию и AI-анализ.'));
    }

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(file.path),
      model: 'gpt-4o-mini-transcribe',
      language: 'ru'
    });

    const transcript = transcription.text || '';
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Ты анализируешь устный пересказ на русском. Верни только JSON.' },
        { role: 'user', content: `Исходный текст:\n${req.body?.sourceText || 'Исходный текст не передан'}\n\nПересказ пользователя:\n${transcript}\n\nОцени от 0 до 100 категории: repetitions, vocabulary, confidence, meaning. repetitions означает отсутствие повторов: чем меньше повторов, тем выше оценка. Верни JSON вида {"scores":{"repetitions":75,"vocabulary":70,"confidence":80,"meaning":85},"comment":"короткий комментарий на русском до 28 слов"}.` }
      ]
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json({ ...fallbackAnalysis(transcript), ...parsed, transcript });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  } finally {
    if (file?.path) fs.rm(file.path, { force: true }, () => {});
  }
});

app.listen(PORT, () => console.log(`TOLK server: http://localhost:${PORT}`));
