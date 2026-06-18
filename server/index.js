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

  const cleanliness = Math.max(35, Math.min(92, 100 - Math.round(((total - unique) / total) * 80)));
  const vocabulary = Math.max(35, Math.min(94, Math.round((unique / total) * 120)));
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

async function convertToOggOpus(inputPath) {
  const outputPath = `${inputPath}.ogg`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vn',
    '-acodec', 'libopus',
    '-ar', '48000',
    '-ac', '1',
    '-b:a', '48k',
    outputPath
  ]);

  return outputPath;
}

async function transcribeWithYandex(audioPath) {
  if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
    throw new Error('YANDEX_API_KEY or YANDEX_FOLDER_ID is missing');
  }

  const audioBuffer = fs.readFileSync(audioPath);

  const response = await fetch(
    `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?folderId=${YANDEX_FOLDER_ID}&lang=ru-RU&format=oggopus`,
    {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'audio/ogg'
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
async function analyzeWithYandexGPT({ sourceText, transcript }) {
  const prompt = `Исходный текст:
${sourceText || 'Исходный текст не передан'}

Пересказ пользователя:
${transcript}

Оцени от 0 до 100:

cleanliness — чистота речи: меньше  повторов, сбивок и речевого мусора.
vocabulary — разнообразие, точность и естественность формулировок.
confidence — уверенность, плавность и связность речи.
meaning — насколько смысл пересказа соответствует исходному тексту, смысл пользователь может передавать своими словами.

Правила:
- Если пересказ не связан с исходным текстом, meaning не выше 10.
- Если пользователь сказал слишком мало, meaning не выше 35.
- Если смысл передан частично, meaning 40–65.
- Если основная мысль передана понятно, meaning 66–82.
- Если пересказ точный, ясный и своими словами, meaning 83–100.


Комментарий:
Напиши одно или пару предложений на русском до 45 слов.
Сначала отметь сильную сторону, затем одну конкретную точку роста.
Не используй слова:
"пересказ", "метрики", "cleanliness", "vocabulary", "confidence", "meaning".
Не используй общие фразы вроде "хорошая работа" или "продолжайте в том же духе".
Если пользователь воспроизводит исходный текст почти дословно,
не штрафуй за словарный запас и не придумывай слова-паразиты.

Если сходство с исходным текстом выше 85%, в этом случае не делай выводов о словах-паразитах,
не критикуй словарный запас и оценивай в первую очередь
точность передачи содержания.
Ты анализируешь только текст расшифровки.
У тебя нет информации о голосе, интонации, темпе, паузах и словах-паразитах.

Запрещено утверждать:
- что были слова-паразиты;
- что были повторы;
- что была неуверенная подача;
- что был плохой темп;
- что была плохая дикция;

если это невозможно определить по тексту.

Не придумывай недостатки ради баланса оценки.
Если существенных недостатков не видно, так и напиши. Подбирай мягкие формулировки, что. не растроить пользователя и не огорчить, а мотивировать к улучшению результатов.

Верни JSON строго такого вида:
{
  "scores": {
    "cleanliness": 0,
    "vocabulary": 0,
    "confidence": 0,
    "meaning": 0
  },
  "comment": "короткий вывод до 35 слов"
}
  `;

  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      Authorization: `Api-Key ${YANDEX_API_KEY}`,
      'x-folder-id': YANDEX_FOLDER_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt-lite/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.2,
        maxTokens: 800
      },
      jsonObject: true,
      messages: [
        {
          role: 'system',
          text: 'Ты эксперт по развитию устной речи. Отвечай только валидным JSON без markdown.'
        },
        {
          role: 'user',
          text: prompt
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`YandexGPT failed: ${JSON.stringify(data)}`);
  }

  const raw = data.result?.alternatives?.[0]?.message?.text || '{}';
  const cleaned = raw.replace(/```json|```/g, '').trim();

  return JSON.parse(cleaned);
}
app.post('/api/analyze', upload.single('audio'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  const uploadedPath = file.path;
  const webmPath = `${uploadedPath}.webm`;
  let oggPath = null;

  try {
    fs.renameSync(uploadedPath, webmPath);

    oggPath = await convertToOggOpus(webmPath);

    const transcript = await transcribeWithYandex(oggPath);
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

   let aiAnalysis;

try {
  aiAnalysis = await analyzeWithYandexGPT({
    sourceText: req.body?.sourceText || '',
    transcript
  });
} catch (gptError) {
  console.error('YandexGPT error:', gptError);
  aiAnalysis = fallbackAnalysis(transcript);
}

res.json({ ...fallbackAnalysis(transcript), ...aiAnalysis, transcript });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message
    });
  } finally {
    fs.rm(uploadedPath, { force: true }, () => {});
    fs.rm(webmPath, { force: true }, () => {});
    if (oggPath) fs.rm(oggPath, { force: true }, () => {});
  }
});

app.listen(PORT, () => console.log(`TOLK server: http://localhost:${PORT}`));