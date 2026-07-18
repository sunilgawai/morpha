import { INSPECTOR_PROBES, PROBE_GROUPS, type ProbeGroup } from "./inspector/probes";
import { INSPECTOR_TARGETS } from "./inspector/target";

const GROUP_LABEL: Record<ProbeGroup, string> = {
  structure: "Structure",
  runtime: "Runtime",
  events: "Events",
  rendering: "Rendering",
  metrics: "Metrics",
  future: "Future",
};

// The Inspector shell: a grid of read-only probes grouped by concern
// (ADR-0011). No engine behavior is implemented; probes render their contract
// until a running engine is attached through public APIs.
export function App() {
  return (
    <div className="inspector">
      <header className="inspector__bar">
        <strong>morpha · Inspector</strong>
        <span className="inspector__hint">
          read-only runtime debugger — observes, never mutates
        </span>
        <span className="inspector__targets">attaches to: {INSPECTOR_TARGETS.join(", ")}</span>
      </header>

      <main className="inspector__grid">
        {PROBE_GROUPS.map((group) => (
          <section key={group} className="group">
            <h2 className="group__title">{GROUP_LABEL[group]}</h2>
            <div className="group__probes">
              {INSPECTOR_PROBES.filter((p) => p.group === group).map((p) => (
                <article key={p.id} className="probe">
                  <header className="probe__title">{p.title}</header>
                  <p className="probe__body">{p.observes}</p>
                  <code className="probe__doc">{p.governedBy}</code>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
