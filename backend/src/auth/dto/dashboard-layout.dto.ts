export interface DashboardWidgetConfig {
  id: string;
  visible: boolean;
  width: 'full' | 'half';
}

export class DashboardLayoutDto {
  widgets!: DashboardWidgetConfig[];
}
