export type ChartVizType =
  | "Bar"
  | "Line"
  | "Pie"
  | "Donut"
  | "Scatter"
  | "Table"
  | "Big Number"
  | "Heatmap"
  | "Area"
  | "Box Plot"
  | "Violin"
  | "Treemap"
  | "Sunburst"
  | "Sankey"
  | "Gauge";

export interface Chart {
  id: number;
  name: string;
  slug: string;
  vizType: ChartVizType;
  dataset: string;
  database: string;
  schema: string;
  table: string;
  modified: string; // ISO 8601
  modifiedBy: { id: number; name: string };
  createdBy: { id: number; name: string };
  owners: { id: number; name: string }[];
  tags: string[];
  favorite: boolean;
  certified?: boolean;
  description?: string;
}

export type ChartListParams = {
  q?: string;
  vizType?: ChartVizType | "all";
  dataset?: string;
  owner?: string;
  tag?: string;
  favorite?: boolean;
  sortBy?: keyof Pick<Chart, "name" | "modified" | "vizType">;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type ChartListResponse = {
  data: Chart[];
  total: number;
  page: number;
  pageSize: number;
};
