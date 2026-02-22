import superjson from 'superjson';

export  function jsonStringify(obj: unknown): string{
  return superjson.stringify(obj);
}

export  function jsonParse<T>(jsonStr: string): T {
  return superjson.parse<T>(jsonStr);
}

export  function parseJsonSafely<T>(jsonStr: string | null | undefined): T | null {
  if (!jsonStr) return null;
  try {
    const result = jsonParse<T>(jsonStr);
    if (!result) return null;
    return result;
  } catch {
      return null;
  }
}
