import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './styles.bottom.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const labels = {
  cleanliness: 'Чистота речи',
  vocabulary: 'Словарный запас',
  confidence: 'Уверенность речи',
  meaning: 'Смысл'
};
const fallbackText = `Современная коммуникация — это не только красивая речь, но и способность быстро формулировать мысль.

Люди редко запоминают длинные фразы. Они запоминают ясность, уверенность и ощущение, что человек понимает, о чём говорит.

Даже сильные специалисты часто теряются, когда нужно объяснить идею коротко, ответить без подготовки или убедительно защитить позицию.

Хорошая речь — это не талант. Это навык, который развивается через практику.`;

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
        <Button onClick={next}>Начать</Button>
      </div>
    </main>
  );
}
function Reading({ next, back, text }) {
  return <main className="screen dark reading"><Back onClick={back}/>
    <h2>{noWidow('Прочитайте текст и подготовьтесь передать его смысл своими словами')}</h2>
    <section className="readCard">{text.split('\n').map((p,i)=><p key={i}>{noWidow(p)}</p>)}</section>
    <div className="bottom"><Button onClick={next}>Дальше</Button><Dots active={0}/></div>
  </main>;
}
function RecordingIntro({ next, back }) {
  return (
    <main className="screen dark intro">
      <Back onClick={back} />

      <div className="centerText">
        <h2>{noWidow('Расскажите, как вы поняли текст')}</h2>

        <p>
          {noWidow('Не пытайтесь повторить текст дословно. Главное — передать смысл ясно и уверенно.')}
        </p>
      </div>

      <div className="bottom">
        <Button onClick={next}>Начать запись</Button>
        <Dots active={1}/>
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

      {!recording ? (
        <></>
      ) : (
        <>
          <div className="micWrap">
            <div className="rings" style={{ '--ring-scale': 1 + volume * 0.4 }} />
            <img src="/mic.svg" alt="" className="mic-fixed" />
          </div>
          <div className="timer">{mm}:{ss}</div>
        </>
      )}

      <div className="bottom">
  {recording && (
    <>
      <Button onClick={stop}>Остановить запись</Button>
      <Dots active={1} />
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
  const [open,setOpen]=useState(false); 
  const sheetRef=useRef(null);
  const touchStart=useRef(0);
 const s = result?.scores || {
  cleanliness: 74,
  vocabulary: 58,
  confidence: 45,
  meaning: 82
};
const [animatedScores, setAnimatedScores] = useState({
  cleanliness: 0,
  vocabulary: 0,
  confidence: 0,
  meaning: 0
});

useEffect(() => {
  const keys = ['cleanliness', 'vocabulary', 'confidence', 'meaning'];

  keys.forEach((key, index) => {
    setTimeout(() => {
      let current = 0;
      const target = s[key] || 0;

      const timer = setInterval(() => {
        current += 2;

        if (current >= target) {
          current = target;
          clearInterval(timer);
        }

        setAnimatedScores(prev => ({
          ...prev,
          [key]: current
        }));
      }, 16);
    }, index * 450);
  });
}, [result]);
  
  useEffect(()=>{
    const sheet=sheetRef.current;
    const handle=sheet?.querySelector('.sheetHandle');
    if(!handle) return;
    
    const handleTouchStart=(e)=>{ touchStart.current=e.touches[0].clientY };
    const handleTouchEnd=(e)=>{
      const diff=touchStart.current-e.changedTouches[0].clientY;
      if(diff>50 && !open) setOpen(true);
      if(diff<-50 && open) setOpen(false);
    };
    
    handle.addEventListener('touchstart',handleTouchStart);
    handle.addEventListener('touchend',handleTouchEnd);
    return()=>{handle.removeEventListener('touchstart',handleTouchStart);handle.removeEventListener('touchend',handleTouchEnd)};
  },[open]);
  
  return <main className="screen light result"><h2>Ваш речевой профиль</h2>
    <section className="scoreCard">{Object.entries(labels).map(([k,v])=><div className="score" key={k}><span>{v}</span><div><b style={{width:`${animatedScores[k] || 0}%`}}/></div></div>)}</section>
    <p className="comment">{noWidow(result?.comment || 'Вы хорошо удерживаете основную мысль и уверенно формулируете идеи. Стоит поработать над количеством пауз и разнообразием формулировок.')}</p>
    <section ref={sheetRef} className={`sheet ${open?'open':''}`}>
      <div className="sheetHandle"/>
      <p className="sheetTitle">{noWidow('Мы создаём ТОЛК — тренажер для развития уверенной устной речи, словарного запаса через короткие тренировки.')}</p>
      {open && <img src="/logolight.svg" className="sheetLogo" alt="ТОЛК"/>}
    </section>
    <div className="bottom">
      {open && <p className="sheetSub">{noWidow('Подпишитесь, чтобы получить приглашение в числе первых пользователей.')}</p>}
      <Button onClick={()=>setOpen(true)}>Получить приглашение</Button>
      {open && (
  <div className="socials">
    <a href="https://vk.com/tolk_app" target="_blank" rel="noopener noreferrer">
      <Button outline>
        <img src="/logovk.svg" alt="VK" />
      </Button>
    </a>

    <a href="https://t.me/tolk_app" target="_blank" rel="noopener noreferrer">
      <Button outline>
        <img src="/logotelegram.svg" alt="Telegram" />
      </Button>
    </a>
  </div>
)}
      <Dots active={2}/>
    </div>
  </main>;
}
function App(){
  const [step,setStep]=useState(0), [text,setText]=useState(fallbackText), [result,setResult]=useState(null);

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

    try{
      const r=await fetch(`${API}/api/analyze`,{method:'POST',body:fd});
      const data=await r.json();
      await new Promise(res=>setTimeout(res,2300));
      setResult(data);
    }catch{
      await new Promise(res=>setTimeout(res,2300));
      setResult(null);
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
