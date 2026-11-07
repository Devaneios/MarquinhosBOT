/** Preserve a JSON `null` body through Nest's Express adapter, which sends no body for `null`. */
export const jsonNull = Object.freeze({
  toJSON: () => null,
}) as unknown as null;
