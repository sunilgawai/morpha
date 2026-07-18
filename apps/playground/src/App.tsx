import { CONSUMED_PACKAGES, DOMAIN_IS_ROOT } from "./engine/facts";
import { Panel } from "./shell/Panel";
import { panelsFor } from "./shell/panels";

// The Playground shell: an editor-shaped layout of placeholder regions that
// the engine will grow into (ADR-0011). No engine behavior is implemented
// here — only public @morpha/* exports are read.
export function App() {
  return (
    <div className="shell">
      <header className="shell__toolbar">
        <strong>morpha · Playground</strong>
        <span className="shell__hint">
          daily development environment — displays engine state as it is built
        </span>
        {panelsFor("toolbar").map((p) => (
          <span key={p.id} className="chip">
            {p.title}
          </span>
        ))}
      </header>

      <div className="shell__body">
        <aside className="shell__left">
          {panelsFor("left").map((p) => (
            <Panel key={p.id} spec={p} />
          ))}
        </aside>

        <main className="shell__center">
          {panelsFor("center").map((p) => (
            <Panel key={p.id} spec={p} />
          ))}
        </main>

        <aside className="shell__right">
          {panelsFor("right").map((p) => (
            <Panel key={p.id} spec={p} />
          ))}
        </aside>
      </div>

      <section className="shell__bottom">
        {panelsFor("bottom").map((p) => (
          <Panel key={p.id} spec={p} />
        ))}
      </section>

      <footer className="shell__statusbar">
        <span>Packages consumed (public exports only):</span>
        {CONSUMED_PACKAGES.map((pkg) => (
          <span key={pkg.name} className="chip">
            {pkg.name} <em>Ring {pkg.ring}</em>
          </span>
        ))}
        <span className="shell__ok">{DOMAIN_IS_ROOT ? "graph OK" : "graph BROKEN"}</span>
      </footer>
    </div>
  );
}
