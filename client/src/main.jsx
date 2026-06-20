import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './styles.bottom.css';

const YM_ID = 109991757;

function trackGoal(goal) {
  if (window.ym) {
    window.ym(YM_ID, 'reachGoal', goal);
  }
}

const API = import.meta.env.VITE_API_URL || '';
const labels = {
  cleanliness: 'Чистота речи',
  vocabulary: 'Словарный запас',
  confidence: 'Уверенность речи',
  meaning: 'Смысл'
};
const fallbackText = '';

function noWidow(text) {
  return text.replace(/\s([А-Яа-яA-Za-z]{1,2})\s/g, ' $1\u00A0');
}
function Button({ children, dark=false, outline=false, onClick }) {
  return <button className={`pill ${dark ? 'dark' : ''} ${outline ? 'outline' : ''}`} onClick={onClick}>{children}</button>;
}
function Back({ onClick }) { return <button className="back" onClick={onClick} aria-label="Назад">←</button>; }
function Dots({ active=0, total=3 }) { return <div className="dots">{Array.from({length: total}, (_,i)=><span key={i} className={i===active?'on':''}/>)}</div>; }
function VideoAsset({ src, className }) { return <video className={className} src={src} autoPlay muted playsInline preload="auto" />; }

function Welcome({ next }) {
  return (
    <main className="screen dark welcome newWelcome">
      <img src="/blur-top.png" className="blurTop" alt="" />
<img src="/blur-bottom.png" className="blurBottom" alt="" />

      <VideoAsset src="/logolight.mp4" className="logoVideo newLogoVideo" />

      <h1>{noWidow('Проверьте качество своей речи за 2 минуты')}</h1>

      <div className="welcomeList">
        <div className="welcomeItem">
          <img src="/icon-mic.svg" alt="" />
          <div>
            <h3>Устный тест</h3>
            <p>Перескажите короткий текст</p>
          </div>
        </div>

        <div className="welcomeItem">
          <img src="/icon-time.svg" alt="" />
          <div>
            <h3>Всего 2 минуты</h3>
            <p>Никакой теории и подготовки</p>
          </div>
        </div>

        <div className="welcomeItem">
          <img src="/icon-stars.svg" alt="" />
          <div>
            <h3>Персональные рекомендации</h3>
            <p>Сильные стороны вашей речи и места роста</p>
          </div>
        </div>

        <div className="welcomeItem">
          <img src="/icon-list.svg" alt="" />
          <div>
            <h3>Оценка по 5 критериям</h3>
            <p>Словарный запас, структура речи и другие</p>
          </div>
        </div>
      </div>

      <div className="heroShape newHeroShape">
        <VideoAsset src="/animation2.mp4" />
      </div>

      <div className="bottom">
        <Button onClick={() => {
  trackGoal('start_test');
  next();
}}>
  Начать
</Button>
      </div>
    </main>
  );
}
function Reading({ next, back, text }) {
  return (
    <main className="screen dark reading newReading">
      <img src="/blur-bottom.png" className="readingTopBlur" alt="" />

      <Back onClick={back}/>

      <div className="stepNumber">01</div>

      <h2>{noWidow('Прочитайте текст и подготовьтесь передать его смысл своими словами')}</h2>

      <div className="readingTime">
        <img src="/icon-time.svg" alt="" />
        <span>1-2 минуты</span>
      </div>

      <section className="readCard">
        {text.split('\n').map((p,i)=><p key={i}>{noWidow(p)}</p>)}
      </section>

      <div className="readingHint">
        <img src="/icon-stars.svg" alt="" />
        <p>{noWidow('Ваша цель — передать главную мысль, так, как вы ее поняли')}</p>
      </div>

      <div className="bottom">
        <Button onClick={next}>Дальше</Button>
      </div>
    </main>
  );
}
function RecordingIntro({ next, back }) {
  return (
    <main className="screen dark intro">
      <Back onClick={back} />
      <div className="stepNumber">02</div>

      <div className="centerText">
        <h2>{noWidow('Расскажите, как вы поняли текст')}</h2>

        <p>
          {noWidow('Не пытайтесь повторить текст дословно. Главное — передать смысл ясно и уверенно.')}
        </p>
      </div>

      <div className="bottom">
        <Button onClick={next}>Начать запись</Button>
       
      </div>
    </main>
  );
}

function Recording({ back, analyze }) {
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const [volume, setVolume] = useState(0);
  const media = useRef(null);
  const chunks = useRef([]);
  const audioCtx = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

 useEffect(() => {
  start();
}, []);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    chunks.current = [];
    setSec(0);

    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? { mimeType: 'audio/webm;codecs=opus' }
  : {};
    

    const mr = new MediaRecorder(stream, options);
    media.current = mr;

    mr.ondataavailable = e => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

  mr.onstop = () => {
  stream.getTracks().forEach(t => t.stop());

  const mimeType = 'audio/webm;codecs=opus';
  const extension = 'webm';
  const audioBlob = new Blob(chunks.current, { type: mimeType });

  console.log('mimeType:', mimeType);
  console.log('blob size:', audioBlob.size);

  analyze(audioBlob, extension);
};

    mr.start();

    const ac = new AudioContext();
    audioCtx.current = ac;
    const src = ac.createMediaStreamSource(stream);
    const ana = ac.createAnalyser();
    ana.fftSize = 2048;
    src.connect(ana);

    const data = new Uint8Array(ana.fftSize);

    const updateVolume = () => {
      ana.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / data.length);
      const v = Math.min(1, Math.max(0, rms * 3));

      setVolume(v);
      raf.current = requestAnimationFrame(updateVolume);
    };

    raf.current = requestAnimationFrame(updateVolume);
    setRecording(true);
  }

  function stop() {
    setRecording(false);
    media.current?.stop();

    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }

    if (audioCtx.current) {
      audioCtx.current.close();
      audioCtx.current = null;
    }

    setVolume(0);
  }

  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <main className="screen dark rec">
      <Back onClick={back} />
      <div className="stepNumber">02</div>

      {!recording ? (
  <></>
) : (
  <>
    <div className="micWrap">
      <div className="rings" style={{ '--ring-scale': 1 + volume * 0.4 }} />
      <img src="/mic.svg" alt="" className="mic-fixed" />
    </div>

    <div className="timerWrap">
      <div className="timer">{mm}:{ss}</div>
      <div className="recordingStatus">Говорите...</div>
    </div>

    <div className="recordingHint">
      <img src="/icon-stars.svg" alt="" />
      <p>Передайте смысл текста своими словами</p>
    </div>
  </>
)}
      <div className="bottom">
  {recording && (
    <>
      <Button onClick={stop}>Остановить запись</Button>
   
    </>
  )}
</div>
    </main>
  );
}
function Analysis() {
  const phrases=['Анализируем вашу речь...','Оцениваем темп речи...','Анализируем словарный запас...','Определяем уверенность подачи...'];
  const [i,setI]=useState(0); useEffect(()=>{const id=setInterval(()=>setI(v=>(v+1)%phrases.length),920); return()=>clearInterval(id)},[]);
  return <main className="screen dark analysis"><div><p>{phrases[i]}</p><div className="loader"><span/><span/><span/></div></div></main>;
}
function Result({ result }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);
  const touchStart = useRef(0);

  const baseScores = result?.scores || {
    cleanliness: 0,
    vocabulary: 0,
    confidence: 0,
    meaning: 0
  };

  const clamp = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

  const scores = {
    persuasion: clamp((baseScores.meaning + baseScores.confidence) / 2),
    clarity: clamp(baseScores.cleanliness),
    structure: clamp((baseScores.meaning + baseScores.cleanliness) / 2),
    confidence: clamp(baseScores.confidence),
    vocabulary: clamp(baseScores.vocabulary)
  };

  const overallScore = clamp(
    (
      scores.persuasion +
      scores.clarity +
      scores.structure +
      scores.confidence +
      scores.vocabulary
    ) / 5
  );

  const metrics = [
    { key: 'persuasion', label: 'Убедительность', value: scores.persuasion },
    { key: 'clarity', label: 'Ясность', value: scores.clarity },
    { key: 'structure', label: 'Структура', value: scores.structure },
    { key: 'confidence', label: 'Уверенность', value: scores.confidence },
    { key: 'vocabulary', label: 'Словарь', value: scores.vocabulary }
  ];

  useEffect(() => {
    const sheet = sheetRef.current;
    const handle = sheet?.querySelector('.sheetHandle');
    if (!handle) return;

    const handleTouchStart = (e) => {
      touchStart.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      const diff = touchStart.current - e.changedTouches[0].clientY;
      if (diff > 50 && !open) setOpen(true);
      if (diff < -50 && open) setOpen(false);
    };

    handle.addEventListener('touchstart', handleTouchStart);
    handle.addEventListener('touchend', handleTouchEnd);

    return () => {
      handle.removeEventListener('touchstart', handleTouchStart);
      handle.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open]);

  return (
    <main className="screen light result resultNew">
      <section className="resultHero">
        <p className="resultHeroLabel">Ваш результат</p>

        <div className="resultHeroScore">
          <span>{overallScore}</span>
          <b>/100</b>
        </div>
      </section>

      <section className="resultProfileCard">
        <h2>Ваш речевой профиль</h2>

        <div className="resultMetrics">
     {metrics.map((metric) => (
  <div className="resultMetric" key={metric.key}>
    <div className="resultMetricTop">
      <span>{metric.label}</span>
      <b>{metric.value}%</b>
    </div>

    <div className="resultMetricBar">
      <i style={{ width: `${metric.value}%` }} />
    </div>
  </div>
))}
        </div>
      </section>

      <p className="resultComment">
        {noWidow(result?.comment || 'Речь проанализирована. Попробуйте ещё раз, чтобы получить более точный результат.')}
      </p>

      <section ref={sheetRef} className={`sheet ${open ? 'open' : ''}`}>
        <div className="sheetHandle" />

        <p className="sheetTitle">
          {noWidow('Хотите увеличить свой результат?')}
        </p>
<p className="sheetLead">
  {noWidow('Получите первые упражнения до запуска платформы')}
</p>
        {open && <img src="/logolight.svg" className="sheetLogo" alt="ТОЛК" />}
      </section>

      {open && (
        <p className="sheetSub">
          {noWidow('Подпишитесь, чтобы получить приглашение в числе первых пользователей.')}
        </p>
      )}

      <div className="bottom">
        {!open && (
         <Button
  onClick={() => {
    trackGoal('invite_click');
    setOpen(true);
  }}
>
  Получить приглашение
</Button>
        )}

        {open && (
          <div className="socials">
            <a className="pill outline" href="https://vk.com/tolk_app" target="_blank" rel="noopener noreferrer">
              <img src="/logovk.svg" alt="VK" />
            </a>

            <a className="pill outline" href="https://t.me/tolk_app?utm_source=tolk_app&utm_medium=result" target="_blank" rel="noopener noreferrer">
              <img src="/logotelegram.svg" alt="Telegram" />
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
function App(){
  const [step,setStep]=useState(0), [text,setText]=useState(''), [result,setResult]=useState(null);

  useEffect(()=>{
    fetch(`${API}/api/text`)
      .then(r=>r.json())
      .then(d=>setText(d.text))
      .catch(()=>{})
  },[]);

  async function analyze(blob, extension = 'webm'){
    setStep(4);

    const fd = new FormData();
    fd.append('audio', blob, `speech.${extension}`);
    fd.append('sourceText', text);

  try {
  const r = await fetch(`${API}/api/analyze`, { method: 'POST', body: fd });

  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(`API ${r.status}: ${errorText}`);
  }

  const data = await r.json();

await new Promise(res => setTimeout(res, 2300));

setResult(data);
trackGoal('analysis_success');
} 
catch (err) {
  trackGoal('analysis_error');
  console.error('ANALYZE ERROR:', err);

  await new Promise(res => setTimeout(res, 2300));

  setResult({
    scores: {
      cleanliness: 0,
      vocabulary: 0,
      confidence: 0,
      meaning: 0
    },
    comment: 'Не удалось получить анализ. Попробуйте записать речь ещё раз.'
  });
}

    setStep(5);
  }

  return [
  <Welcome next={()=>setStep(1)}/>,
  <Reading text={text} next={()=>setStep(2)} back={()=>setStep(0)}/>,
  <RecordingIntro next={()=>setStep(3)} back={()=>setStep(1)}/>,
  <Recording back={()=>setStep(2)} analyze={analyze}/>,
  <Analysis/>,
  <Result result={result}/>
][step];
}

createRoot(document.getElementById('root')).render(<App />);
