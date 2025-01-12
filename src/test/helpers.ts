export const formatQueryString = (str: string): string => {
  let result = str
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

  for (const keyword of [
    'select',
    'as',
    'from',
    'left',
    'join',
    'on',
    'where',
    'distinct',
    'order',
    'by',
    'asc',
    'in',
    'group',
    'COALESCE',
    'JSON_AGG',
    'and',
  ]) {
    result = result.replace(
      new RegExp(`\\b${keyword}\\b`, 'gi'),
      keyword.toUpperCase(),
    );
  }

  return result;
};

export const expectQuery = (actual: any, expected: string) => {
  const receivedString = formatQueryString(String(actual));
  const expectedString = formatQueryString(expected);

  expect(receivedString).toEqual(expectedString);
};
