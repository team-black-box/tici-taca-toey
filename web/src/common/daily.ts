// The daily puzzle generator lives in shared/daily.ts so every client
// derives the same board from the same date. This shim keeps the import
// path local, like rules.ts and ttn.ts.
export * from "../../../shared/daily";
