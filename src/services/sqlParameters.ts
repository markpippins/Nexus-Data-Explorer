import { SqlParamType, QueryParameter } from '../types/database';

export interface ParameterPreset {
  id: string;
  title: string;
  description: string;
  category: 'E-Commerce' | 'Analytics' | 'PostgreSQL' | 'Templates' | 'Custom';
  query: string;
  parameters: Partial<QueryParameter>[];
}

export const PARAMETER_PRESETS: ParameterPreset[] = [
  {
    id: 'orders-status-amount',
    title: 'Order Status & Amount Filter',
    description: 'Filter orders by status and minimum threshold with limit',
    category: 'E-Commerce',
    query: `SELECT 
  id, 
  customer_id, 
  order_date, 
  status, 
  total_amount 
FROM public.orders 
WHERE status = :order_status 
  AND total_amount >= :min_amount 
ORDER BY order_date DESC 
LIMIT :limit_count;`,
    parameters: [
      { name: 'order_status', rawPlaceholder: ':order_status', type: 'string', value: 'COMPLETED', description: 'Target order status (e.g. COMPLETED, PENDING, CANCELLED)' },
      { name: 'min_amount', rawPlaceholder: ':min_amount', type: 'decimal', value: 150.00, description: 'Minimum total order value in USD' },
      { name: 'limit_count', rawPlaceholder: ':limit_count', type: 'integer', value: 10, description: 'Maximum rows to fetch' },
    ],
  },
  {
    id: 'customer-city-tier',
    title: 'Customer Search by City & Tier',
    description: 'Find customers matching loyalty tier and geographic location',
    category: 'Analytics',
    query: `SELECT 
  id, 
  name, 
  email, 
  city, 
  loyalty_tier, 
  created_at 
FROM public.customers 
WHERE city = :target_city 
  AND loyalty_tier = :loyalty_tier 
ORDER BY name ASC;`,
    parameters: [
      { name: 'target_city', rawPlaceholder: ':target_city', type: 'string', value: 'New York', description: 'City name' },
      { name: 'loyalty_tier', rawPlaceholder: ':loyalty_tier', type: 'string', value: 'Gold', description: 'Loyalty level: Bronze, Silver, Gold, Platinum' },
    ],
  },
  {
    id: 'date-range-transactions',
    title: 'Date Range Financial Activity',
    description: 'Query records created between a start and end date interval',
    category: 'Analytics',
    query: `SELECT 
  id, 
  order_date, 
  total_amount, 
  status 
FROM public.orders 
WHERE order_date BETWEEN :start_date AND :end_date 
ORDER BY order_date ASC;`,
    parameters: [
      { name: 'start_date', rawPlaceholder: ':start_date', type: 'date', value: '2024-01-01', description: 'Start date (inclusive)' },
      { name: 'end_date', rawPlaceholder: ':end_date', type: 'date', value: '2024-12-31', description: 'End date (inclusive)' },
    ],
  },
  {
    id: 'postgres-positional-dollars',
    title: 'PostgreSQL Positional Parameters ($1, $2, $3)',
    description: 'Standard PostgreSQL backend parameter placeholder syntax',
    category: 'PostgreSQL',
    query: `SELECT 
  id, 
  name, 
  category, 
  price, 
  stock_quantity 
FROM public.products 
WHERE price <= $1 
  AND category = $2 
ORDER BY price ASC 
LIMIT $3;`,
    parameters: [
      { name: '1', rawPlaceholder: '$1', type: 'decimal', value: 75.00, description: 'Maximum product price' },
      { name: '2', rawPlaceholder: '$2', type: 'string', value: 'Electronics', description: 'Product category' },
      { name: '3', rawPlaceholder: '$3', type: 'integer', value: 15, description: 'Row fetch limit' },
    ],
  },
  {
    id: 'template-mustache-syntax',
    title: 'Double-Brace Mustache Variables ({{var}})',
    description: 'Template syntax widely used in Retool, Metabase, and API workflows',
    category: 'Templates',
    query: `SELECT 
  id, 
  name, 
  email, 
  city 
FROM public.customers 
WHERE is_active = {{is_active}} 
  AND total_spend >= {{min_spend}} 
LIMIT {{row_limit}};`,
    parameters: [
      { name: 'is_active', rawPlaceholder: '{{is_active}}', type: 'boolean', value: true, description: 'Active customer flag' },
      { name: 'min_spend', rawPlaceholder: '{{min_spend}}', type: 'decimal', value: 200.00, description: 'Minimum lifetime spend' },
      { name: 'row_limit', rawPlaceholder: '{{row_limit}}', type: 'integer', value: 20, description: 'Row limit' },
    ],
  },
  {
    id: 'dynamic-sorting-raw-sql',
    title: 'Dynamic Identifier & Raw SQL Variable',
    description: 'Inject raw SQL keywords or column names safely into queries',
    category: 'Custom',
    query: `SELECT 
  id, 
  name, 
  email, 
  city, 
  created_at 
FROM public.customers 
ORDER BY :sort_column :sort_direction 
LIMIT :limit;`,
    parameters: [
      { name: 'sort_column', rawPlaceholder: ':sort_column', type: 'raw_sql', value: 'created_at', description: 'Column to sort by' },
      { name: 'sort_direction', rawPlaceholder: ':sort_direction', type: 'raw_sql', value: 'DESC', description: 'ASC or DESC' },
      { name: 'limit', rawPlaceholder: ':limit', type: 'integer', value: 25, description: 'Limit' },
    ],
  },
];

/**
 * Infer data type from parameter name
 */
export function inferParamType(name: string): SqlParamType {
  const lower = name.toLowerCase().replace(/^[:$]|[{}]/g, '');

  if (/^(is_|has_|should_|flag_|active|enabled|valid|archived)/.test(lower)) {
    return 'boolean';
  }
  if (/(date|time|since|until|created|updated|period|start|end|timestamp|from|to)/.test(lower)) {
    if (/(time|timestamp|created_at|updated_at)/.test(lower)) {
      return 'timestamp';
    }
    return 'date';
  }
  if (/(price|amount|total|sum|cost|salary|rate|balance|subtotal|discount|fee|revenue)/.test(lower)) {
    return 'decimal';
  }
  if (/(id|count|limit|offset|num|qty|quantity|age|rank|page|size|index|step|year|month|day|cents|code)/.test(lower) || /^\d+$/.test(lower)) {
    return 'integer';
  }
  if (/(json|meta|data|payload|config|attributes|settings|params|props)/.test(lower)) {
    return 'json';
  }
  if (/(col|column|order|dir|direction|table|clause|sort|sort_by)/.test(lower)) {
    return 'raw_sql';
  }
  return 'string';
}

/**
 * Infer sensible default test value based on parameter name and inferred type
 */
export function inferDefaultValue(name: string, type: SqlParamType): any {
  const lower = name.toLowerCase().replace(/^[:$]|[{}]/g, '');

  switch (type) {
    case 'boolean':
      return true;
    case 'integer':
      if (lower.includes('limit')) return 25;
      if (lower.includes('offset')) return 0;
      if (lower.includes('id') || lower === '1') return 1;
      if (lower.includes('qty') || lower.includes('quantity')) return 5;
      if (lower.includes('age')) return 30;
      if (lower.includes('year')) return 2024;
      return 1;
    case 'decimal':
      if (lower.includes('price')) return 49.99;
      if (lower.includes('amount') || lower.includes('total')) return 100.00;
      if (lower.includes('rate')) return 0.05;
      if (lower.includes('discount')) return 10.00;
      return 50.00;
    case 'date':
      return '2024-01-01';
    case 'timestamp':
      return '2024-01-01 00:00:00';
    case 'null':
      return null;
    case 'json':
      return '{"active": true}';
    case 'raw_sql':
      if (lower.includes('direction') || lower.includes('dir')) return 'DESC';
      if (lower.includes('sort') || lower.includes('col')) return 'id';
      return 'id ASC';
    case 'string':
    default:
      if (lower.includes('status')) return 'COMPLETED';
      if (lower.includes('city')) return 'New York';
      if (lower.includes('tier') || lower.includes('level')) return 'Gold';
      if (lower.includes('category')) return 'Electronics';
      if (lower.includes('role')) return 'admin';
      if (lower.includes('country')) return 'USA';
      if (lower.includes('name')) return 'Alex';
      if (lower.includes('email')) return 'user@example.com';
      if (lower.includes('type')) return 'standard';
      return 'test_value';
  }
}

/**
 * Format a raw value into valid SQL literal based on its type
 */
export function formatParamValue(val: any, type: SqlParamType): string {
  if (val === null || val === undefined || type === 'null') {
    return 'NULL';
  }

  switch (type) {
    case 'boolean': {
      if (typeof val === 'boolean') {
        return val ? 'TRUE' : 'FALSE';
      }
      const strVal = String(val).toLowerCase().trim();
      return strVal === 'true' || strVal === '1' || strVal === 'yes' || strVal === 't' ? 'TRUE' : 'FALSE';
    }

    case 'integer': {
      const num = parseInt(String(val), 10);
      return isNaN(num) ? '0' : String(num);
    }

    case 'decimal': {
      const num = parseFloat(String(val));
      return isNaN(num) ? '0' : String(num);
    }

    case 'raw_sql': {
      return String(val);
    }

    case 'json': {
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const escaped = str.replace(/'/g, "''");
      return `'${escaped}'`;
    }

    case 'date':
    case 'timestamp':
    case 'string':
    default: {
      const str = String(val);
      const escaped = str.replace(/'/g, "''");
      return `'${escaped}'`;
    }
  }
}

/**
 * Extract all parameters from SQL query
 */
export function extractParametersFromSql(
  sql: string,
  existingParams: QueryParameter[] = []
): QueryParameter[] {
  if (!sql) return [];

  const existingMap = new Map<string, QueryParameter>();
  existingParams.forEach((p) => {
    existingMap.set(p.name, p);
    existingMap.set(p.rawPlaceholder, p);
  });

  const detectedMap = new Map<string, { rawPlaceholder: string; name: string; occurrences: number }>();

  // Tokenize ignoring comments and string literals
  const len = sql.length;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  let i = 0;
  while (i < len) {
    const char = sql[i];
    const nextChar = i + 1 < len ? sql[i + 1] : '';

    // Comment handlers
    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        i += 2;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
    }

    // String / Quote literal handlers
    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && nextChar === "'") {
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      if (inDoubleQuote && nextChar === '"') {
        i += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      i++;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      i++;
      continue;
    }

    // 1. Double Braces {{variable}}
    if (char === '{' && nextChar === '{') {
      const closeIdx = sql.indexOf('}}', i + 2);
      if (closeIdx !== -1) {
        const rawContent = sql.substring(i + 2, closeIdx).trim();
        if (rawContent && /^[a-zA-Z0-9_]+$/.test(rawContent)) {
          const rawPlaceholder = sql.substring(i, closeIdx + 2);
          const name = rawContent;
          const current = detectedMap.get(name) || { rawPlaceholder, name, occurrences: 0 };
          current.occurrences++;
          detectedMap.set(name, current);
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // 2. Colon Named Parameters :variable (excluding :: type casts and := operators)
    if (char === ':') {
      const prevChar = i > 0 ? sql[i - 1] : ' ';
      if (prevChar !== ':' && nextChar !== ':' && nextChar !== '=') {
        const match = sql.substring(i).match(/^:([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (match) {
          const rawPlaceholder = match[0];
          const name = match[1];
          const current = detectedMap.get(name) || { rawPlaceholder, name, occurrences: 0 };
          current.occurrences++;
          detectedMap.set(name, current);
          i += rawPlaceholder.length;
          continue;
        }
      }
    }

    // 3. Dollar Parameters $1, $2, $variable (excluding $$ tags)
    if (char === '$') {
      const prevChar = i > 0 ? sql[i - 1] : ' ';
      if (prevChar !== '$' && nextChar !== '$') {
        const match = sql.substring(i).match(/^\$([a-zA-Z0-9_]+)/);
        if (match) {
          const rawPlaceholder = match[0];
          const name = match[1];
          const current = detectedMap.get(name) || { rawPlaceholder, name, occurrences: 0 };
          current.occurrences++;
          detectedMap.set(name, current);
          i += rawPlaceholder.length;
          continue;
        }
      }
    }

    i++;
  }

  // Combine detected with existing params and maintain custom ones
  const result: QueryParameter[] = [];
  const processedNames = new Set<string>();

  detectedMap.forEach(({ rawPlaceholder, name, occurrences }) => {
    processedNames.add(name);
    const existing = existingMap.get(name) || existingMap.get(rawPlaceholder);

    if (existing) {
      result.push({
        ...existing,
        rawPlaceholder,
        occurrences,
        isCustom: false,
      });
    } else {
      const inferredType = inferParamType(name);
      const inferredVal = inferDefaultValue(name, inferredType);
      result.push({
        id: `param-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        rawPlaceholder,
        type: inferredType,
        value: inferredVal,
        defaultValue: inferredVal,
        occurrences,
        isCustom: false,
        isValid: true,
      });
    }
  });

  // Preserve user custom parameters that might not be in the SQL yet
  existingParams.forEach((param) => {
    if (param.isCustom && !processedNames.has(param.name)) {
      result.push({
        ...param,
        occurrences: 0,
      });
    }
  });

  return result;
}

/**
 * Compile/substitute SQL query parameters with formatted literal values
 */
export function substituteParameters(
  sql: string,
  params: QueryParameter[]
): {
  compiledSql: string;
  missingParams: string[];
  substitutedCount: number;
  paramMap: Record<string, any>;
} {
  if (!sql) {
    return { compiledSql: '', missingParams: [], substitutedCount: 0, paramMap: {} };
  }

  const paramMap: Record<string, QueryParameter> = {};
  params.forEach((p) => {
    paramMap[p.name] = p;
    paramMap[p.rawPlaceholder] = p;
    if (p.name.startsWith(':') || p.name.startsWith('$')) {
      paramMap[p.name.substring(1)] = p;
    }
  });

  const missingParams: string[] = [];
  let substitutedCount = 0;

  // Tokenize safely to replace placeholders only outside string literals and comments
  const len = sql.length;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  let output = '';
  let i = 0;

  while (i < len) {
    const char = sql[i];
    const nextChar = i + 1 < len ? sql[i + 1] : '';

    // Line comment
    if (inLineComment) {
      output += char;
      if (char === '\n') inLineComment = false;
      i++;
      continue;
    }

    // Block comment
    if (inBlockComment) {
      output += char;
      if (char === '*' && nextChar === '/') {
        output += nextChar;
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        output += char + nextChar;
        inLineComment = true;
        i += 2;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        output += char + nextChar;
        inBlockComment = true;
        i += 2;
        continue;
      }
    }

    // Single quotes
    if (char === "'" && !inDoubleQuote) {
      output += char;
      if (inSingleQuote && nextChar === "'") {
        output += nextChar;
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }

    // Double quotes
    if (char === '"' && !inSingleQuote) {
      output += char;
      if (inDoubleQuote && nextChar === '"') {
        output += nextChar;
        i += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      i++;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      output += char;
      i++;
      continue;
    }

    // 1. Double Braces {{name}}
    if (char === '{' && nextChar === '{') {
      const closeIdx = sql.indexOf('}}', i + 2);
      if (closeIdx !== -1) {
        const rawContent = sql.substring(i + 2, closeIdx).trim();
        const param = paramMap[rawContent] || paramMap[`{{${rawContent}}}`];
        if (param) {
          const formatted = formatParamValue(param.value, param.type);
          output += formatted;
          substitutedCount++;
          i = closeIdx + 2;
          continue;
        } else if (/^[a-zA-Z0-9_]+$/.test(rawContent)) {
          if (!missingParams.includes(rawContent)) missingParams.push(rawContent);
        }
      }
    }

    // 2. Colon Named Parameter :name (avoid :: cast)
    if (char === ':') {
      const prevChar = i > 0 ? sql[i - 1] : ' ';
      if (prevChar !== ':' && nextChar !== ':' && nextChar !== '=') {
        const match = sql.substring(i).match(/^:([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (match) {
          const rawPlaceholder = match[0];
          const name = match[1];
          const param = paramMap[name] || paramMap[rawPlaceholder];

          if (param) {
            const formatted = formatParamValue(param.value, param.type);
            output += formatted;
            substitutedCount++;
            i += rawPlaceholder.length;
            continue;
          } else {
            if (!missingParams.includes(name)) missingParams.push(name);
          }
        }
      }
    }

    // 3. Dollar Parameter $1, $name
    if (char === '$') {
      const prevChar = i > 0 ? sql[i - 1] : ' ';
      if (prevChar !== '$' && nextChar !== '$') {
        const match = sql.substring(i).match(/^\$([a-zA-Z0-9_]+)/);
        if (match) {
          const rawPlaceholder = match[0];
          const name = match[1];
          const param = paramMap[name] || paramMap[rawPlaceholder];

          if (param) {
            const formatted = formatParamValue(param.value, param.type);
            output += formatted;
            substitutedCount++;
            i += rawPlaceholder.length;
            continue;
          } else {
            if (!missingParams.includes(name)) missingParams.push(name);
          }
        }
      }
    }

    output += char;
    i++;
  }

  const exportMap: Record<string, any> = {};
  params.forEach((p) => {
    exportMap[p.name] = p.value;
  });

  return {
    compiledSql: output,
    missingParams,
    substitutedCount,
    paramMap: exportMap,
  };
}

/**
 * Factory helper to create a new manual parameter
 */
export function createCustomParameter(name = 'custom_param', type: SqlParamType = 'string'): QueryParameter {
  const cleanName = name.replace(/^[:$]|[{}]/g, '').trim() || 'param';
  const val = inferDefaultValue(cleanName, type);
  return {
    id: `param-custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: cleanName,
    rawPlaceholder: `:${cleanName}`,
    type,
    value: val,
    defaultValue: val,
    isCustom: true,
    occurrences: 0,
    isValid: true,
  };
}
