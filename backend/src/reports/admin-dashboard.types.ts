export type AdminDashboardSlice = {
  label: string;
  value: number;
};

export type AdminPackageRow = {
  productName: string;
  total: number;
};

export type AdminDeviceModelRow = {
  model: string;
  total: number;
  assigned: number;
  available: number;
  withDistributor: number;
  activeLicence: number;
  updated48h: number;
};

export type AdminDashboardDto = {
  generatedAt: string;
  summary: {
    companies: number;
    distributors: number;
    activeDevices: number;
    activeLicences: number;
    expiredLicences: number;
    ticketsOpen: number;
  };
  byDistributor: AdminDashboardSlice[];
  byModel: AdminDashboardSlice[];
  licenceCoverage: AdminDashboardSlice[];
  sufProduction: AdminDashboardSlice[];
  activePackages: AdminPackageRow[];
  devicesByModel: AdminDeviceModelRow[];
};
