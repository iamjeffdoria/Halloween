import { useEffect, useMemo, useRef, useState } from "react";
import ghostUrl from "./ghost.png";
import clipUrl from "./buseeng.mp4";

/* ---------- board layout (all positions are % of the board) ---------- */

const ROW1 = "ABCDEFGHIJKLM".split("");
const ROW2 = "NOPQRSTUVWXYZ".split("");
const NUMS = "1234567890".split("");

const POS = {};
ROW1.forEach((c, i) => (POS[c] = { x: 11 + i * (78 / 12), y: 56 - 7 * Math.sin((Math.PI * i) / 12) }));
ROW2.forEach((c, i) => (POS[c] = { x: 11 + i * (78 / 12), y: 74 - 7 * Math.sin((Math.PI * i) / 12) }));
NUMS.forEach((c, i) => (POS[c] = { x: 22 + i * (56 / 9), y: 87 }));
POS.YES = { x: 15, y: 15 };
POS.NO = { x: 85, y: 15 };
POS.GOODBYE = { x: 50, y: 95 };
const REST = { x: 50, y: 33 };

const LETTER_KEYS = [...ROW1, ...ROW2];
const QUICK = ["Is anyone here?", "Who are you?", "Who is behind me?", "Will I be okay?", "Does anyone like me?"];

/* ---------- what the spirits say (only A-Z, 0-9 and spaces!) ---------- */

const RULES = [
  {
    re: /\b(love|crush|date|dating|boyfriend|girlfriend|ex|kiss|married|marry|like me)\b/,
    a: ["THEY ARE WATCHING YOU SLEEP", "NO LOVE ONLY HUNGER", "YES BUT THEY ARE NOT ALIVE", "THEY SAID YOUR NAME 3 TIMES", "{N} THEY ALREADY KNOW"],
  },
  {
    re: /\b(die|death|dead|alive)\b/,
    a: ["NOT TONIGHT {N}", "ASK ME AT MIDNIGHT", "YOU ARE HALFWAY THERE", "DEATH IS SHY OF YOU", "YOU WOULD BE BAD AT IT"],
  },
  {
    re: /\b(anyone here|anybody|spirit|ghost|there)\b/,
    a: ["YES MANY OF US", "YES AND WE LIKE YOU", "NO ONLY YOU", "YES BEHIND YOU", "WE HAVE BEEN WAITING {N}"],
  },
  {
    re: /\b(where|behind|under|house|room|home)\b/,
    a: ["RIGHT BEHIND YOU", "UNDER THE BED", "IN THE WALLS", "THE THIRD STEP", "ONE ROOM AWAY"],
  },
  {
    re: /\b(who|name|what are you)\b/,
    a: ["I WAS HERE BEFORE THE HOUSE", "I AM IN YOUR PHOTOS", "CALL ME NOTHING", "YOUR GREAT GREAT GRANDMOTHER", "I AM {N} FROM TOMORROW"],
  },
  {
    re: /\b(friend|friends|group|family|crowd)\b/,
    a: ["ONE OF THEM IS NOT REAL", "COUNT THEM AGAIN", "THEY TALK ABOUT YOU", "THE QUIET ONE KNOWS"],
  },
  {
    re: /\b(money|rich|job|exam|test|school|win|pass)\b/,
    a: ["YES BUT YOU WILL PAY", "NO TRY HARDER", "ONLY IF THE LIGHT STAYS ON", "THE DEAD DO NOT CARE"],
  },
  {
    re: /^(will|is|am|are|do|does|can|should|did|was|have|would|could)\b/,
    a: ["YES", "NO", "YES BUT NOT FOR LONG", "NO NEVER", "YES IF YOU LEAVE NOW", "ASK AGAIN AT MIDNIGHT"],
  },
];

const DEFAULT = [
  "I SEE YOU {N}",
  "LOOK BEHIND YOU",
  "WHY ARE YOU STILL HERE",
  "DO NOT ASK AGAIN",
  "SOMEONE IS LAUGHING",
  "THE LIGHTS WILL GO OUT",
  "THEY KNOW YOUR NAME",
  "HELLO {N}",
  "IT IS VERY COLD HERE",
  "I LIKE YOUR VOICE {N}",
];

const clean = (n) => n.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12) || "STRANGER";

function pickAnswer(q, who) {
  const s = q.toLowerCase();
  const rule = RULES.find((r) => r.re.test(s));
  const pool = rule ? rule.a : DEFAULT;
  return pool[Math.floor(Math.random() * pool.length)].replaceAll("{N}", who);
}

function toTokens(text) {
  const out = [];
  text.split(" ").forEach((w, i) => {
    if (i) out.push(" ");
    if (w === "YES" || w === "NO" || w === "GOODBYE") out.push(w);
    else w.split("").forEach((c) => POS[c] && out.push(c));
  });
  return out;
}

const wander = () => ({ x: 20 + Math.random() * 60, y: 28 + Math.random() * 55 });
const buzz = (p) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not supported, fine */
  }
};

/* ---------- sound: everything is synthesized, no audio files ---------- */

function makeAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // low creepy drone
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.0001;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  [55, 55.7, 82.4].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start();
  });
  lp.connect(droneGain);
  droneGain.connect(master);
  droneGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.15;
  lfoGain.gain.value = 80;
  lfo.connect(lfoGain);
  lfoGain.connect(lp.frequency);
  lfo.start();

  // shared noise buffer
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = nb.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = (dur, f0, f1, vol, type = "bandpass", q = 1) => {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = nb;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(t);
    s.stop(t + dur + 0.05);
  };

  return {
    ctx,
    setMuted: (m) => master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05),
    whisper: () => noise(1.1, 2600, 1400, 0.1, "bandpass", 4),
    tick: (code = 65) => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(180 + (code % 26) * 14, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.2);
      noise(0.08, 1400, 500, 0.12);
    },
    scare: () => {
      const t = ctx.currentTime;
      const dur = 1.4;

      // overdrive so the scream sounds torn and distorted
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 7);
      const shaper = ctx.createWaveShaper();
      shaper.curve = curve;

      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.9, t + 0.04);
      out.gain.setValueAtTime(0.9, t + dur - 0.4);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      shaper.connect(out);
      out.connect(master);

      // vocal "ahhh" shape: three resonances that open up as the scream rises
      const formants = [
        [800, 8],
        [1400, 10],
        [2800, 12],
      ].map(([f, q]) => {
        const b = ctx.createBiquadFilter();
        b.type = "bandpass";
        b.Q.value = q;
        b.frequency.setValueAtTime(f, t);
        b.frequency.linearRampToValueAtTime(f * 1.4, t + 0.5);
        b.connect(shaper);
        return b;
      });

      // the shaking of a screaming voice
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vib.frequency.value = 9;
      vibGain.gain.value = 45;
      vib.connect(vibGain);

      // two slightly detuned voices that shoot up in pitch
      [0, 9].forEach((detune) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.detune.value = detune;
        o.frequency.setValueAtTime(350, t);
        o.frequency.exponentialRampToValueAtTime(950, t + 0.35);
        o.frequency.exponentialRampToValueAtTime(700, t + dur);
        vibGain.connect(o.frequency);
        formants.forEach((f) => o.connect(f));
        o.start(t);
        o.stop(t + dur + 0.05);
      });
      vib.start(t);
      vib.stop(t + dur + 0.05);

      // raspy breath on top
      noise(dur, 4200, 1500, 0.55, "bandpass", 0.8);

      // low boom for the impact
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.type = "sine";
      boom.frequency.setValueAtTime(90, t);
      boom.frequency.exponentialRampToValueAtTime(35, t + 0.5);
      boomGain.gain.setValueAtTime(0.7, t);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      boom.connect(boomGain);
      boomGain.connect(master);
      boom.start(t);
      boom.stop(t + 0.65);
    },
  };
}

/* ---------- small visual pieces ---------- */

function Planchette() {
  return (
    <svg viewBox="0 0 120 120" className="size-full drop-shadow-[0_8px_8px_rgba(0,0,0,0.75)]">
      <path
        d="M60 6 C96 10 114 48 108 82 C104 106 84 114 60 114 C36 114 16 106 12 82 C6 48 24 10 60 6Z"
        fill="#4a2c18"
        stroke="#1b0f08"
        strokeWidth="3"
      />
      <path d="M60 12 C88 16 104 50 99 80" stroke="#8a5a34" strokeWidth="3" fill="none" opacity="0.6" />
      <circle cx="60" cy="60" r="20" fill="rgba(191,232,255,0.2)" stroke="#1b0f08" strokeWidth="4" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="#c9974f" strokeWidth="1.5" />
    </svg>
  );
}

function GhostFace() {
  return (
    <svg viewBox="0 0 200 240" className="w-[78vmin] max-w-[560px] drop-shadow-[0_0_60px_rgba(191,232,255,0.9)]">
      <path
        d="M20 240 V100 C20 40 60 6 100 6 C140 6 180 40 180 100 V240 L150 215 L125 240 L100 215 L75 240 L50 215 Z"
        fill="#e8f6ff"
      />
      <ellipse cx="72" cy="95" rx="16" ry="26" fill="#000" />
      <ellipse cx="128" cy="95" rx="16" ry="26" fill="#000" />
      <ellipse cx="100" cy="162" rx="22" ry="40" fill="#000" />
    </svg>
  );
}

const GHOST_SRC = ghostUrl;

function GhostPhoto() {
  const [failed, setFailed] = useState(false);
  if (failed) return <GhostFace />;
  return (
    <img
      src={GHOST_SRC}
      alt=""
      onError={() => setFailed(true)}
      className="h-dvh w-screen object-cover"
    />
  );
}

// load the funny clip in the background so it starts instantly
const preloadClip = document.createElement("video");
preloadClip.preload = "auto";
preloadClip.src = clipUrl;

function Clip({ muted, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play().catch(() => {
      v.muted = true; // browser blocked sound, play silently instead
      v.play().catch(() => onDone());
    });
  }, []);
  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      <video
        ref={ref}
        src={clipUrl}
        muted={muted}
        playsInline
        onEnded={onDone}
        className="max-h-dvh max-w-full"
      />
    </div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const from = useMemo(() => (new URLSearchParams(window.location.search).get("from") || "").slice(0, 20), []);

  const [phase, setPhase] = useState("intro"); // intro | ready | thinking | spelling | done
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pos, setPos] = useState(REST);
  const [active, setActive] = useState(null);
  const [dark, setDark] = useState(false);
  const [scare, setScare] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState("");
  const [clip, setClip] = useState(false);

  const audio = useRef(null);
  const run = useRef(0);
  const asked = useRef(0);
  const mounted = useRef(true);
  const toastT = useRef(null);
  const firstHello = useRef(true);

  const busy = phase === "thinking" || phase === "spelling";
  const who = name.trim() || "stranger";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      run.current++;
      clearTimeout(toastT.current);
      try {
        audio.current?.ctx.close();
      } catch {
        /* already closed */
      }
    };
  }, []);

  useEffect(() => {
    audio.current?.setMuted(muted);
  }, [muted, phase]);

  // preload the ghost so the scare has zero lag
  useEffect(() => {
    const img = new Image();
    img.src = GHOST_SRC;
  }, []);

  // the planchette sometimes moves on its own while you wait...
  useEffect(() => {
    if (phase !== "ready" && phase !== "done") return;
    let t2;
    const t1 = setTimeout(() => {
      setPos(POS[LETTER_KEYS[Math.floor(Math.random() * LETTER_KEYS.length)]]);
      audio.current?.whisper();
      t2 = setTimeout(() => setPos(REST), 1800);
    }, 11000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2600);
  };

  const ensureAudio = () => {
    if (!audio.current) {
      try {
        audio.current = makeAudio();
      } catch {
        audio.current = null;
      }
    }
    audio.current?.ctx.resume?.();
  };

  const begin = () => {
    ensureAudio();
    audio.current?.whisper();
    setPhase("ready");
  };

  const ask = async (qText) => {
    const q = (qText ?? question).trim();
    if (!q) return flash("Ask the spirits something first.");
    if (busy) return;

    ensureAudio();
    const id = ++run.current;
    const alive = () => mounted.current && run.current === id;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    asked.current += 1;
    // after every refresh, the first "is anyone here" always gets the ghost
    let text = pickAnswer(q, clean(name));
    if (firstHello.current && /anyone|anybody/i.test(q)) {
      text = "YES BEHIND YOU";
      firstHello.current = false;
    }
    const doScare = /BEHIND|LIGHT|BED|WALLS|WATCHING|STEP/.test(text) || asked.current % 3 === 0;
    const instant = /BEHIND YOU/.test(text);

    setQuestion(q);
    setAnswer("");
    setActive(null);
    setPhase("thinking");
    audio.current?.whisper();

    for (let i = 0; i < 3; i++) {
      setPos(wander());
      await wait(650);
      if (!alive()) return;
    }

    setPhase("spelling");
    let shown = "";
    const tokens = toTokens(text);
    for (const [i, t] of tokens.entries()) {
      if (t === " ") {
        shown += " ";
        setAnswer(shown);
        await wait(450);
        if (!alive()) return;
        continue;
      }
      setPos(POS[t]);
      await wait(620);
      if (!alive()) return;
      setActive(t);
      audio.current?.tick(t.charCodeAt(0));
      buzz(25);
      shown += t;
      setAnswer(shown);
      if (instant && i === tokens.length - 1) break;
      await wait(380);
      if (!alive()) return;
      setActive(null);
      await wait(60);
      if (!alive()) return;
    }

    if (instant) {
      // no delay, no dark: the ghost appears the moment the word is spelled
      setActive(null);
      setScare(true);
      audio.current?.scare();
      buzz([250, 80, 350]);
      await wait(1400);
      if (!alive()) return;
      setScare(false);
      setPos(REST);
      setClip(true);
    } else {
      await wait(700);
      if (!alive()) return;
      setPos(REST);

      if (doScare) {
        await wait(900);
        if (!alive()) return;
        setDark(true);
        audio.current?.whisper();
        await wait(1400);
        if (!alive()) return;
        setScare(true);
        audio.current?.scare();
        buzz([250, 80, 350]);
        await wait(1400);
        if (!alive()) return;
        setScare(false);
        setDark(false);
        setClip(true);
      }
    }

    setQuestion("");
    setPhase("done");
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?from=${encodeURIComponent(who)}`;
    const text = `I asked the spirits a question and they said: "${answer}". Dare you to try it:`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Séance", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      flash("Copied. Send it to someone brave.");
    } catch {
      /* share cancelled */
    }
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_20%,#2a1030,var(--color-ink)_70%)]">
      {/* fog */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-1/4 h-80 w-[150%] animate-drift rounded-full bg-ghost/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1/4 bottom-10 h-72 w-[150%] animate-drift rounded-full bg-ghost/10 blur-3xl [animation-direction:alternate-reverse]"
      />
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.88)_100%)]"
      />

      {phase === "intro" ? (
        <section className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="animate-rise text-sm uppercase tracking-[0.3em] text-candle/80">
            {from ? `${from} dares you` : "Headphones on. Lights off."}
          </p>
          <h1 className="animate-flicker font-display text-7xl leading-none text-blood [text-shadow:0_0_30px_rgba(214,31,44,0.7)] sm:text-9xl">
            The Séance
          </h1>
          <p className="max-w-md text-bone/75">
            Ask the dead anything. They always answer. They are not always kind.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && begin()}
            maxLength={12}
            placeholder="your name"
            className="w-60 rounded-md border-2 border-candle/50 bg-ink/70 px-4 py-3 text-center text-lg text-bone placeholder:text-bone/40 focus:border-candle focus:outline-none"
          />
          <button
            onClick={begin}
            className="animate-glow cursor-pointer rounded-md bg-candle px-7 py-3 text-lg font-bold text-ink transition active:scale-95 hover:bg-bone focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-bone"
          >
            🕯️ Light the candles
          </button>
          <p className="text-xs text-bone/40">Sound on for the full experience.</p>
        </section>
      ) : (
        <section className="relative z-10 mx-auto flex h-dvh w-full max-w-3xl flex-col items-center justify-center gap-3 px-3 py-3">
          <header className="flex w-full items-center justify-between px-1">
            <p className="font-display text-3xl text-blood">The Séance</p>
            <div className="flex items-center gap-2">
              {phase === "done" && (
                <button
                  onClick={share}
                  className="cursor-pointer rounded-md border-2 border-blood px-3 py-1 text-sm text-blood transition active:scale-95 hover:bg-blood hover:text-bone"
                >
                  📨 Dare a friend
                </button>
              )}
              <button
                onClick={() => setMuted((m) => !m)}
                aria-pressed={muted}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                className="cursor-pointer rounded-md border border-bone/20 px-3 py-1 text-xl"
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          </header>

          {/* candle glow behind the board */}
          <div className="relative w-full" style={{ maxWidth: "max(12rem, calc((100dvh - 16rem) * 1.25))" }}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 -inset-y-4 animate-flicker rounded-full bg-candle/20 blur-3xl"
            />
            <div className="@container relative aspect-[5/4] w-full overflow-hidden rounded-2xl border-4 border-wood-light bg-wood bg-[repeating-linear-gradient(92deg,#3a2314_0_6px,#34200f_6px_11px,#3e271a_11px_15px)] shadow-[inset_0_0_80px_rgba(0,0,0,0.75),0_20px_60px_rgba(0,0,0,0.8)]">
              <span
                aria-hidden
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-board text-[3.6cqw] leading-none tracking-[0.4em] text-bone/25"
                style={{ top: "15%" }}
              >
                ☾ ✦ ☽
              </span>

              {Object.entries(POS).map(([k, p]) => (
                <span
                  key={k}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 select-none font-board leading-none transition-all duration-200 ${
                    k.length > 1
                      ? "text-[3.4cqw] tracking-widest"
                      : "text-[4cqw]"
                  } ${
                    active === k
                      ? "scale-150 text-candle [text-shadow:0_0_18px_#ffc46b]"
                      : "text-bone/80"
                  }`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                  {k}
                </span>
              ))}

              <div
                aria-hidden
                className="pointer-events-none absolute z-10 aspect-square w-[17%] -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[600ms] ease-in-out"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div className="size-full animate-wobble">
                  <Planchette />
                </div>
              </div>
            </div>
          </div>

          <p
            aria-live="polite"
            className="min-h-10 text-center font-board text-2xl tracking-[0.25em] text-candle [text-shadow:0_0_14px_rgba(255,196,107,0.6)] sm:text-3xl"
          >
            {answer || (phase === "thinking" ? "…" : "")}
          </p>

          {busy ? (
            <p className="text-bone/50">
              {phase === "thinking" ? "The spirits are gathering…" : "Do not touch the planchette."}
            </p>
          ) : (
            <div className="flex w-full max-w-2xl animate-rise flex-col items-center gap-3">
              <div className="flex w-full gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ask()}
                  maxLength={80}
                  placeholder={`Ask the dead, ${who}…`}
                  className="min-w-0 flex-1 rounded-md border-2 border-candle/50 bg-ink/70 px-4 py-3 text-bone placeholder:text-bone/40 focus:border-candle focus:outline-none"
                />
                <button
                  onClick={() => ask()}
                  className="cursor-pointer rounded-md bg-candle px-5 py-3 font-bold text-ink transition active:scale-95 hover:bg-bone"
                >
                  Ask
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="cursor-pointer rounded-full border border-bone/25 bg-ink/60 px-2.5 py-1 text-xs text-bone/80 transition active:scale-95 hover:border-candle hover:text-candle"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* lights out */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-150 ${
          dark ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* jump scare */}
      {scare && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
          <div className="animate-scare">
            <GhostPhoto />
          </div>
        </div>
      )}

      {clip && <Clip muted={muted} onDone={() => setClip(false)} />}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-bone px-4 py-2 text-ink shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}