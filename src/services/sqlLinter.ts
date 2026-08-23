import { SchemaObject } from '../types/database';

export interface SqlDiagnostic {
  line: number;
  startCol: number;
  endCol: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: 'syntax' | 'schema' | 'performance' | 'safety' | 'style';
  code?: string;
  suggestion?: string;
  replacementText?: string;
  ruleExplanation?: string;
}

export interface LinterOptions {
  checkSyntax?: boolean;
  checkSchema?: boolean;
  checkSelectStar?: boolean;
  checkMissingWhere?: boolean;
  checkLeadingWildcard?: boolean;
  checkNullComparison?: boolean;
  checkKeywordTypos?: boolean;
  checkCartesianProduct?: boolean;
  checkHavingWithoutAggregate?: boolean;
}

export const DEFAULT_LINTER_OPTIONS: LinterOptions = {
  checkSyntax: true,
  checkSchema: true,
  checkSelectStar: true,
  checkMissingWhere: true,
  checkLeadingWildcard: true,
  checkNullComparison: true,
  checkKeywordTypos: true,
  checkCartesianProduct: true,
  checkHavingWithoutAggregate: true,
};

const COMMON_SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'OUTER', 'CROSS',
  'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO',
  'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE',
  'ADD', 'COLUMN', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL',
  'DEFAULT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'AS', 'AND', 'OR', 'IN', 'LIKE', 'ILIKE', 'IS',
  'DISTINCT', 'RETURNING', 'EXISTS', 'INDEX', 'VIEW', 'UNION', 'ALL', 'EXCEPT',
  'INTERSECT', 'WITH', 'RECURSIVE', 'CAST', 'NULLIF', 'BETWEEN', 'ASC', 'DESC',
  'USING', 'CASCADE', 'RESTRICT', 'TRUNCATE'
];

const SQL_KEYWORDS_UPPER = new Set(COMMON_SQL_KEYWORDS);

// Common keyword typos map
const KEYWORD_TYPOS: Record<string, string> = {
  'SELCT': 'SELECT',
  'SELEC': 'SELECT',
  'SELETC': 'SELECT',
  'SLECT': 'SELECT',
  'FRM': 'FROM',
  'FROMM': 'FROM',
  'FORM': 'FROM',
  'WHER': 'WHERE',
  'WHEREF': 'WHERE',
  'WHR': 'WHERE',
  'WHEREE': 'WHERE',
  'JION': 'JOIN',
  'JON': 'JOIN',
  'GROP': 'GROUP',
  'GRUP': 'GROUP',
  'ORDRE': 'ORDER',
  'ORDR': 'ORDER',
  'HAVNG': 'HAVING',
  'HAVIN': 'HAVING',
  'INSRT': 'INSERT',
  'INSTERT': 'INSERT',
  'UPDAT': 'UPDATE',
  'UPDATA': 'UPDATE',
  'DELTE': 'DELETE',
  'DELEET': 'DELETE',
  'LIMITT': 'LIMIT',
  'LIMT': 'LIMIT',
  'OFFST': 'OFFSET',
  'COALESE': 'COALESCE',
  'COALES': 'COALESCE',
  'DISTINT': 'DISTINCT',
  'DISTNCT': 'DISTINCT',
  'VALUS': 'VALUES',
  'VALEUS': 'VALUES',
  'RETURNNG': 'RETURNING',
  'RETUNING': 'RETURNING'
};

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findClosestMatch(target: string, candidates: string[], maxDist = 3): string | null {
  let minDistance = Infinity;
  let bestMatch: string | null = null;
  const lowerTarget = target.toLowerCase();

  for (const cand of candidates) {
    const dist = levenshtein(lowerTarget, cand.toLowerCase());
    if (dist < minDistance && dist <= maxDist) {
      minDistance = dist;
      bestMatch = cand;
    }
  }
  return bestMatch;
}

// Convert character offset into 1-based Line & Column
function offsetToLineCol(lines: string[], offset: number): { line: number; col: number } {
  let currentOffset = 0;
  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const lineLenWithNewline = lines[lIdx].length + 1; // + 1 for \n
    if (currentOffset + lineLenWithNewline > offset) {
      return {
        line: lIdx + 1,
        col: Math.max(1, offset - currentOffset + 1),
      };
    }
    currentOffset += lineLenWithNewline;
  }
  return { line: lines.length, col: Math.max(1, lines[lines.length - 1]?.length || 1) };
}

export function lintSqlQuery(
  sql: string,
  schemas: SchemaObject[] = [],
  options: LinterOptions = DEFAULT_LINTER_OPTIONS
): SqlDiagnostic[] {
  const diagnostics: SqlDiagnostic[] = [];
  if (!sql || !sql.trim()) return diagnostics;

  const lines = sql.split('\n');

  // Collect all existing tables and columns for schema validation
  const allTablesMap = new Map<string, { schemaName: string; columns: string[] }>();
  const allTableNames: string[] = [];
  const allColumnNames = new Set<string>();

  schemas.forEach((schema) => {
    schema.tables.forEach((table) => {
      const fullKey = table.name.toLowerCase();
      const colList = table.columns.map((c) => c.name);
      allTablesMap.set(fullKey, { schemaName: schema.name, columns: colList });
      allTableNames.push(table.name);
      colList.forEach((c) => allColumnNames.add(c));
    });
  });

  // ==========================================
  // 1. Structural Lexical & Syntax Validation
  // ==========================================
  if (options.checkSyntax) {
    let openParenCount = 0;
    const openParenStack: { line: number; col: number }[] = [];

    let inSingleQuote = false;
    let quoteStartLine = 0;
    let quoteStartCol = 0;

    let inDoubleQuote = false;
    let dQuoteStartLine = 0;
    let dQuoteStartCol = 0;

    let inBlockComment = false;
    let blockCommentStartLine = 0;
    let blockCommentStartCol = 0;

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      const lineNum = lIdx + 1;

      for (let cIdx = 0; cIdx < line.length; cIdx++) {
        const char = line[cIdx];
        const nextChar = line[cIdx + 1];

        // Block comment end check
        if (inBlockComment) {
          if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            cIdx++;
          }
          continue;
        }

        // Single line comment
        if (!inSingleQuote && !inDoubleQuote && char === '-' && nextChar === '-') {
          break; // ignore rest of line
        }

        // Block comment start check
        if (!inSingleQuote && !inDoubleQuote && char === '/' && nextChar === '*') {
          inBlockComment = true;
          blockCommentStartLine = lineNum;
          blockCommentStartCol = cIdx + 1;
          cIdx++;
          continue;
        }

        // Single quote literal
        if (char === "'" && !inDoubleQuote) {
          if (inSingleQuote && nextChar === "'") {
            cIdx++; // escaped quote ''
          } else {
            inSingleQuote = !inSingleQuote;
            if (inSingleQuote) {
              quoteStartLine = lineNum;
              quoteStartCol = cIdx + 1;
            }
          }
        }
        // Double quote identifier
        else if (char === '"' && !inSingleQuote) {
          if (inDoubleQuote && nextChar === '"') {
            cIdx++;
          } else {
            inDoubleQuote = !inDoubleQuote;
            if (inDoubleQuote) {
              dQuoteStartLine = lineNum;
              dQuoteStartCol = cIdx + 1;
            }
          }
        }
        // Parentheses
        else if (!inSingleQuote && !inDoubleQuote) {
          if (char === '(') {
            openParenCount++;
            openParenStack.push({ line: lineNum, col: cIdx + 1 });
          } else if (char === ')') {
            openParenCount--;
            if (openParenCount < 0) {
              diagnostics.push({
                line: lineNum,
                startCol: cIdx + 1,
                endCol: cIdx + 2,
                message: 'Syntax Error: Unmatched closing parenthesis ")"',
                severity: 'error',
                category: 'syntax',
                code: 'UNMATCHED_PAREN',
                ruleExplanation: 'Closing parentheses must match an opened "(" block.',
              });
              openParenCount = 0;
            } else {
              openParenStack.pop();
            }
          }
        }
      }
    }

    if (inSingleQuote) {
      diagnostics.push({
        line: quoteStartLine,
        startCol: quoteStartCol,
        endCol: quoteStartCol + 1,
        message: 'Syntax Error: Unclosed single-quote string literal',
        severity: 'error',
        category: 'syntax',
        code: 'UNCLOSED_STRING',
        ruleExplanation: 'String literals in SQL must be enclosed with matching single quotes (\').',
      });
    }

    if (inDoubleQuote) {
      diagnostics.push({
        line: dQuoteStartLine,
        startCol: dQuoteStartCol,
        endCol: dQuoteStartCol + 1,
        message: 'Syntax Error: Unclosed double-quoted identifier',
        severity: 'error',
        category: 'syntax',
        code: 'UNCLOSED_IDENTIFIER',
        ruleExplanation: 'Quoted database identifiers in PostgreSQL must be closed with matching double quotes (").',
      });
    }

    if (inBlockComment) {
      diagnostics.push({
        line: blockCommentStartLine,
        startCol: blockCommentStartCol,
        endCol: blockCommentStartCol + 2,
        message: 'Syntax Error: Unclosed block comment (/* ... */)',
        severity: 'error',
        category: 'syntax',
        code: 'UNCLOSED_COMMENT',
        ruleExplanation: 'Multi-line block comments must end with "*/".',
      });
    }

    if (openParenStack.length > 0) {
      const first = openParenStack[0];
      diagnostics.push({
        line: first.line,
        startCol: first.col,
        endCol: first.col + 1,
        message: `Syntax Error: Unclosed parenthesis "(" (${openParenStack.length} open bracket${openParenStack.length > 1 ? 's' : ''})`,
        severity: 'error',
        category: 'syntax',
        code: 'UNCLOSED_PAREN',
        ruleExplanation: 'Every opened "(" must have a corresponding closing ")".',
      });
    }
  }

  // ==========================================
  // 2. Keyword Typos & Common Misspellings
  // ==========================================
  if (options.checkKeywordTypos) {
    const wordRegex = /\b([a-zA-Z_]+)\b/g;
    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      const trimmed = line.trim();
      if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;

      let wMatch;
      while ((wMatch = wordRegex.exec(line)) !== null) {
        const rawWord = wMatch[1];
        const upperWord = rawWord.toUpperCase();
        const startCol = wMatch.index + 1;
        const endCol = startCol + rawWord.length;

        // Direct known typo map check
        if (KEYWORD_TYPOS[upperWord]) {
          const correctKw = KEYWORD_TYPOS[upperWord];
          diagnostics.push({
            line: lIdx + 1,
            startCol,
            endCol,
            message: `Possible keyword typo: "${rawWord}". Did you mean "${correctKw}"?`,
            severity: 'error',
            category: 'syntax',
            code: 'KEYWORD_TYPO',
            suggestion: correctKw,
            replacementText: correctKw,
            ruleExplanation: `"${rawWord}" is not a recognized SQL keyword. Correct spelling is "${correctKw}".`,
          });
        }
      }
    }
  }

  // ==========================================
  // 3. Trailing Commas & Consecutive Operators
  // ==========================================
  if (options.checkSyntax) {
    // Check for trailing comma before clause keywords or closing parenthesis
    const trailingCommaRegex = /,\s*(\bFROM\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|\))/gi;
    let match;
    while ((match = trailingCommaRegex.exec(sql)) !== null) {
      const pos = offsetToLineCol(lines, match.index);
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + 1,
        message: 'Syntax Error: Trailing comma before clause keyword or parenthesis.',
        severity: 'error',
        category: 'syntax',
        code: 'TRAILING_COMMA',
        suggestion: 'Remove trailing comma',
        ruleExplanation: 'SQL does not allow trailing commas at the end of SELECT lists or parameter lists.',
      });
    }

    // Check for consecutive binary operators (e.g. WHERE AND, WHERE OR, AND AND, OR OR)
    const consecutiveOpRegex = /\b(WHERE|HAVING|ON)\s+(AND|OR)\b|\b(AND|OR)\s+(AND|OR)\b/gi;
    while ((match = consecutiveOpRegex.exec(sql)) !== null) {
      const pos = offsetToLineCol(lines, match.index);
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + match[0].length,
        message: `Syntax Error: Invalid consecutive boolean operators "${match[0]}".`,
        severity: 'error',
        category: 'syntax',
        code: 'CONSECUTIVE_OPERATOR',
        ruleExplanation: 'Boolean operators must be placed between two valid condition expressions.',
      });
    }

    // Check for abrupt statement endings (e.g. ends with WHERE, FROM, JOIN, ORDER BY with nothing after)
    const trimmedSql = sql.trim().replace(/;+$/, '').trim();
    const abruptEndRegex = /\b(WHERE|FROM|JOIN|ORDER\s+BY|GROUP\s+BY|HAVING|SELECT|AND|OR|ON)\s*$/i;
    const abruptMatch = trimmedSql.match(abruptEndRegex);
    if (abruptMatch) {
      const pos = offsetToLineCol(lines, sql.lastIndexOf(abruptMatch[0]));
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + abruptMatch[0].length,
        message: `Incomplete Statement: Query ends abruptly after "${abruptMatch[1]}". Expected expression or clause definition.`,
        severity: 'warning',
        category: 'syntax',
        code: 'ABRUPT_END',
        ruleExplanation: 'Clause keywords must be followed by their corresponding table, column, or condition expression.',
      });
    }

    // Check for JOIN without ON / USING clause
    const joinWithoutOnRegex = /\b(JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s*(?=(\bWHERE\b|\bGROUP\b|\bORDER\b|\bLIMIT\b|\bHAVING\b|;|$))/gi;
    while ((match = joinWithoutOnRegex.exec(sql)) !== null) {
      // Check if followed by ON or USING in the next segment
      const afterMatch = sql.substring(match.index + match[0].length, match.index + match[0].length + 30);
      if (!/^\s*(ON|USING)\b/i.test(afterMatch)) {
        const pos = offsetToLineCol(lines, match.index);
        const joinedTable = match[2];
        diagnostics.push({
          line: pos.line,
          startCol: pos.col,
          endCol: pos.col + match[0].length,
          message: `Missing JOIN Condition: "${match[1]} ${joinedTable}" is missing an "ON" or "USING" predicate.`,
          severity: 'error',
          category: 'syntax',
          code: 'MISSING_JOIN_ON',
          suggestion: `ON ${joinedTable}.id = ...`,
          ruleExplanation: 'Non-cross joins in PostgreSQL require an ON or USING clause to specify matching columns.',
        });
      }
    }
  }

  // ==========================================
  // 4. NULL Comparison Antipattern (= NULL / <> NULL)
  // ==========================================
  if (options.checkNullComparison) {
    const nullEqRegex = /\b([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\s*(=|!=|<>)\s*NULL\b/gi;
    let match;
    while ((match = nullEqRegex.exec(sql)) !== null) {
      const pos = offsetToLineCol(lines, match.index);
      const colExpr = match[1];
      const op = match[2];
      const replacement = op === '=' ? `${colExpr} IS NULL` : `${colExpr} IS NOT NULL`;
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + match[0].length,
        message: `Incorrect NULL Comparison: In SQL, "= NULL" or "<> NULL" always evaluates to UNKNOWN. Use "${replacement}".`,
        severity: 'error',
        category: 'safety',
        code: 'NULL_COMPARISON',
        suggestion: replacement,
        replacementText: replacement,
        ruleExplanation: 'SQL utilizes three-valued logic (TRUE, FALSE, UNKNOWN). Comparing any value with NULL using "=" or "!=" returns UNKNOWN/NULL instead of boolean true, meaning rows will never match.',
      });
    }
  }

  // ==========================================
  // 5. SELECT * Best Practice Warning
  // ==========================================
  if (options.checkSelectStar) {
    const selectStarRegex = /\bSELECT\s+(\*\s+|[a-zA-Z0-9_]+\.\*\s*)/gi;
    let match;
    while ((match = selectStarRegex.exec(sql)) !== null) {
      const pos = offsetToLineCol(lines, match.index);
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + match[0].length,
        message: 'Best Practice: Avoid "SELECT *". Explicitly specifying required columns optimizes network transfer, enables index-only scans, and prevents breaking changes when schemas evolve.',
        severity: 'warning',
        category: 'performance',
        code: 'SELECT_STAR',
        ruleExplanation: 'Using SELECT * forces PostgreSQL to read and transmit all columns over the network, prevents covering index optimizations, and can cause runtime bugs if table schema alters.',
      });
    }
  }

  // ==========================================
  // 6. Dangerous Mutation: UPDATE or DELETE without WHERE
  // ==========================================
  if (options.checkMissingWhere) {
    const isUpdate = /\bUPDATE\s+([a-zA-Z0-9_]+)/i.test(sql);
    const isDelete = /\bDELETE\s+FROM\s+([a-zA-Z0-9_]+)/i.test(sql);
    const hasWhere = /\bWHERE\b/i.test(sql);

    if ((isUpdate || isDelete) && !hasWhere) {
      const opName = isUpdate ? 'UPDATE' : 'DELETE';
      diagnostics.push({
        line: 1,
        startCol: 1,
        endCol: Math.min(60, lines[0].length + 1),
        message: `Critical Safety Warning: ${opName} statement has no WHERE clause! This will unconditionally mutate or delete EVERY row in the target table.`,
        severity: 'error',
        category: 'safety',
        code: 'MISSING_WHERE',
        ruleExplanation: 'In SQL, executing an UPDATE or DELETE without a WHERE clause applies the operation to all rows in the entire table table without restriction.',
      });
    }
  }

  // ==========================================
  // 7. Performance: Leading Wildcard in LIKE / ILIKE
  // ==========================================
  if (options.checkLeadingWildcard) {
    const leadingWildcardRegex = /\b([a-zA-Z0-9_]+)\s+(LIKE|ILIKE)\s+(['"]%[^'"]+['"])/gi;
    let match;
    while ((match = leadingWildcardRegex.exec(sql)) !== null) {
      const pos = offsetToLineCol(lines, match.index);
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + match[0].length,
        message: `Performance Tip: Leading wildcard in "${match[0]}" prevents B-Tree index lookup and triggers a full sequential table scan.`,
        severity: 'info',
        category: 'performance',
        code: 'LEADING_WILDCARD',
        ruleExplanation: 'Standard B-Tree indexes cannot be used when pattern matches begin with a wildcard (e.g. \'%term\'). Consider pg_trgm (trigram) GIN indexes or full-text search for fast substring searching.',
      });
    }
  }

  // ==========================================
  // 8. HAVING Clause Without Aggregate Function
  // ==========================================
  if (options.checkHavingWithoutAggregate) {
    const havingMatch = sql.match(/\bHAVING\s+([^;\n]+)/i);
    if (havingMatch) {
      const havingExpr = havingMatch[1];
      const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX|ARRAY_AGG|STRING_AGG)\s*\(/i.test(havingExpr);
      if (!hasAggregate) {
        const pos = offsetToLineCol(lines, sql.indexOf(havingMatch[0]));
        diagnostics.push({
          line: pos.line,
          startCol: pos.col,
          endCol: pos.col + havingMatch[0].length,
          message: 'Best Practice: HAVING clause is used without aggregate functions. Move row-level filters to WHERE for faster filtering before aggregation.',
          severity: 'warning',
          category: 'performance',
          code: 'HAVING_WITHOUT_AGG',
          ruleExplanation: 'WHERE filters rows BEFORE grouping, while HAVING filters groups AFTER grouping. Filtering in WHERE minimizes memory overhead and leverages indexes.',
        });
      }
    }
  }

  // ==========================================
  // 9. Cartesian Product (Implicit Multi-Table FROM without JOIN)
  // ==========================================
  if (options.checkCartesianProduct) {
    const commaFromRegex = /\bFROM\s+([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = commaFromRegex.exec(sql)) !== null) {
      const hasWhere = /\bWHERE\b/i.test(sql);
      const pos = offsetToLineCol(lines, match.index);
      diagnostics.push({
        line: pos.line,
        startCol: pos.col,
        endCol: pos.col + match[0].length,
        message: `Cartesian Product Risk: Multiple tables joined with comma syntax ("${match[1]}, ${match[2]}"). Use explicit "INNER JOIN ... ON" syntax to avoid accidental CROSS JOIN multiplier explosions.`,
        severity: hasWhere ? 'info' : 'warning',
        category: 'performance',
        code: 'CARTESIAN_PRODUCT',
        ruleExplanation: 'Comma-separated FROM tables create an implicit Cartesian product (M × N rows). Modern SQL standard recommends explicit JOIN ... ON syntax.',
      });
    }
  }

  // ==========================================
  // 10. Schema Validation (Tables & Columns)
  // ==========================================
  if (options.checkSchema && allTableNames.length > 0) {
    // Validate table references after FROM, JOIN, INTO, UPDATE
    const tableRefRegex = /\b(FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi;
    let match;
    while ((match = tableRefRegex.exec(sql)) !== null) {
      const rawTableRef = match[2];
      const matchIndex = match.index + match[0].indexOf(rawTableRef);
      const prevChar = matchIndex > 0 ? sql[matchIndex - 1] : '';

      // Skip parameter placeholders (e.g. :table or $table or {{table}})
      if (prevChar === ':' || prevChar === '$' || prevChar === '{') continue;

      const tableNameOnly = rawTableRef.includes('.') ? rawTableRef.split('.')[1] : rawTableRef;

      // Skip keywords, CTE aliases, subqueries
      if (SQL_KEYWORDS_UPPER.has(tableNameOnly.toUpperCase())) continue;

      const exists = allTablesMap.has(tableNameOnly.toLowerCase());
      if (!exists) {
        const pos = offsetToLineCol(lines, matchIndex);
        const suggestion = findClosestMatch(tableNameOnly, allTableNames);
        const msg = suggestion
          ? `Schema Validation: Table "${rawTableRef}" does not exist in schema. Did you mean "${suggestion}"?`
          : `Schema Validation: Table "${rawTableRef}" does not exist in loaded database schemas.`;

        diagnostics.push({
          line: pos.line,
          startCol: pos.col,
          endCol: pos.col + rawTableRef.length,
          message: msg,
          severity: 'error',
          category: 'schema',
          code: 'UNKNOWN_TABLE',
          suggestion: suggestion || undefined,
          replacementText: suggestion || undefined,
          ruleExplanation: `The table "${rawTableRef}" is not defined in any of the connected database schemas.`,
        });
      }
    }
  }

  // Sort diagnostics by line then column
  return diagnostics.sort((a, b) => a.line - b.line || a.startCol - b.startCol);
}

export function formatSqlKeywordCasing(sql: string): string {
  // Uppercase standard SQL keywords
  let result = sql;
  COMMON_SQL_KEYWORDS.forEach((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    result = result.replace(regex, kw);
  });
  return result;
}
