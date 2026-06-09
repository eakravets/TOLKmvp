# ТОЛК — MVP

## Запуск в VS Code

1. Откройте папку `tolk-mvp` в VS Code.
2. Скопируйте переменные окружения:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
3. В `server/.env` добавьте `OPENAI_API_KEY`.
4. Установите зависимости и запустите проект:
   ```bash
   npm run install:all
   npm run dev
   ```
5. Frontend: `http://localhost:5173`, backend: `http://localhost:3001`.

## Ассеты

Положите реальные файлы в `client/public`:
- `logo.mp4`
- `animation.mp4`
- `animationonblack.mp4`
- `mic.svg`
- `logolight.svg`
- `logovk.svg`
- `logotelegram.svg`

SVG-заглушки уже добавлены, MP4 нужно заменить реальными файлами.
