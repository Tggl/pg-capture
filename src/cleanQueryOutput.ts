/**
 * - Flattens arrays
 * - Removes null values from array
 */
export const cleanQueryOutput = <In, Out = In>(value: In): Out => {
  if (Array.isArray(value)) {
    return value.flatMap(cleanQueryOutput).filter(v => v !== null) as Out;
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as any)) {
      // @ts-ignore
      value[key] = cleanQueryOutput(value[key]);
    }
  }

  return value as unknown as Out;
};
