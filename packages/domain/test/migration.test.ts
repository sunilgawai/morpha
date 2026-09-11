import { describe, expect, it } from "vitest";
import type {
  DocumentMigration,
  MigrateDocument,
  SerializedPresentationDocument,
  UnknownDocument,
  WidgetDataMigrator,
} from "../src/index";
import {
  CURRENT_SCHEMA_VERSION,
  needsWidgetDataMigration,
  UnsupportedSchemaVersionError,
  UnsupportedWidgetDataVersionError,
} from "../src/index";
import { fixtureSerializedDocument } from "../src/testing/index";

describe("CURRENT_SCHEMA_VERSION", () => {
  it("starts at 1 (Domain-Model.md §3; Design Principle 9)", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it("matches what the canonical fixture declares", () => {
    expect(fixtureSerializedDocument().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

/**
 * The point of a contract-shapes task is that the contract is *implementable*.
 * These build a synthetic three-version chain against the declared shapes —
 * deliberately in the test, because the runner that composes steps at load time
 * belongs to `presentation-serialization` (Serialization.md §10 step 3), not
 * here. If the shapes were wrong, this would not compile.
 */
describe("DocumentMigration supports the chained pattern (Serialization.md §15)", () => {
  const one_to_two: DocumentMigration = {
    from: 1,
    to: 2,
    migrate: (doc) => ({ ...doc, schemaVersion: 2, addedInV2: true }),
  };
  const two_to_three: DocumentMigration = {
    from: 2,
    to: 3,
    migrate: (doc) => ({ ...doc, schemaVersion: 3, addedInV3: true }),
  };
  const chain = [one_to_two, two_to_three];

  /** A minimal runner, standing in for the one Serialization.md §10 owns. */
  const runChain = (doc: UnknownDocument, fromVersion: number, target: number): UnknownDocument => {
    let current = doc;
    for (let version = fromVersion; version < target; version += 1) {
      const step = chain.find((s) => s.from === version);
      if (step === undefined) {
        throw new UnsupportedSchemaVersionError(
          fromVersion,
          target,
          `no migration from ${version}`,
        );
      }
      current = step.migrate(current);
    }
    return current;
  };

  it("applies every step in sequence rather than one jump", () => {
    const result = runChain({ schemaVersion: 1 }, 1, 3);
    expect(result).toEqual({ schemaVersion: 3, addedInV2: true, addedInV3: true });
  });

  it("is a no-op when the document is already current", () => {
    const doc = { schemaVersion: 3 };
    expect(runChain(doc, 3, 3)).toBe(doc);
  });

  it("declares single-version steps only", () => {
    for (const step of chain) {
      expect(step.to).toBe(step.from + 1);
    }
  });

  it("fails loudly on a gap in the chain", () => {
    expect(() => runChain({ schemaVersion: 1 }, 1, 5)).toThrow(UnsupportedSchemaVersionError);
  });

  it("satisfies the MigrateDocument entry-point signature", () => {
    const migrate: MigrateDocument = (doc, fromVersion) =>
      runChain(
        doc,
        fromVersion,
        CURRENT_SCHEMA_VERSION,
      ) as unknown as SerializedPresentationDocument;
    expect(migrate({ schemaVersion: 1 }, 1).schemaVersion).toBe(1);
  });
});

describe("widget data migration flow (Widget-System.md §10)", () => {
  const definition: WidgetDataMigrator<{ text: string; letterSpacing: number }> = {
    version: 3,
    migrate: (data, fromVersion) => {
      const value = data as { text?: string; letterSpacing?: number };
      return {
        text: value.text ?? "",
        letterSpacing: fromVersion < 3 ? 0 : (value.letterSpacing ?? 0),
      };
    },
  };

  it("detects an instance older than its definition", () => {
    expect(needsWidgetDataMigration(1, definition)).toBe(true);
    expect(needsWidgetDataMigration(2, definition)).toBe(true);
  });

  it("leaves a current instance alone", () => {
    expect(needsWidgetDataMigration(3, definition)).toBe(false);
  });

  it("reports no migration needed when the instance is somehow newer", () => {
    // Detection only — Serialization.md §11's quarantine policy decides what
    // the load does about it, and that is not this module's call.
    expect(needsWidgetDataMigration(4, definition)).toBe(false);
  });

  it("advances data through the definition's own migrate", () => {
    expect(definition.migrate?.({ text: "hi" }, 1)).toEqual({ text: "hi", letterSpacing: 0 });
  });

  it("treats a definition without migrate as legal (it is optional)", () => {
    const noMigrate: WidgetDataMigrator = { version: 2 };
    expect(needsWidgetDataMigration(1, noMigrate)).toBe(true);
    expect(noMigrate.migrate).toBeUndefined();
  });

  it("keeps the widget axis independent of the document axis", () => {
    // Serialization.md §15: a flat document schemaVersion while widget
    // dataVersions advance is the expected case, not an edge case.
    const doc = fixtureSerializedDocument();
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(needsWidgetDataMigration(1, definition)).toBe(true);
  });
});

describe("typed failures (Serialization.md §15)", () => {
  it("carries both versions and a readable message", () => {
    const error = new UnsupportedSchemaVersionError(9);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UnsupportedSchemaVersionError");
    expect(error.foundVersion).toBe(9);
    expect(error.supportedVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(error.message).toContain("9");
  });

  it("is catchable by class, so callers need not match on strings", () => {
    try {
      throw new UnsupportedWidgetDataVersionError("text", 5, 2);
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedWidgetDataVersionError);
      const typed = error as UnsupportedWidgetDataVersionError;
      expect(typed.widgetType).toBe("text");
      expect(typed.foundVersion).toBe(5);
      expect(typed.supportedVersion).toBe(2);
    }
  });
});
