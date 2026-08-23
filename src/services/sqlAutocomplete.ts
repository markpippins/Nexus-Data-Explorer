import { SchemaObject, TableObject, ColumnDefinition } from '../types/database';

export interface AutocompleteContext {
  triggerType: 'dot' | 'from_join' | 'select' | 'where' | 'order_group' | 'on_clause' | 'schema_dot' | 'general';
  prefix: string;
  dotTarget?: string; // The identifier before the dot, e.g. "customers." or "c." or "public."
  referencedTables: Map<string, string>; // Alias -> TableName, e.g. "c" -> "customers"
  activeSchemas: string[];
}

export interface SqlFunctionDoc {
  name: string;
  signature: string;
  snippet: string;
  category: 'Aggregate' | 'String' | 'Date/Time' | 'JSON' | 'Math' | 'Window' | 'Utility';
  returnType: string;
  description: string;
}

export const POSTGRES_FUNCTIONS: SqlFunctionDoc[] = [
  // Aggregate
  { name: 'COUNT', signature: 'COUNT(expression)', snippet: 'COUNT(${1:*})', category: 'Aggregate', returnType: 'BIGINT', description: 'Returns the number of rows or non-null values.' },
  { name: 'SUM', signature: 'SUM(expression)', snippet: 'SUM(${1:column})', category: 'Aggregate', returnType: 'NUMERIC', description: 'Returns the sum of all non-null input values.' },
  { name: 'AVG', signature: 'AVG(expression)', snippet: 'AVG(${1:column})', category: 'Aggregate', returnType: 'NUMERIC', description: 'Returns the average (arithmetic mean) of non-null values.' },
  { name: 'MIN', signature: 'MIN(expression)', snippet: 'MIN(${1:column})', category: 'Aggregate', returnType: 'SAME AS INPUT', description: 'Returns the minimum value across input rows.' },
  { name: 'MAX', signature: 'MAX(expression)', snippet: 'MAX(${1:column})', category: 'Aggregate', returnType: 'SAME AS INPUT', description: 'Returns the maximum value across input rows.' },
  { name: 'ARRAY_AGG', signature: 'ARRAY_AGG(expression [ORDER BY ...])', snippet: 'ARRAY_AGG(${1:column})', category: 'Aggregate', returnType: 'ARRAY', description: 'Aggregates values into a PostgreSQL array.' },
  { name: 'STRING_AGG', signature: 'STRING_AGG(expression, delimiter)', snippet: 'STRING_AGG(${1:column}, \'${2:, }\')', category: 'Aggregate', returnType: 'TEXT', description: 'Concatenates strings with a specified delimiter.' },
  { name: 'JSON_AGG', signature: 'JSON_AGG(expression)', snippet: 'JSON_AGG(${1:column})', category: 'Aggregate', returnType: 'JSON', description: 'Aggregates values as a JSON array.' },
  { name: 'JSONB_AGG', signature: 'JSONB_AGG(expression)', snippet: 'JSONB_AGG(${1:column})', category: 'Aggregate', returnType: 'JSONB', description: 'Aggregates values as a binary JSONB array.' },

  // Date & Time
  { name: 'NOW', signature: 'NOW()', snippet: 'NOW()', category: 'Date/Time', returnType: 'TIMESTAMPTZ', description: 'Current date and time (start of current transaction).' },
  { name: 'CURRENT_TIMESTAMP', signature: 'CURRENT_TIMESTAMP', snippet: 'CURRENT_TIMESTAMP', category: 'Date/Time', returnType: 'TIMESTAMPTZ', description: 'Standard SQL current date and timestamp.' },
  { name: 'CURRENT_DATE', signature: 'CURRENT_DATE', snippet: 'CURRENT_DATE', category: 'Date/Time', returnType: 'DATE', description: 'Current calendar date.' },
  { name: 'DATE_TRUNC', signature: 'DATE_TRUNC(unit, timestamp)', snippet: 'DATE_TRUNC(\'${1:day}\', ${2:timestamp_col})', category: 'Date/Time', returnType: 'TIMESTAMPTZ', description: 'Truncates timestamp to specified precision (\'year\', \'month\', \'day\', \'hour\', etc.).' },
  { name: 'DATE_PART', signature: 'DATE_PART(field, source)', snippet: 'DATE_PART(\'${1:year}\', ${2:timestamp_col})', category: 'Date/Time', returnType: 'DOUBLE PRECISION', description: 'Extracts subfield such as year, month, or day.' },
  { name: 'AGE', signature: 'AGE(timestamp, timestamp)', snippet: 'AGE(${1:end_date}, ${2:start_date})', category: 'Date/Time', returnType: 'INTERVAL', description: 'Computes interval difference between timestamps.' },
  { name: 'TO_CHAR', signature: 'TO_CHAR(expression, format)', snippet: 'TO_CHAR(${1:timestamp_col}, \'${2:YYYY-MM-DD}\')', category: 'Date/Time', returnType: 'TEXT', description: 'Formats date, time, or number as formatted text string.' },

  // String
  { name: 'COALESCE', signature: 'COALESCE(val1, val2, ...)', snippet: 'COALESCE(${1:column}, ${2:default_value})', category: 'Utility', returnType: 'SAME AS INPUT', description: 'Returns the first non-null argument.' },
  { name: 'NULLIF', signature: 'NULLIF(value1, value2)', snippet: 'NULLIF(${1:column}, ${2:0})', category: 'Utility', returnType: 'SAME AS INPUT', description: 'Returns NULL if value1 equals value2, otherwise returns value1.' },
  { name: 'CONCAT', signature: 'CONCAT(str1, str2, ...)', snippet: 'CONCAT(${1:str1}, ${2:str2})', category: 'String', returnType: 'TEXT', description: 'Concatenates multiple arguments into a single string.' },
  { name: 'CONCAT_WS', signature: 'CONCAT_WS(separator, str1, ...)', snippet: 'CONCAT_WS(\'${1: }\', ${2:first_name}, ${3:last_name})', category: 'String', returnType: 'TEXT', description: 'Concatenates strings with a custom separator.' },
  { name: 'LOWER', signature: 'LOWER(string)', snippet: 'LOWER(${1:string_col})', category: 'String', returnType: 'TEXT', description: 'Converts string to all lowercase.' },
  { name: 'UPPER', signature: 'UPPER(string)', snippet: 'UPPER(${1:string_col})', category: 'String', returnType: 'TEXT', description: 'Converts string to all uppercase.' },
  { name: 'SUBSTRING', signature: 'SUBSTRING(string FROM start FOR length)', snippet: 'SUBSTRING(${1:column} FROM ${2:1} FOR ${3:10})', category: 'String', returnType: 'TEXT', description: 'Extracts a substring from text.' },
  { name: 'TRIM', signature: 'TRIM([BOTH] [chars] FROM string)', snippet: 'TRIM(${1:column})', category: 'String', returnType: 'TEXT', description: 'Removes leading and trailing whitespace or characters.' },
  { name: 'LENGTH', signature: 'LENGTH(string)', snippet: 'LENGTH(${1:string_col})', category: 'String', returnType: 'INTEGER', description: 'Returns the character length of string.' },
  { name: 'REPLACE', signature: 'REPLACE(string, from, to)', snippet: 'REPLACE(${1:column}, \'${2:old}\', \'${3:new}\')', category: 'String', returnType: 'TEXT', description: 'Replaces all occurrences of substring with replacement.' },

  // JSON / JSONB
  { name: 'JSONB_BUILD_OBJECT', signature: 'JSONB_BUILD_OBJECT(key1, val1, ...)', snippet: 'JSONB_BUILD_OBJECT(\'${1:key}\', ${2:value})', category: 'JSON', returnType: 'JSONB', description: 'Builds a JSONB object from alternating keys and values.' },
  { name: 'JSONB_EXTRACT_PATH_TEXT', signature: 'JSONB_EXTRACT_PATH_TEXT(from_json, path...)', snippet: 'JSONB_EXTRACT_PATH_TEXT(${1:json_col}, \'${2:key}\')', category: 'JSON', returnType: 'TEXT', description: 'Extracts nested JSON sub-object as string.' },
  { name: 'JSONB_PRETTY', signature: 'JSONB_PRETTY(jsonb)', snippet: 'JSONB_PRETTY(${1:jsonb_col})', category: 'JSON', returnType: 'TEXT', description: 'Formats JSONB with indented whitespace for human readability.' },

  // Window Functions
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER (...)', snippet: 'ROW_NUMBER() OVER (PARTITION BY ${1:category_id} ORDER BY ${2:created_at} DESC)', category: 'Window', returnType: 'BIGINT', description: 'Assigns unique sequential integer to each row within partition.' },
  { name: 'RANK', signature: 'RANK() OVER (...)', snippet: 'RANK() OVER (ORDER BY ${1:score} DESC)', category: 'Window', returnType: 'BIGINT', description: 'Ranks rows with ties producing gaps.' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER (...)', snippet: 'DENSE_RANK() OVER (ORDER BY ${1:score} DESC)', category: 'Window', returnType: 'BIGINT', description: 'Ranks rows with ties without gaps.' },
  { name: 'LAG', signature: 'LAG(expression [, offset [, default]]) OVER (...)', snippet: 'LAG(${1:val}, 1) OVER (PARTITION BY ${2:user_id} ORDER BY ${3:created_at})', category: 'Window', returnType: 'SAME AS INPUT', description: 'Evaluates expression at previous row offset.' },
  { name: 'LEAD', signature: 'LEAD(expression [, offset [, default]]) OVER (...)', snippet: 'LEAD(${1:val}, 1) OVER (PARTITION BY ${2:user_id} ORDER BY ${3:created_at})', category: 'Window', returnType: 'SAME AS INPUT', description: 'Evaluates expression at subsequent row offset.' },

  // Math & UUID
  { name: 'ROUND', signature: 'ROUND(numeric [, decimal_places])', snippet: 'ROUND(${1:val}, ${2:2})', category: 'Math', returnType: 'NUMERIC', description: 'Rounds numeric value to specified decimal precision.' },
  { name: 'GEN_RANDOM_UUID', signature: 'GEN_RANDOM_UUID()', snippet: 'GEN_RANDOM_UUID()', category: 'Utility', returnType: 'UUID', description: 'Generates a secure random version 4 UUID.' },
  { name: 'CAST', signature: 'CAST(expression AS type)', snippet: 'CAST(${1:expr} AS ${2:INTEGER})', category: 'Utility', returnType: 'TARGET TYPE', description: 'Converts expression data type to target type.' }
];

export const SQL_SNIPPETS = [
  {
    label: 'SELECT ... FROM ... WHERE',
    detail: 'Standard SELECT Query Template',
    insertText: 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition}\nORDER BY ${4:id} ASC\nLIMIT ${5:50};',
    documentation: 'Complete boilerplate for querying and filtering records.'
  },
  {
    label: 'INSERT INTO ... VALUES',
    detail: 'Insert Single / Multi-Row Template',
    insertText: 'INSERT INTO ${1:table_name} (${2:col1, col2})\nVALUES (${3:val1, val2})\nRETURNING *;',
    documentation: 'Insert records into table with RETURNING clause.'
  },
  {
    label: 'UPDATE ... SET ... WHERE',
    detail: 'Safe Update Statement',
    insertText: 'UPDATE ${1:table_name}\nSET ${2:col1} = ${3:value1}\nWHERE ${4:id = 1}\nRETURNING *;',
    documentation: 'Updates existing rows matching the WHERE condition.'
  },
  {
    label: 'DELETE FROM ... WHERE',
    detail: 'Safe Delete Statement',
    insertText: 'DELETE FROM ${1:table_name}\nWHERE ${2:id = 1}\nRETURNING *;',
    documentation: 'Deletes rows matching condition with RETURNING confirmation.'
  },
  {
    label: 'CREATE TABLE ...',
    detail: 'PostgreSQL DDL Table Definition',
    insertText: 'CREATE TABLE ${1:table_name} (\n  id SERIAL PRIMARY KEY,\n  ${2:name} VARCHAR(255) NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);',
    documentation: 'Creates a new relational table with primary key and timestamp.'
  },
  {
    label: 'WITH CTE AS (...) SELECT',
    detail: 'Common Table Expression (CTE)',
    insertText: 'WITH ${1:cte_summary} AS (\n  SELECT ${2:col1}, COUNT(*) AS total_count\n  FROM ${3:source_table}\n  GROUP BY ${2:col1}\n)\nSELECT * FROM ${1:cte_summary};',
    documentation: 'Modular and readable multi-step subquery CTE.'
  },
  {
    label: 'CASE WHEN ... THEN ... END',
    detail: 'Conditional Expression',
    insertText: 'CASE\n  WHEN ${1:condition_1} THEN ${2:result_1}\n  WHEN ${3:condition_2} THEN ${4:result_2}\n  ELSE ${5:default_result}\nEND',
    documentation: 'SQL conditional branching expression.'
  },
  {
    label: 'CREATE INDEX ...',
    detail: 'B-Tree / GIN Performance Index',
    insertText: 'CREATE INDEX idx_${1:table}_${2:column}\nON ${1:table} (${2:column});',
    documentation: 'Accelerates query filtering and join lookups.'
  }
];

export const SQL_KEYWORDS_LIST = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
  'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'ADD COLUMN',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT', 'DISTINCT', 'RETURNING',
  'EXISTS', 'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW', 'UNION', 'UNION ALL',
  'EXCEPT', 'INTERSECT', 'WITH', 'RECURSIVE', 'BETWEEN', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL',
  'AND', 'OR', 'NOT', 'IN', 'AS', 'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST', 'USING',
  'CASCADE', 'RESTRICT', 'TRUNCATE', 'TRANSACTION', 'COMMIT', 'ROLLBACK', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
];

/**
 * Extracts referenced tables and their aliases from the active SQL text.
 * E.g., "SELECT * FROM public.customers c JOIN orders o ON ..." -> { c: "customers", o: "orders", customers: "customers", orders: "orders" }
 */
export function extractReferencedTables(sql: string): Map<string, string> {
  const tableAliasMap = new Map<string, string>();
  if (!sql) return tableAliasMap;

  // Regex to match "FROM [schema.]table [AS] alias" or "JOIN [schema.]table [AS] alias"
  const tableRefRegex = /\b(FROM|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|INTO|UPDATE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi;

  let match;
  while ((match = tableRefRegex.exec(sql)) !== null) {
    const rawTable = match[2];
    const alias = match[3];
    const cleanTableName = rawTable.includes('.') ? rawTable.split('.')[1] : rawTable;

    // Register table name directly
    tableAliasMap.set(cleanTableName.toLowerCase(), cleanTableName);
    tableAliasMap.set(rawTable.toLowerCase(), cleanTableName);

    // Register alias if it exists and is not a keyword
    if (alias && !SQL_KEYWORDS_LIST.includes(alias.toUpperCase())) {
      tableAliasMap.set(alias.toLowerCase(), cleanTableName);
    }
  }

  return tableAliasMap;
}

/**
 * Analyzes the text prior to cursor position to determine the context.
 */
export function analyzeAutocompleteContext(
  textBeforeCursor: string,
  fullSql: string,
  schemas: SchemaObject[]
): AutocompleteContext {
  const referencedTables = extractReferencedTables(fullSql);
  const activeSchemas = schemas.map((s) => s.name);

  // Check if ending with a dot: e.g. "customers." or "c." or "public."
  const dotMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)\.\s*([a-zA-Z0-9_]*)$/);
  if (dotMatch) {
    const dotTarget = dotMatch[1];
    const prefix = dotMatch[2] || '';

    // Check if dotTarget is a known schema name
    if (activeSchemas.some((s) => s.toLowerCase() === dotTarget.toLowerCase())) {
      return {
        triggerType: 'schema_dot',
        prefix,
        dotTarget,
        referencedTables,
        activeSchemas,
      };
    }

    return {
      triggerType: 'dot',
      prefix,
      dotTarget,
      referencedTables,
      activeSchemas,
    };
  }

  // Extract last word prefix
  const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
  const prefix = wordMatch ? wordMatch[1] : '';

  // Look at the segment of text before the cursor (last 100 chars) to detect SQL clause context
  const recentText = textBeforeCursor.slice(-150);

  // Check for ON clause in JOIN
  if (/\b(ON|USING)\s+[^\n;]*$/i.test(recentText)) {
    return {
      triggerType: 'on_clause',
      prefix,
      referencedTables,
      activeSchemas,
    };
  }

  // Check for FROM or JOIN context (Table suggestion target)
  if (/\b(FROM|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|INTO|UPDATE|TABLE|REFERENCES|TRUNCATE)\s+[^\n,;()]*$/i.test(recentText)) {
    return {
      triggerType: 'from_join',
      prefix,
      referencedTables,
      activeSchemas,
    };
  }

  // Check for SELECT / WHERE / GROUP BY / ORDER BY / HAVING / SET
  if (/\b(SELECT|DISTINCT|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|SET|RETURNING)\s+[^\n;]*$/i.test(recentText)) {
    return {
      triggerType: 'select',
      prefix,
      referencedTables,
      activeSchemas,
    };
  }

  return {
    triggerType: 'general',
    prefix,
    referencedTables,
    activeSchemas,
  };
}

/**
 * Finds potential Foreign Key join conditions between known tables.
 */
export function findForeignKeyJoinSuggestions(
  table1Name: string,
  table2Name: string,
  schemas: SchemaObject[]
): { condition: string; detail: string }[] {
  const suggestions: { condition: string; detail: string }[] = [];
  const t1 = table1Name.toLowerCase();
  const t2 = table2Name.toLowerCase();

  for (const schema of schemas) {
    for (const table of schema.tables) {
      if (table.name.toLowerCase() === t2) {
        // Check if t2 has FK pointing to t1
        table.columns.forEach((col) => {
          if (col.referencesTable?.toLowerCase() === t1 && col.referencesColumn) {
            suggestions.push({
              condition: `${table2Name}.${col.name} = ${table1Name}.${col.referencesColumn}`,
              detail: `FK: ${table2Name}.${col.name} ➔ ${table1Name}.${col.referencesColumn}`,
            });
          }
        });
      }

      if (table.name.toLowerCase() === t1) {
        // Check if t1 has FK pointing to t2
        table.columns.forEach((col) => {
          if (col.referencesTable?.toLowerCase() === t2 && col.referencesColumn) {
            suggestions.push({
              condition: `${table1Name}.${col.name} = ${table2Name}.${col.referencesColumn}`,
              detail: `FK: ${table1Name}.${col.name} ➔ ${table2Name}.${col.referencesColumn}`,
            });
          }
        });
      }
    }
  }

  // Fallback: heuristic match by naming convention (e.g. user_id = id or customer_id = id)
  if (suggestions.length === 0) {
    suggestions.push({
      condition: `${table2Name}.${table1Name}_id = ${table1Name}.id`,
      detail: `Convention match: ${table2Name}.${table1Name}_id = ${table1Name}.id`,
    });
  }

  return suggestions;
}
