import { useEffect, useRef, useState } from "react";

const FORTUNES = [
  "{name}, something is standing behind you. Do not turn around yet.",
  "Tonight a stranger will hand you a candy that is not candy, {name}.",
  "{name}, your phone will ring at 3:07 AM. It will be you.",
  "The pumpkin has seen your search history, {name}. It forgives you. Barely.",
  "{name}, the third step on your stairs is not a step.",
  "Someone in your group chat is not a person, {name}. Count them.",
  "{name}, you will find a second shadow tomorrow. Be kind to it.",
  "A cat will stare at an empty corner tonight, {name}. Stare with it.",
];

const HIDDEN = [
  { e: "👻", x: "12%", y: "22%", s: "text-7xl" },
  { e: "🦇", x: "78%", y: "14%", s: "text-6xl" },
  { e: "💀", x: "84%", y: "62%", s: "text-7xl" },
  { e: "🕷️", x: "20%", y: "74%", s: "text-6xl" },
  { e: "🕸️", x: "46%", y: "86%", s: "text-6xl" },
  { e: "🧛", x: "6%", y: "48%", s: "text-6xl" },
  { e: "🎃", x: "62%", y: "34%", s: "text-5xl" },
];

function Pumpkin({ lit, shaking, onClick }) {
  const glow = lit ? "var(--color-slime)" : "var(--color-ember)";
  return (
    <button
      onClick={onClick}
      aria-label="Wake the pumpkin"
      className={`relative cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-bone rounded-full ${
        shaking ? "animate-shake" : "animate-float"
      }`}
    >
      <svg viewBox="0 0 200 180" className="w-56 sm:w-72 drop-shadow-[0_0_40px_rgba(255,122,26,0.55)]">
        <rect x="92" y="6" width="16" height="30" rx="5" fill="#4a7a2a" />
        <ellipse cx="62" cy="100" rx="52" ry="68" fill="#e0620d" />
        <ellipse cx="138" cy="100" rx="52" ry="68" fill="#e0620d" />
        <ellipse cx="100" cy="100" rx="56" ry="72" fill="#ff7a1a" />
        <path d="M100 30 Q86 100 100 170 M72 38 Q48 100 72 164 M128 38 Q152 100 128 164"
              stroke="#b84a05" strokeWidth="3" fill="none" />
        <g className="animate-flicker" fill={glow}>
          <path d="M58 82 L78 82 L68 62 Z" />
          <path d="M122 82 L142 82 L132 62 Z" />
          <path d="M60 116 L72 128 L82 118 L94 132 L106 118 L118 128 L128 116 L140 126 L128 148 L72 148 Z" />
        </g>
      </svg>
    </button>
  );
}

export default function App() {
  const rootRef = useRef(null);
  const [name, setName] = useState("");
  const [fortune, setFortune] = useState(null);
  const [shaking, setShaking] = useState(false);
  const [count, setCount] = useState(0);

  // flashlight follows mouse / finger
  useEffect(() => {
    const el = rootRef.current;
    el.style.setProperty("--x", "50%");
    el.style.setProperty("--y", "40%");
    const move = (e) => {
      el.style.setProperty("--x", `${e.clientX}px`);
      el.style.setProperty("--y", `${e.clientY}px`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, []);

  const wake = () => {
    const who = name.trim() || "stranger";
    const text = FORTUNES[Math.floor(Math.random() * FORTUNES.length)].replaceAll("{name}", who);
    setFortune({ text, verdict: Math.random() > 0.5 ? "TREAT" : "TRICK" });
    setCount((c) => c + 1);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const mask = "radial-gradient(circle 150px at var(--x) var(--y), #000 0%, #000 30%, transparent 100%)";

  return (
    <main
      ref={rootRef}
      className="relative h-dvh overflow-hidden touch-none select-none bg-[radial-gradient(ellipse_at_50%_0%,var(--color-plum),var(--color-ink)_70%)]"
    >
      {/* moon */}
      <div className="absolute -top-16 -right-16 size-56 rounded-full bg-bone opacity-90 shadow-[0_0_120px_30px_rgba(243,234,216,0.35)]" />

      {/* creatures only visible inside the flashlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ WebkitMaskImage: mask, maskImage: mask }}
      >
        {HIDDEN.map((h) => (
          <span key={h.e} className={`absolute ${h.s}`} style={{ left: h.x, top: h.y }}>
            {h.e}
          </span>
        ))}
      </div>

      {/* darkness ring around the light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle 220px at var(--x) var(--y), rgba(255,179,71,0.14), transparent 70%)",
        }}
      />

      <section className="relative z-10 mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="font-display text-5xl leading-none text-pumpkin sm:text-7xl animate-flicker">
          Don't wake the pumpkin
        </h1>
        <p className="text-bone/70">
          Drag your light around. Some things are hiding. Then tell the pumpkin your name.
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && wake()}
          maxLength={20}
          placeholder="your name"
          className="w-56 rounded-md border-2 border-pumpkin/60 bg-ink/70 px-4 py-2 text-center text-bone placeholder:text-bone/40 focus:border-slime focus:outline-none"
        />

        <Pumpkin lit={!!fortune} shaking={shaking} onClick={wake} />

        <div className="min-h-32 w-full">
          {fortune ? (
            <div key={count} className="animate-pop rounded-lg border-2 border-slime/70 bg-ink/80 p-5">
              <p className="text-lg text-bone">{fortune.text}</p>
              <p className="mt-3 font-display text-3xl text-slime">{fortune.verdict}</p>
            </div>
          ) : (
            <p className="text-bone/50">Tap the pumpkin.</p>
          )}
        </div>
      </section>
    </main>
  );
}
