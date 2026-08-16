export type DashboardStatus = "published" | "draft" | "archived";

export interface Dashboard {
  id: number;
  title: string;
  slug: string;
  /** Publication state — maps to status badges via semantic tokens. */
  status: DashboardStatus;
  modifiedBy: { id: number; name: string };
  modified: string; // ISO 8601
  createdBy: { id: number; name: string };
  owners: { id: number; name: string }[];
  tags: string[];
  favorite: boolean;
  /** Optional certification flag (Superset parity) */
  certified?: boolean;
  description?: string;
}

export type DashboardListParams = {
  q?: string;
  status?: DashboardStatus | "all";
  owner?: string;
  tag?: string;
  favorite?: boolean;
  sortBy?: keyof Pick<Dashboard, "title" | "modified" | "status">;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type DashboardListResponse = {
  data: Dashboard[];
  total: number;
  page: number;
  pageSize: number;
};
