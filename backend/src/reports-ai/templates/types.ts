export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportTableResult = {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  meta?: Record<string, string | number | boolean | null>;
};

export type TemplateRunContext = {
  tenantId: string;
  now: Date;
};

export type ReportTemplate = {
  key: string;
  title: string;
  description: string;
  paramsSchema: Record<string, 'number' | 'string' | 'boolean'>;
  run: (ctx: TemplateRunContext, params: Record<string, unknown>) => Promise<ReportTableResult>;
};

