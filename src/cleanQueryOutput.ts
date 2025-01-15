/**
 * - Flattens arrays
 * - Removes duplicates from arrays
 * - Removes null values from array
 */
export const cleanQueryOutput = (value: unknown) => {
  if (Array.isArray(value)) {
    const viewed = new Set<string>();
    return value.flatMap(cleanQueryOutput).filter(v => {
      const hash = JSON.stringify(v);
      const seen = viewed.has(hash);
      viewed.add(hash);
      return v !== null && !seen;
    });
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as any)) {
      value[key] = cleanQueryOutput(value[key]);
    }
  }

  return value;
};
