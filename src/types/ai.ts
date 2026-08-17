/** AI-native SQL Lab contracts — server-side only, mock until real LLM is wired. */

export type Nl2SqlRequest = {
  prompt: string;
  databaseId: string;
  schema?: string;
  schemaName?: string;
};

export type Nl2SqlResponse = {
  /** Generated SQL — never auto-executed, shown read-only and inserted only on explicit confirm. */
  sql: string;
  /** One-line explanation of what the SQL does, grounded in real table/column names. */
  explanation: string;
  /** Real tables from the requested database.schema that the SQL touches. */
  tablesUsed: string[];
  /** 0–1 — high when prompt matched a known pattern + real table, lower on fallback. */
  confidence: number;
  /** True while the mock engine is active; false when a real LLM is configured. */
  _mock: boolean;
};

export type HealRequest = {
  sql: string;
  errorMessage: string;
  databaseId?: string;
  schema?: string;
  schemaName?: string;
};

export type HealChange = {
  description: string;
  before: string;
  after: string;
};

export type HealResponse = {
  /** Fixed SQL — never auto-applied, caller must explicitly Apply. */
  fixedSql: string;
  /** Diagnosed cause in plain language, grounded in the error + real schema. */
  diagnosis: string;
  /** Visible diff — each entry is a before→after pair the caller renders inline. */
  changes: HealChange[];
  _mock: boolean;
};

export type ConverseContext = {
  surface: "explore" | "dashboard";
  chartId?: number;
  datasetId?: number;
  vizType?: string;
  currentQuery?: string;
  dashboardId?: number;
  chartIds?: number[];
};

export type ConverseRequest = {
  message: string;
  context: ConverseContext;
};

export type ConverseActionType = "modify_chart" | "generate_chart" | "filter" | "explain" | "compare";

export type ConverseAction = {
  type: ConverseActionType;
  payload: {
    vizType?: string;
    filters?: { column: string; operator: string; value: string }[];
    metrics?: string[];
    dimensions?: string[];
    chartConfig?: { vizType: string; datasetId: number; dimension: string; metric: string };
  };
};

export type ConverseResponse = {
  reply: string;
  action?: ConverseAction;
  sql?: string;
  tablesUsed?: string[];
  _mock: boolean;
};

export type InsightType = "trend" | "spike" | "drop" | "outlier" | "correlation";
export type InsightSeverity = "info" | "warning" | "critical";

export type Insight = {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  detail: string;
  chartId?: number;
  sql: string;
  tablesUsed: string[];
  confidence: number;
  change?: { before: number; after: number; delta: string };
};

export type InsightsRequest = {
  dashboardId: number;
  chartIds: number[];
  datasets: { datasetId: number; sampleRows: Record<string, unknown>[] }[];
};

export type InsightsResponse = {
  insights: Insight[];
  _mock: boolean;
};
