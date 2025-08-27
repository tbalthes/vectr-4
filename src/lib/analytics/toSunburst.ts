export type FlatCategoryRow = {
  category: string;
  subcategory?: string | null;
  merchant?: string | null;
  amount: number;
};

export type SunburstNode = {
  name: string;
  value?: number;
  children?: SunburstNode[];
};

export interface ToSunburstOptions {
  topNLevel1?: number; // categories
  includeOthers?: boolean;
}

/**
 * Transform flat category rows into ECharts Sunburst nodes, aggregating by category only.
 */
export function toSunburst(
  rows: FlatCategoryRow[],
  options: ToSunburstOptions = {}
): SunburstNode[] {
  const {
    topNLevel1 = 12,
    includeOthers = true,
  } = options;

  // Aggregate by category only
  const agg = new Map<string, number>();
  for (const r of rows) {
    const cat = r.category || "Uncategorized";
    agg.set(cat, (agg.get(cat) || 0) + Math.max(0, r.amount));
  }

  // Sort helper
  const sortDesc = <T extends { value: number }>(arr: T[]) => arr.sort((a, b) => b.value - a.value);

  // Assemble nodes with top-N and others
  const result: SunburstNode[] = [];
  type CatEntry = { name: string; value: number };
  const catEntries: CatEntry[] = Array.from(agg.entries()).map(([name, amount]) => ({
    name,
    value: amount,
  }));
  sortDesc(catEntries);

  const keptCats = catEntries.slice(0, topNLevel1);
  const otherCats = catEntries.slice(topNLevel1);

  for (const c of keptCats) {
    result.push({ name: c.name, value: c.value });
  }

  if (includeOthers && otherCats.length > 0) {
    result.push({
      name: "Other",
      value: otherCats.reduce((s, cat) => s + cat.value, 0),
    });
  }

  return result;
}
