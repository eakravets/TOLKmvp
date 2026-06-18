import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 25 * 1024 * 1024 } });

const PORT = process.env.PORT || 3001;
const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

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
  res.json({ text: getRandomText() });
});

function fallbackAnalysis(transcript = '') {
  const words = transcript.toLowerCase().match(/[а-яёa-z0-9]+/gi) || [];
  const total = Math.max(words.length, 1);
  const unique = new Set(words).size;

  const cleanliness = Math.max(35, Math.min(92, 100 - Math.round((total - unique) / total * 80)));
  const vocabulary = Math.max(35, Math.min(94, Math.round(unique / total * 120)));
  const confidence = Math.max(45, Math.min(90, total > 35 ? 74 : 58));
  const meaning = Math.max(35, Math.min(90, total > 25 ? 70 : 52));

  return {
    scores: {
      cleanliness,
      vocabulary,
      confidence,
      meaning
    },
    comment: 'Речь распознана. Вы передали часть мысли; следующий шаг — добавить AI-оценку смысла через YandexGPT.',
    transcript
  };
}

async function convertToMp3(inputPath) {
  const outputPath = `${inputPath}.mp3`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-ar', '48000',
    '-ac', '1',
    '-b:a', '96k',
    outputPath
  ]);

  return outputPath;
}

function extractTextDeep(obj) {
  const found = [];

  function walk(value) {
    if (!value) return;

    if (typeof value === 'string') return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === 'object') {
      if (typeof value.text === 'string') {
        found.push(value.text);
      }

      Object.values(value).forEach(walk);
    }
  }

  walk(obj);

  return [...new Set(found)].join(' ').replace(/\s+/g, ' ').trim();
}

async function transcribeWithYandex(mp3Path) {
  if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
    throw new Error('YANDEX_API_KEY or YANDEX_FOLDER_ID is missing');
  }

  const audioBuffer = fs.readFileSync(mp3Path);

  const response = await fetch(
    `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?folderId=${YANDEX_FOLDER_ID}&lang=ru-RU&format=mp3`,
    {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'audio/mpeg'
      },
      body: audioBuffer
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Yandex STT failed: ${JSON.stringify(data)}`);
  }

  const transcript = data.result?.trim();

  if (!transcript) {
    throw new Error(`Yandex STT returned empty transcript: ${JSON.stringify(data)}`);
  }

  return transcript;
}

app.post('/api/analyze', upload.single('audio'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  const uploadedPath = file.path;
  const webmPath = `${uploadedPath}.webm`;
  let mp3Path = null;

  try {
    fs.renameSync(uploadedPath, webmPath);

    mp3Path = await convertToMp3(webmPath);

    const transcript = await transcribeWithYandex(mp3Path);

    const words = transcript.trim().toLowerCase().match(/[а-яёa-z0-9]+/gi) || [];

    if (words.length < 5) {
      return res.json({
        scores: {
          cleanliness: 0,
          vocabulary: 0,
          confidence: 0,
          meaning: 0
        },
        comment: 'Похоже, запись получилась слишком короткой. Попробуйте ещё раз: перескажите главную мысль текста хотя бы в нескольких предложениях.',
        transcript
      });
    }

    res.json(fallbackAnalysis(transcript));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message
    });
  } finally {
    fs.rm(uploadedPath, { force: true }, () => {});
    fs.rm(webmPath, { force: true }, () => {});
    if (mp3Path) fs.rm(mp3Path, { force: true }, () => {});
  }
});

app.listen(PORT, () => console.log(`TOLK server: http://localhost:${PORT}`));