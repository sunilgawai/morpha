import type { PanelSpec } from "./panels";

// A placeholder panel. It renders the panel's contract (what it will
// visualize + which document governs it) so the shell is self-documenting
// until the backing engine capability exists.
export function Panel({ spec }: { spec: PanelSpec }) {
  return (
    <section className="panel">
      <header className="panel__title">{spec.title}</header>
      <p className="panel__body">{spec.visualizes}</p>
      <code className="panel__doc">{spec.governedBy}</code>
    </section>
  );
}
