'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Animated marketing hero for the public landing page (/).
// Self-contained dark "band" with a looping flip demo:
// a piece moves Sourced -> Sold, costs stack, profit pops, and the
// lifetime "profit so far" score climbs the real ranks (Rookie -> Flipper).

type Chip = { id: number; text: string }

export default function AnimatedHero({
  foundingSpotsLeft = 0,
}: {
  foundingSpotsLeft?: number
}) {
  const [stage, setStage] = useState(-1) // -1..3  (Sourced, In progress, Listed, Sold)
  const [rows, setRows] = useState([false, false, false])
  const [fixed, setFixed] = useState(false)
  const [ptag, setPtag] = useState('Curbside find')
  const [showProfit, setShowProfit] = useState(false)
  const [profitVal, setProfitVal] = useState(0) // this flip's profit
  const [lifetime, setLifetime] = useState(2890) // profit so far (the score)
  const [rank, setRank] = useState('Rookie')
  const [toNext, setToNext] = useState('$110 to Flipper')
  const [levelUp, setLevelUp] = useState(false)
  const [chips, setChips] = useState<Chip[]>([])

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafs = useRef<number[]>([])
  const alive = useRef(true)
  const chipId = useRef(0)

  useEffect(() => {
    alive.current = true

    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(() => alive.current && fn(), ms))
    }

    const animateValue = (
      setter: (n: number) => void,
      from: number,
      to: number,
      dur: number
    ) => {
      const start = performance.now()
      const step = (t: number) => {
        if (!alive.current) return
        const k = Math.min((t - start) / dur, 1)
        const eased = 1 - Math.pow(1 - k, 3)
        setter(Math.round(from + (to - from) * eased))
        if (k < 1) rafs.current.push(requestAnimationFrame(step))
      }
      rafs.current.push(requestAnimationFrame(step))
    }

    const addChip = (text: string) => {
      const id = ++chipId.current
      setChips((c) => [...c, { id, text }])
      at(3600, () => setChips((c) => c.filter((x) => x.id !== id)))
    }

    const reset = () => {
      setStage(-1)
      setRows([false, false, false])
      setFixed(false)
      setPtag('Curbside find')
      setShowProfit(false)
      setProfitVal(0)
      setLifetime(2890)
      setRank('Rookie')
      setToNext('$110 to Flipper')
      setLevelUp(false)
      setChips([])
    }

    const showRow = (i: number) =>
      setRows((r) => r.map((v, idx) => (idx === i ? true : v)))

    const run = () => {
      reset()
      at(400, () => {
        setStage(0)
        setPtag('Sourced')
      })
      at(900, () => showRow(0))
      at(2200, () => {
        setStage(1)
        setPtag('In progress · logging costs')
      })
      at(2700, () => showRow(1))
      at(4000, () => {
        setStage(2)
        setPtag('Listed · live for buyers')
      })
      at(5400, () => {
        setStage(3)
        setFixed(true)
        setPtag('Sold!')
      })
      at(5900, () => showRow(2))
      at(6500, () => {
        setShowProfit(true)
        animateValue(setProfitVal, 0, 163, 1100)
      })
      at(6800, () => {
        addChip('+$163')
        animateValue(setLifetime, 2890, 3053, 1300)
      })
      at(8200, () => {
        setRank('Flipper')
        setToNext('$6,947 to Heavy Hitter')
        setLevelUp(true)
      })
      at(10800, () => setLevelUp(false))
      at(12500, run) // loop
    }

    run()

    return () => {
      alive.current = false
      timers.current.forEach(clearTimeout)
      rafs.current.forEach(cancelAnimationFrame)
      timers.current = []
      rafs.current = []
    }
  }, [])

  const pills = ['Sourced', 'In progress', 'Listed', 'Sold']

  return (
    <section className="fwh-hero">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="fwh-glow" aria-hidden="true" />

      <div className="fwh-wrap">
        {/* LEFT: words */}
        <div className="fwh-copy">
          <span className="fwh-kicker">
            <span className="fwh-dot" /> Source · Fix · Sell · Level up
          </span>
          <h1 className="fwh-h1">
            <span className="fwh-ln">Flip furniture.</span>
            <span className="fwh-ln">
              <span className="fwh-hl">Build your empire.</span>
            </span>
          </h1>
          <p className="fwh-sub">
            FlipWork turns flipping into a game you actually want to play —{' '}
            <b>log every dollar</b>, climb the ranks, and watch your{' '}
            <b>real profit</b> grow. All from your phone.
          </p>
          <div className="fwh-cta">
            <Link href="/auth/signup" className="fwh-btn fwh-btn-primary">
              Start your empire — free
            </Link>
            <Link href="#how" className="fwh-btn fwh-btn-ghost">
              See how it works
            </Link>
          </div>

          {foundingSpotsLeft > 0 && (
            <div className="fwh-trust">
              <span className="fwh-chk">★</span> {foundingSpotsLeft} founding
              member spots left · free to start · works on your phone
            </div>
          )}
          {foundingSpotsLeft <= 0 && (
            <div className="fwh-trust">
              <span className="fwh-chk">✓</span> Free to start · works on your
              phone · built for solo flippers
            </div>
          )}
        </div>

        {/* RIGHT: live flip demo */}
        <div className={`fwh-demo${fixed ? ' fixed' : ''}`}>
          {levelUp && <div className="fwh-levelup">★ Flipper unlocked</div>}

          <div className="fwh-hud">
            <div className="fwh-rank">{rank}</div>
            <div className="fwh-score">${lifetime.toLocaleString()}</div>
            <div className="fwh-scorelbl">profit so far</div>
            <div className="fwh-tonext">{toNext}</div>
          </div>

          <div className="fwh-stages">
            {pills.map((label, i) => (
              <div
                key={label}
                className={`fwh-pill${
                  stage > i ? ' done' : stage === i ? ' active' : ''
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="fwh-piece">
            <svg className="fwh-dresser" viewBox="0 0 100 100" aria-hidden="true">
              <rect className="leg" x="14" y="84" width="8" height="12" rx="1" />
              <rect className="leg" x="78" y="84" width="8" height="12" rx="1" />
              <rect className="body" x="10" y="14" width="80" height="74" rx="6" />
              <rect className="drawer" x="18" y="22" width="64" height="18" rx="3" />
              <rect className="drawer" x="18" y="44" width="64" height="18" rx="3" />
              <rect className="drawer" x="18" y="66" width="64" height="14" rx="3" />
              <circle className="knob" cx="50" cy="31" r="3" />
              <circle className="knob" cx="50" cy="53" r="3" />
              <circle className="knob" cx="50" cy="73" r="3" />
            </svg>
            <div className="fwh-pinfo">
              <div className="fwh-pname">Mid-century dresser</div>
              <div className="fwh-ptag">{ptag}</div>
            </div>
          </div>

          <div className="fwh-ledger">
            <div className={`fwh-row${rows[0] ? ' show' : ''}`}>
              <span className="lbl">▸ Paid (purchase)</span>
              <span className="neg">–$45</span>
            </div>
            <div className={`fwh-row${rows[1] ? ' show' : ''}`}>
              <span className="lbl">▸ Materials &amp; labor</span>
              <span className="neg">–$32</span>
            </div>
            <div className={`fwh-row${rows[2] ? ' show' : ''}`}>
              <span className="lbl">▸ Sold for</span>
              <span className="pos">+$240</span>
            </div>
          </div>

          <div className={`fwh-profit${showProfit ? ' show' : ''}`}>
            <span className="plbl">This flip</span>
            <span className="pval">${profitVal.toLocaleString()}</span>
          </div>

          {chips.map((c) => (
            <span
              key={c.id}
              className="fwh-cchip"
              style={{ left: `${20 + ((c.id * 23) % 55)}%` }}
            >
              {c.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

const CSS = `
.fwh-hero{
  --ink:#15110b; --ink2:#201a12; --ink3:#2a2218;
  --cream:#f7f0e2; --muted:#b6a98f;
  --amber:hsl(32 90% 50%); --amber-soft:hsl(34 92% 62%);
  --line:rgba(247,240,226,.12);
  position:relative; overflow:hidden;
  background:var(--ink); color:var(--cream);
  padding:72px 24px; min-height:600px;
  display:flex; align-items:center;
  font-family:var(--font-dm-sans),system-ui,sans-serif;
}
.fwh-glow{
  position:absolute; top:-25%; right:-10%; width:70vw; height:70vw;
  background:radial-gradient(circle at center, hsla(32,90%,50%,.20), transparent 60%);
  pointer-events:none; animation:fwh-breathe 7s ease-in-out infinite;
}
@keyframes fwh-breathe{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
.fwh-wrap{
  position:relative; z-index:2; width:100%; max-width:1180px; margin:0 auto;
  display:grid; grid-template-columns:1.05fr .95fr; gap:64px; align-items:center;
}
.fwh-kicker{
  display:inline-flex; align-items:center; gap:10px;
  font-family:var(--font-dm-mono),monospace; font-size:13px;
  letter-spacing:.14em; text-transform:uppercase; color:var(--amber-soft);
  border:1px solid var(--line); border-radius:999px; padding:7px 14px;
  margin-bottom:26px; opacity:0; animation:fwh-rise .7s ease .15s forwards;
}
.fwh-dot{width:7px;height:7px;border-radius:50%;background:var(--amber);box-shadow:0 0 10px var(--amber)}
.fwh-h1{
  font-family:var(--font-dm-serif),Georgia,serif; font-weight:400;
  font-size:clamp(38px,5.4vw,66px); line-height:1.02; letter-spacing:-.5px; margin:0 0 22px;
}
.fwh-ln{display:block;opacity:0;transform:translateY(18px);animation:fwh-rise .8s ease forwards}
.fwh-ln:nth-child(1){animation-delay:.30s}
.fwh-ln:nth-child(2){animation-delay:.48s}
.fwh-hl{color:var(--amber)}
.fwh-sub{
  font-size:clamp(16px,1.5vw,19px); line-height:1.6; color:var(--muted);
  max-width:30em; margin:0 0 34px; opacity:0; animation:fwh-rise .8s ease .72s forwards;
}
.fwh-sub b{color:var(--cream);font-weight:500}
.fwh-cta{display:flex;flex-wrap:wrap;gap:14px;opacity:0;animation:fwh-rise .8s ease .9s forwards}
.fwh-btn{
  font-size:16px; font-weight:500; border-radius:12px; padding:15px 26px;
  cursor:pointer; border:1px solid transparent; text-decoration:none;
  display:inline-flex; align-items:center; gap:9px;
  transition:transform .15s ease, box-shadow .25s ease, border-color .2s ease;
}
.fwh-btn-primary{background:var(--amber);color:#1b1305;box-shadow:0 8px 28px hsla(32,90%,50%,.35);animation:fwh-pulse 3.2s ease-in-out 1.6s infinite}
.fwh-btn-primary:hover{transform:translateY(-2px)}
.fwh-btn-ghost{background:transparent;color:var(--cream);border-color:var(--line)}
.fwh-btn-ghost:hover{transform:translateY(-2px);border-color:var(--muted)}
@keyframes fwh-pulse{0%,100%{box-shadow:0 8px 28px hsla(32,90%,50%,.30)}50%{box-shadow:0 8px 38px hsla(32,90%,50%,.6)}}
.fwh-trust{margin-top:30px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;opacity:0;animation:fwh-rise .8s ease 1.1s forwards}
.fwh-chk{color:var(--amber-soft)}

.fwh-demo{
  position:relative; background:var(--ink2); border:1px solid var(--line);
  border-radius:22px; padding:24px; box-shadow:0 30px 80px rgba(0,0,0,.5);
  opacity:0; animation:fwh-rise .9s ease .55s forwards;
}
.fwh-hud{
  background:var(--ink); border:1px solid var(--line); border-radius:14px;
  padding:14px 16px; margin-bottom:18px; text-align:center;
}
.fwh-rank{font-family:var(--font-dm-sans),sans-serif;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--amber-soft)}
.fwh-score{font-family:var(--font-dm-mono),monospace;font-size:38px;font-weight:500;line-height:1.1;color:var(--amber);text-shadow:0 0 24px hsla(32,90%,50%,.5);margin-top:4px}
.fwh-scorelbl{font-family:var(--font-dm-sans),sans-serif;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.fwh-tonext{font-size:12px;color:var(--muted);margin-top:8px}

.fwh-levelup{
  position:absolute; top:64px; right:24px;
  font-family:var(--font-dm-mono),monospace; font-size:12px; font-weight:500;
  color:#1b1305; background:var(--amber-soft); border-radius:999px; padding:6px 13px;
  box-shadow:0 0 24px hsla(32,90%,55%,.7); z-index:5; pointer-events:none;
  animation:fwh-popup 2.6s ease forwards;
}
@keyframes fwh-popup{
  0%{opacity:0;transform:scale(.8) translateY(6px)}
  10%{opacity:1;transform:scale(1.05) translateY(0)}
  18%{transform:scale(1) translateY(0)}
  82%{opacity:1}
  100%{opacity:0;transform:scale(1) translateY(-6px)}
}

.fwh-stages{display:flex;gap:6px;margin-bottom:18px}
.fwh-pill{
  flex:1;text-align:center;font-size:11.5px;font-weight:500;letter-spacing:.02em;
  color:var(--muted);background:var(--ink3);border:1px solid transparent;border-radius:8px;
  padding:8px 4px;transition:all .4s ease;
}
.fwh-pill.done{color:var(--cream);opacity:.65}
.fwh-pill.active{color:#1b1305;background:var(--amber);border-color:var(--amber);box-shadow:0 0 18px hsla(32,90%,50%,.5);transform:translateY(-2px)}

.fwh-piece{display:flex;gap:18px;align-items:center;background:var(--ink);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:16px}
.fwh-dresser{width:84px;height:84px;flex-shrink:0;transition:all .6s ease}
.fwh-dresser .body{fill:#4a443b;transition:fill .8s ease}
.fwh-dresser .drawer{fill:none;stroke:#2a261f;stroke-width:2}
.fwh-dresser .knob{fill:#6b6457;transition:fill .8s ease}
.fwh-dresser .leg{fill:#3a352d}
.fwh-demo.fixed .fwh-dresser .body{fill:#a76a2e}
.fwh-demo.fixed .fwh-dresser .knob{fill:var(--amber-soft)}
.fwh-demo.fixed .fwh-dresser{filter:drop-shadow(0 0 16px hsla(32,90%,50%,.35))}
.fwh-pinfo{flex:1;min-width:0}
.fwh-pname{font-size:16px;font-weight:500;margin-bottom:4px}
.fwh-ptag{font-size:12px;color:var(--muted)}

.fwh-ledger{display:flex;flex-direction:column}
.fwh-row{
  display:flex;justify-content:space-between;align-items:center;
  font-family:var(--font-dm-mono),monospace;font-size:15px;padding:10px 2px;
  border-bottom:1px solid var(--line);opacity:0;transform:translateX(10px);
  transition:opacity .5s ease, transform .5s ease;
}
.fwh-row.show{opacity:1;transform:translateX(0)}
.fwh-row .lbl{color:var(--muted)}
.fwh-row .neg{color:#e7937a}
.fwh-row .pos{color:var(--cream)}

.fwh-profit{
  margin-top:14px;
  background:linear-gradient(180deg, hsla(32,90%,50%,.16), hsla(32,90%,50%,.04));
  border:1px solid hsla(32,90%,50%,.4); border-radius:14px; padding:14px 18px;
  display:flex;align-items:center;justify-content:space-between;
  opacity:0;transform:scale(.96);transition:opacity .5s ease, transform .5s ease;
}
.fwh-profit.show{opacity:1;transform:scale(1)}
.fwh-profit .plbl{font-size:13px;color:var(--amber-soft);font-weight:500;letter-spacing:.04em;text-transform:uppercase;font-family:var(--font-dm-mono),monospace}
.fwh-profit .pval{font-family:var(--font-dm-mono),monospace;font-size:30px;font-weight:500;color:var(--amber);text-shadow:0 0 24px hsla(32,90%,50%,.5)}

.fwh-cchip{
  position:absolute;bottom:28px;font-family:var(--font-dm-mono),monospace;font-size:13px;
  color:var(--amber-soft);background:var(--ink3);border:1px solid var(--line);
  border-radius:999px;padding:5px 11px;pointer-events:none;z-index:1;
  animation:fwh-float 3.4s ease-out forwards;
}
@keyframes fwh-float{
  0%{opacity:0;transform:translateY(20px) scale(.9)}
  15%{opacity:1}80%{opacity:1}
  100%{opacity:0;transform:translateY(-70px) scale(1)}
}

@keyframes fwh-rise{to{opacity:1;transform:translateY(0)}}

@media (max-width:880px){
  .fwh-hero{padding:54px 20px;min-height:0}
  .fwh-wrap{grid-template-columns:1fr;gap:40px}
  .fwh-h1{font-size:clamp(34px,9vw,52px)}
  .fwh-demo{max-width:460px;margin:0 auto;width:100%}
}
`
