import { format } from 'sql-formatter';

export function formatSqlQuery(query: string, dialect: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'): string {
  if (!query || !query.trim()) return '';

  try {
    return format(query, {
      language: dialect === 'mysql' ? 'mysql' : 'postgresql',
      tabWidth: 2,
      useTabs: false,
      keywordCase: 'upper',
      linesBetweenQueries: 2,
      logicalOperatorNewline: 'before',
    });
  } catch (err) {
    console.warn('SQL formatting warning:', err);
    return query; // fallback to raw string if parser encounters invalid syntax
  }
}
