/**
 * - Flattens arrays
 * - Removes duplicates from arrays
 * - Removes null values from array
 */
export const cleanQueryOutput = <In, Out = In>(value: In): Out => {
  if (Array.isArray(value)) {
    const viewed = new Set<string>();
    return value.flatMap(cleanQueryOutput).filter(v => {
      const hash = JSON.stringify(v);
      const seen = viewed.has(hash);
      viewed.add(hash);
      return v !== null && !seen;
    }) as Out;
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as any)) {
      //@ts-ignore
      value[key] = cleanQueryOutput(value[key]);
    }
  }

  return value as unknown as Out;
};
