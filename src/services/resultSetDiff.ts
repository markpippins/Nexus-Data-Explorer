import {
  QueryExecutionResult,
  ResultSetDiff,
  DiffRow,
  DiffCell,
  DiffRowStatus,
  ColumnsComparison,
  DiffStatistics,
} from '../types/database';

export interface DiffPreset {
  id: string;
  title: string;
  category: 'E-Commerce' | 'Customers' | 'Inventory' | 'Performance';
  description: string;
  leftTitle: string;
  leftQuery: string;
  rightTitle: string;
  rightQuery: string;
}

export const DIFF_PRESETS: DiffPreset[] = [
  {
    id: 'customer-spending-tiers',
    title: 'Customer Segmentation: Standard vs High-Value (> $250)',
    category: 'Customers',
    description: 'Compare all active customers against customers with total spend exceeding $250 to analyze cohort variance.',
    leftTitle: 'All Active Customers',
    leftQuery: `SELECT 
  id, 
  name, 
  email, 
  city, 
  loyalty_tier, 
  total_spend, 
  is_active 
FROM public.customers 
WHERE is_active = true 
ORDER BY id ASC;`,
    rightTitle: 'High-Value Customers ($250+)',
    rightQuery: `SELECT 
  id, 
  name, 
  email, 
  city, 
  loyalty_tier, 
  total_spend, 
  is_active 
FROM public.customers 
WHERE is_active = true 
  AND total_spend >= 250.00 
ORDER BY id ASC;`,
  },
  {
    id: 'order-status-comparison',
    title: 'Order Status Variance: All Orders vs Completed Orders',
    category: 'E-Commerce',
    description: 'Contrast full order volume against completed transactions to audit pending/cancelled friction.',
    leftTitle: 'All Recent Orders',
    leftQuery: `SELECT 
  id, 
  customer_id, 
  order_date, 
  status, 
  total_amount 
FROM public.orders 
ORDER BY id ASC 
LIMIT 20;`,
    rightTitle: 'Completed Orders Only',
    rightQuery: `SELECT 
  id, 
  customer_id, 
  order_date, 
  status, 
  total_amount 
FROM public.orders 
WHERE status = 'COMPLETED' 
ORDER BY id ASC 
LIMIT 20;`,
  },
  {
    id: 'product-pricing-simulation',
    title: 'Simulated 15% Price Surcharge on Electronics',
    category: 'Inventory',
    description: 'Simulate the financial impact of a 15% inflation adjustment across the product catalog.',
    leftTitle: 'Baseline Product Prices',
    leftQuery: `SELECT 
  id, 
  name, 
  category, 
  price AS unit_price, 
  stock_quantity 
FROM public.products 
ORDER BY id ASC;`,
    rightTitle: 'Price +15% on Electronics',
    rightQuery: `SELECT 
  id, 
  name, 
  category, 
  CASE 
    WHEN category = 'Electronics' THEN ROUND(price * 1.15, 2) 
    ELSE price 
  END AS unit_price, 
  stock_quantity 
FROM public.products 
ORDER BY id ASC;`,
  },
  {
    id: 'city-geographic-distribution',
    title: 'Geographic Filter: New York vs West Coast (Seattle/SF)',
    category: 'Customers',
    description: 'Compare customer records between East Coast hub and West Coast metro regions.',
    leftTitle: 'New York Customers',
    leftQuery: `SELECT 
  id, 
  name, 
  city, 
  loyalty_tier, 
  total_spend 
FROM public.customers 
WHERE city = 'New York' 
ORDER BY id ASC;`,
    rightTitle: 'San Francisco & Seattle Customers',
    rightQuery: `SELECT 
  id, 
  name, 
  city, 
  loyalty_tier, 
  total_spend 
FROM public.customers 
WHERE city IN ('San Francisco', 'Seattle') 
ORDER BY id ASC;`,
  },
];

/**
 * Deep value equality check
 */
export function areValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;

  // Numeric comparison with tolerance
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 0.000001;
  }

  // If one is numeric string and other is number
  if (typeof a === 'number' && typeof b === 'string') {
    const parsedB = parseFloat(b);
    return !isNaN(parsedB) && Math.abs(a - parsedB) < 0.000001;
  }
  if (typeof a === 'string' && typeof b === 'number') {
    const parsedA = parseFloat(a);
    return !isNaN(parsedA) && Math.abs(parsedA - b) < 0.000001;
  }

  // Boolean string comparison
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  // Objects and arrays
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  return String(a).trim() === String(b).trim();
}

/**
 * Identify all potential key columns from the column list
 */
export function detectCandidateKeyColumns(leftColumns: string[], rightColumns: string[]): string[] {
  const common = leftColumns.filter((c) => rightColumns.includes(c));
  const candidates: string[] = [];

  // Special virtual option
  candidates.push('__index__');

  // Prioritize primary keys / ID-like columns
  const idCol = common.find((c) => c.toLowerCase() === 'id');
  if (idCol) candidates.unshift(idCol);

  common.forEach((c) => {
    const lower = c.toLowerCase();
    if (c !== idCol && (lower.endsWith('_id') || lower.endsWith('id') || lower === 'code' || lower === 'uuid' || lower === 'key')) {
      if (!candidates.includes(c)) candidates.push(c);
    }
  });

  // Add remaining common columns
  common.forEach((c) => {
    if (!candidates.includes(c)) candidates.push(c);
  });

  return candidates;
}

/**
 * Compare two query execution results
 */
export function computeResultSetDiff(
  leftResult: QueryExecutionResult,
  rightResult: QueryExecutionResult,
  selectedKeyColumn?: string
): ResultSetDiff {
  const leftCols = leftResult?.columns || [];
  const rightCols = rightResult?.columns || [];

  const candidateKeys = detectCandidateKeyColumns(leftCols, rightCols);

  // Auto-pick key column
  let keyColumn = selectedKeyColumn;
  if (!keyColumn || (!candidateKeys.includes(keyColumn) && keyColumn !== '__index__')) {
    keyColumn = candidateKeys[0] || '__index__';
  }

  // Column categorization
  const commonColumns = leftCols.filter((c) => rightCols.includes(c));
  const leftOnlyColumns = leftCols.filter((c) => !rightCols.includes(c));
  const rightOnlyColumns = rightCols.filter((c) => !leftCols.includes(c));

  // Build sorted master column list: Key column first, then common columns, then left only, then right only
  const allColumnsSet = new Set<string>();
  if (keyColumn !== '__index__' && commonColumns.includes(keyColumn)) {
    allColumnsSet.add(keyColumn);
  }
  commonColumns.forEach((c) => allColumnsSet.add(c));
  leftOnlyColumns.forEach((c) => allColumnsSet.add(c));
  rightOnlyColumns.forEach((c) => allColumnsSet.add(c));
  const allColumns = Array.from(allColumnsSet);

  const columnsComparison: ColumnsComparison = {
    allColumns,
    commonColumns,
    leftOnlyColumns,
    rightOnlyColumns,
  };

  const leftRows = leftResult?.rows || [];
  const rightRows = rightResult?.rows || [];

  const diffRows: DiffRow[] = [];

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;
  let totalCellChanges = 0;

  if (keyColumn === '__index__') {
    // Compare row by sequential index
    const maxLen = Math.max(leftRows.length, rightRows.length);

    for (let i = 0; i < maxLen; i++) {
      const leftRow = leftRows[i] || null;
      const rightRow = rightRows[i] || null;
      const rowKey = `Row #${i + 1}`;

      const cells: Record<string, DiffCell> = {};
      let changedColumnCount = 0;

      if (leftRow && !rightRow) {
        // Removed row
        allColumns.forEach((col) => {
          cells[col] = {
            leftValue: leftRow[col],
            rightValue: undefined,
            isChanged: true,
            rightMissing: true,
          };
        });
        removedCount++;
        diffRows.push({
          id: `diff-row-${i}`,
          rowKey,
          status: 'removed',
          leftRowIndex: i,
          leftRow,
          rightRow: null,
          cells,
          changedColumnCount: allColumns.length,
        });
      } else if (!leftRow && rightRow) {
        // Added row
        allColumns.forEach((col) => {
          cells[col] = {
            leftValue: undefined,
            rightValue: rightRow[col],
            isChanged: true,
            leftMissing: true,
          };
        });
        addedCount++;
        diffRows.push({
          id: `diff-row-${i}`,
          rowKey,
          status: 'added',
          rightRowIndex: i,
          leftRow: null,
          rightRow,
          cells,
          changedColumnCount: allColumns.length,
        });
      } else if (leftRow && rightRow) {
        // Both exist -> compare cells
        allColumns.forEach((col) => {
          const lVal = leftRow[col];
          const rVal = rightRow[col];
          const isLeftMissing = !(col in leftRow);
          const isRightMissing = !(col in rightRow);
          const isChanged = isLeftMissing !== isRightMissing || !areValuesEqual(lVal, rVal);

          if (isChanged) {
            changedColumnCount++;
            totalCellChanges++;
          }

          cells[col] = {
            leftValue: lVal,
            rightValue: rVal,
            isChanged,
            leftMissing: isLeftMissing,
            rightMissing: isRightMissing,
          };
        });

        const status: DiffRowStatus = changedColumnCount > 0 ? 'modified' : 'unchanged';
        if (status === 'modified') modifiedCount++;
        else unchangedCount++;

        diffRows.push({
          id: `diff-row-${i}`,
          rowKey,
          status,
          leftRowIndex: i,
          rightRowIndex: i,
          leftRow,
          rightRow,
          cells,
          changedColumnCount,
        });
      }
    }
  } else {
    // Key-based comparison
    const leftMap = new Map<any, { row: Record<string, any>; index: number }>();
    leftRows.forEach((row, idx) => {
      const keyVal = row[keyColumn!];
      const normalizedKey = keyVal !== undefined && keyVal !== null ? String(keyVal) : `__null_left_${idx}__`;
      leftMap.set(normalizedKey, { row, index: idx });
    });

    const rightMap = new Map<any, { row: Record<string, any>; index: number }>();
    rightRows.forEach((row, idx) => {
      const keyVal = row[keyColumn!];
      const normalizedKey = keyVal !== undefined && keyVal !== null ? String(keyVal) : `__null_right_${idx}__`;
      rightMap.set(normalizedKey, { row, index: idx });
    });

    // 1. Process all keys in Left
    const processedRightKeys = new Set<string>();

    leftMap.forEach(({ row: leftRow, index: lIdx }, keyStr) => {
      const rightEntry = rightMap.get(keyStr);
      const rowKey = keyStr.startsWith('__null_') ? `(Null Key #${lIdx + 1})` : `${keyColumn}: ${keyStr}`;

      const cells: Record<string, DiffCell> = {};
      let changedColumnCount = 0;

      if (!rightEntry) {
        // Removed from Right
        allColumns.forEach((col) => {
          cells[col] = {
            leftValue: leftRow[col],
            rightValue: undefined,
            isChanged: true,
            rightMissing: true,
          };
        });
        removedCount++;
        diffRows.push({
          id: `diff-l-${lIdx}`,
          rowKey,
          status: 'removed',
          leftRowIndex: lIdx,
          leftRow,
          rightRow: null,
          cells,
          changedColumnCount: allColumns.length,
        });
      } else {
        // Present in both -> compare
        processedRightKeys.add(keyStr);
        const rightRow = rightEntry.row;
        const rIdx = rightEntry.index;

        allColumns.forEach((col) => {
          const lVal = leftRow[col];
          const rVal = rightRow[col];
          const isLeftMissing = !(col in leftRow);
          const isRightMissing = !(col in rightRow);
          const isChanged = isLeftMissing !== isRightMissing || !areValuesEqual(lVal, rVal);

          if (isChanged) {
            changedColumnCount++;
            totalCellChanges++;
          }

          cells[col] = {
            leftValue: lVal,
            rightValue: rVal,
            isChanged,
            leftMissing: isLeftMissing,
            rightMissing: isRightMissing,
          };
        });

        const status: DiffRowStatus = changedColumnCount > 0 ? 'modified' : 'unchanged';
        if (status === 'modified') modifiedCount++;
        else unchangedCount++;

        diffRows.push({
          id: `diff-m-${lIdx}-${rIdx}`,
          rowKey,
          status,
          leftRowIndex: lIdx,
          rightRowIndex: rIdx,
          leftRow,
          rightRow,
          cells,
          changedColumnCount,
        });
      }
    });

    // 2. Process added keys only in Right
    rightMap.forEach(({ row: rightRow, index: rIdx }, keyStr) => {
      if (processedRightKeys.has(keyStr)) return;

      const rowKey = keyStr.startsWith('__null_') ? `(Null Key #${rIdx + 1})` : `${keyColumn}: ${keyStr}`;
      const cells: Record<string, DiffCell> = {};

      allColumns.forEach((col) => {
        cells[col] = {
          leftValue: undefined,
          rightValue: rightRow[col],
          isChanged: true,
          leftMissing: true,
        };
      });

      addedCount++;
      diffRows.push({
        id: `diff-r-${rIdx}`,
        rowKey,
        status: 'added',
        rightRowIndex: rIdx,
        leftRow: null,
        rightRow,
        cells,
        changedColumnCount: allColumns.length,
      });
    });
  }

  // Calculate similarity percentage
  const totalCompared = diffRows.length;
  const similarityPercentage =
    totalCompared === 0
      ? 100
      : Math.round((unchangedCount / totalCompared) * 100);

  const leftLatency = leftResult?.executionTimeMs || 0;
  const rightLatency = rightResult?.executionTimeMs || 0;

  const stats: DiffStatistics = {
    totalLeftRows: leftRows.length,
    totalRightRows: rightRows.length,
    rowDelta: rightRows.length - leftRows.length,
    addedCount,
    removedCount,
    modifiedCount,
    unchangedCount,
    totalCellChanges,
    leftLatencyMs: leftLatency,
    rightLatencyMs: rightLatency,
    latencyDeltaMs: rightLatency - leftLatency,
    similarityPercentage,
  };

  return {
    leftResult,
    rightResult,
    keyColumn,
    availableKeyColumns: candidateKeys,
    columns: columnsComparison,
    rows: diffRows,
    stats,
  };
}

/**
 * Export Diff as CSV
 */
export function exportDiffToCsv(diff: ResultSetDiff): void {
  const headers = ['Status', 'Key', ...diff.columns.allColumns.map((c) => `Left_${c}`), ...diff.columns.allColumns.map((c) => `Right_${c}`)];
  const rows = diff.rows.map((row) => {
    const status = row.status.toUpperCase();
    const key = `"${String(row.rowKey).replace(/"/g, '""')}"`;
    const leftVals = diff.columns.allColumns.map((c) => {
      const val = row.cells[c]?.leftValue;
      if (val === undefined || val === null) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    const rightVals = diff.columns.allColumns.map((c) => {
      const val = row.cells[c]?.rightValue;
      if (val === undefined || val === null) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    return [status, key, ...leftVals, ...rightVals].join(',');
  });

  const content = `${headers.join(',')}\n${rows.join('\n')}`;
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `result_diff_export_${Date.now()}.csv`;
  a.click();
}

/**
 * Export Diff as Markdown Report
 */
export function generateMarkdownDiffReport(diff: ResultSetDiff): string {
  const { stats } = diff;
  let md = `# 📊 SQL Result Set Comparison Report\n\n`;
  md += `Generated on: ${new Date().toLocaleString()}\n\n`;
  md += `## Summary Statistics\n`;
  md += `- **Matching Key:** \`${diff.keyColumn}\`\n`;
  md += `- **Similarity:** ${stats.similarityPercentage}%\n`;
  md += `- **Left Rows (Baseline):** ${stats.totalLeftRows} rows (${stats.leftLatencyMs} ms)\n`;
  md += `- **Right Rows (Comparison):** ${stats.totalRightRows} rows (${stats.rightLatencyMs} ms)\n`;
  md += `- **Row Count Delta:** ${stats.rowDelta >= 0 ? `+${stats.rowDelta}` : stats.rowDelta}\n`;
  md += `- **Unchanged / Identical:** ${stats.unchangedCount} rows\n`;
  md += `- **Modified:** ${stats.modifiedCount} rows (${stats.totalCellChanges} changed cells)\n`;
  md += `- **Added in Right:** +${stats.addedCount} rows\n`;
  md += `- **Removed from Right:** -${stats.removedCount} rows\n\n`;

  md += `## Queries Executed\n`;
  md += `### Left Query (Baseline):\n\`\`\`sql\n${diff.leftResult.query || 'N/A'}\n\`\`\`\n\n`;
  md += `### Right Query (Comparison):\n\`\`\`sql\n${diff.rightResult.query || 'N/A'}\n\`\`\`\n\n`;

  md += `## Differences Detail\n\n`;
  const diffOnlyRows = diff.rows.filter((r) => r.status !== 'unchanged');
  if (diffOnlyRows.length === 0) {
    md += `*Both result sets are identical across all columns and values.*\n`;
  } else {
    diffOnlyRows.slice(0, 50).forEach((r, idx) => {
      md += `### ${idx + 1}. [${r.status.toUpperCase()}] ${r.rowKey}\n`;
      if (r.status === 'modified') {
        md += `| Column | Baseline (Left) | Comparison (Right) |\n|---|---|---|\n`;
        diff.columns.allColumns.forEach((c) => {
          const cell = r.cells[c];
          if (cell?.isChanged) {
            md += `| **${c}** | \`${cell.leftValue ?? 'NULL'}\` | \`${cell.rightValue ?? 'NULL'}\` |\n`;
          }
        });
      } else if (r.status === 'added') {
        md += `Row added with values: \`${JSON.stringify(r.rightRow)}\`\n`;
      } else if (r.status === 'removed') {
        md += `Row removed with values: \`${JSON.stringify(r.leftRow)}\`\n`;
      }
      md += `\n`;
    });
  }

  return md;
}
