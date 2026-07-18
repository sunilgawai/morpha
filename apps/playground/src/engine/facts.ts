// Everything the Playground knows about the engine, read through PUBLIC
// exports only (ADR-0011 §4 invariant). As packages gain real surface area,
// this module grows — but it never reaches into a package's internals.
import { PACKAGE_NAME as domain, DECLARED_DEPENDENCIES as domainDeps } from "@morpha/domain";
import { PACKAGE_NAME as interaction } from "@morpha/interaction";
import { PACKAGE_NAME as react } from "@morpha/react";
import { PACKAGE_NAME as rendering } from "@morpha/rendering";
import { PACKAGE_NAME as runtime } from "@morpha/runtime";

export interface PackageFact {
  readonly name: string;
  readonly ring: number;
}

/** The packages the Playground currently consumes, with their ring. */
export const CONSUMED_PACKAGES: readonly PackageFact[] = [
  { name: domain, ring: 0 },
  { name: runtime, ring: 1 },
  { name: rendering, ring: 2 },
  { name: interaction, ring: 2 },
  { name: react, ring: 3 },
];

/** Proof the public graph resolves: domain (Ring 0) declares no dependencies. */
export const DOMAIN_IS_ROOT: boolean = domainDeps.length === 0;
