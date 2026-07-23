// Win rules live in shared/rules.ts now - one implementation for server,
// web, and mobile. This shim keeps server-local imports consistent with
// the notation.ts pattern.
export * from "../../shared/rules";
