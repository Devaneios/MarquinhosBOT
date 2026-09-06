// Split out from GameDefinition so `bot` and the client-facing view types can
// refer to it without importing the whole definition contract.
export interface LegalMove {
  move: string;
  args?: unknown;
}
