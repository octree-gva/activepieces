export function assertProp(value: unknown, errorMessage: string): asserts value is NonNullable<typeof value> {
  if (!value) {
    throw new Error(errorMessage);
  }
}
