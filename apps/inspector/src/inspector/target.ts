// Read-only facts about the engine the Inspector attaches to, via PUBLIC
// exports only (ADR-0011). An inspector observes; it never mutates or
// dispatches. When a real engine handle exists, it is passed in here — this
// module never widens into a mutation surface.
import { PACKAGE_NAME as devtools } from "@morpha/devtools";
import { PACKAGE_NAME as domain } from "@morpha/domain";
import { PACKAGE_NAME as runtime } from "@morpha/runtime";

export const INSPECTOR_TARGETS: readonly string[] = [domain, runtime, devtools];
