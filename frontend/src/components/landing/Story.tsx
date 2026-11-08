import { useEffect, useRef, useState, type ComponentType } from "react";
import { useInView, useMediaQuery } from "./hooks";
import { SceneBoundary, SceneChecks, SceneOutcome, SceneRisk, SceneSignature } from "./Scenes";

type Scene = {
  n: string;
  nav: string;
  title: string;
  body: string;
  facts: [string, string][];
  Art: ComponentType<{ animate: boolean }>;
  caption: string;
};

const SCENES: Scene[] = [
  {
    n: "01",
    nav: "The risk",
    title: "An agent with a key signs its own cheques.",
    body: "Most agent setups hand the model a private key. It writes the payment and signs it too, so one injected instruction is enough to empty the wallet. Nothing stands in between.",
    facts: [
      ["Who can move funds", "Whoever holds the key"],
      ["Checks before money moves", "None"],
    ],
    Art: SceneRisk,
    caption: "A typical agent setup, without IntentGuard.",
  },
  {
    n: "02",
    nav: "The draft",
    title: "IntentGuard takes the pen away.",
    body: "Funds sit in a vault owned by the IntentGuard program. The agent keeps one ability: drafting a payment and recording it on-chain. It can ask. It can't sign.",
    facts: [
      ["The agent can call", "propose_payment"],
      ["Funds moved", "None"],
    ],
    Art: SceneBoundary,
    caption: "Illustration of the vault and its policy.",
  },
  {
    n: "03",
    nav: "Your signature",
    title: "Only your signature releases it.",
    body: "The draft waits for you with the original request, the policy checks and a simulation of the exact balance change. Approve it in Phantom or reject it. Until then, nothing moves.",
    facts: [
      ["Signed by", "Your wallet, in Phantom"],
      ["Instruction", "approve_and_execute_payment"],
    ],
    Art: SceneSignature,
    caption: "Illustration. The bytes are the real owner approval on Devnet.",
  },
  {
    n: "04",
    nav: "The checks",
    title: "Solana checks every line. Twice.",
    body: "The program verifies the agent, the recipient, the limit, the vault's balance and the proposal's state when the agent proposes, and again when you approve. A compromised backend can't skip a step.",
    facts: [
      ["Runs in", "The IntentGuard program"],
      ["Checked", "On proposal and on approval"],
    ],
    Art: SceneChecks,
    caption: "Each check, in the order the program runs it.",
  },
  {
    n: "05",
    nav: "The outcome",
    title: "One clears. One is refused.",
    body: "A request inside your policy waits for your signature, then settles. Ask for 5 SOL against a 0.5 SOL limit and the program rejects the proposal on-chain before it ever reaches you.",
    facts: [
      ["Cleared by", "approve_and_execute_payment"],
      ["Refused with", "AmountExceedsPolicyLimit"],
    ],
    Art: SceneOutcome,
    caption: "Both signatures are real Devnet transactions, listed under Evidence.",
  },
];

/** Maps native scroll position inside a tall section to a scene index. No scroll hijacking. */
function useScrollScene(ref: React.RefObject<HTMLElement | null>, count: number, enabled: boolean) {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      el.style.setProperty("--story-progress", progress.toFixed(4));
      const next = Math.min(count - 1, Math.floor(progress * count));
      setScene((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref, count, enabled]);
  return scene;
}

export function Story() {
  const pinned = useMediaQuery("(min-width: 1024px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)");
  return (
    <section id="how" aria-labelledby="story-title" className="scroll-mt-16 border-t border-line">
      <h2 id="story-title" className="sr-only">
        How IntentGuard works, in five steps
      </h2>
      {pinned ? <PinnedStory /> : <StackedStory />}
    </section>
  );
}

function PinnedStory() {
  const ref = useRef<HTMLDivElement>(null);
  const scene = useScrollScene(ref, SCENES.length, true);

  const goTo = (index: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    const top = window.scrollY + rect.top + ((index + 0.5) / SCENES.length) * span;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div ref={ref} style={{ height: `${SCENES.length * 100}vh` }} className="relative">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center py-8">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[190px_minmax(0,1fr)_580px] xl:gap-14 2xl:grid-cols-[190px_minmax(0,1fr)_660px]">
          <nav aria-label="Story steps" className="relative hidden self-center xl:block">
            <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line" aria-hidden />
            <span className="story-progress absolute left-[5px] top-2 h-[calc(100%-1rem)] w-px bg-guard" aria-hidden />
            <ol className="space-y-5">
              {SCENES.map((s, i) => (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={scene === i ? "step" : undefined}
                    className="group flex items-center gap-3 rounded text-left"
                  >
                    <span
                      className={`relative z-10 h-[11px] w-[11px] rounded-full border transition-colors ${
                        scene === i ? "border-guard bg-guard" : scene > i ? "border-guard/60 bg-ink" : "border-line-strong bg-ink"
                      }`}
                      aria-hidden
                    />
                    <span className={`text-sm transition-colors ${scene === i ? "text-fg" : "text-faint group-hover:text-muted"}`}>
                      <span className="mr-2 font-mono text-xs">{s.n}</span>
                      {s.nav}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="grid">
            {SCENES.map((s, i) => (
              <div key={s.n} data-active={scene === i} className="scene-copy [grid-area:1/1]" aria-hidden={scene !== i}>
                <SceneCopy scene={s} />
              </div>
            ))}
          </div>

          {/* Sized by viewport height too, so the stage never slides under the header. */}
          <div className="mx-auto w-full max-w-[min(580px,calc((100vh-11rem)*1.1))] 2xl:max-w-[min(660px,calc((100vh-11rem)*1.1))]">
            <Stage scene={SCENES[scene]} key={scene} animate />
          </div>
        </div>
      </div>
    </div>
  );
}

function StackedStory() {
  return (
    <ol className="divide-y divide-line">
      {SCENES.map((s) => (
        <li key={s.n} className="grid items-center gap-8 py-14 sm:gap-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-16">
          <SceneCopy scene={s} />
          <StackedStage scene={s} />
        </li>
      ))}
    </ol>
  );
}

function SceneCopy({ scene }: { scene: Scene }) {
  return (
    <div className="max-w-xl">
      <p className="font-mono text-sm text-guard">{scene.n}</p>
      <h3 className="mt-3 text-balance font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[52px]">{scene.title}</h3>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">{scene.body}</p>
      <dl className="mt-7 grid gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
        {scene.facts.map(([k, v]) => (
          <div key={k}>
            <dt className="label-sm text-faint">{k}</dt>
            <dd className={`mt-1 ${/^[a-z_]+$|[A-Z][a-z]+[A-Z]/.test(v) ? "font-mono text-[12px]" : "text-[15px]"} text-fg`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Stacked scenes play once when they scroll into view, unless motion is reduced. */
function StackedStage({ scene }: { scene: Scene }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const seen = useInView(ref, "0px 0px -20% 0px", true);
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    if (seen) setPlayed(true);
  }, [seen]);
  return (
    <div ref={ref} className="-mx-4 sm:mx-0">
      <Stage scene={scene} animate={played && !reduced} key={played ? "play" : "rest"} />
    </div>
  );
}

function Stage({ scene, animate }: { scene: Scene; animate: boolean }) {
  const { Art } = scene;
  return (
    <figure className="circuit-stage mx-auto w-full max-w-[660px]">
      <Art animate={animate} />
      <figcaption className="mt-3 px-5 text-center text-xs text-faint sm:px-0">{scene.caption}</figcaption>
    </figure>
  );
}
