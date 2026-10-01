export type PermissionAction = 'view' | 'edit';

export type PermissionEntry = { view: boolean; edit: boolean };

export type PermissionMap = Record<string, PermissionEntry>;

export const SUPER_ADMIN_SLUG = 'SUPER_ADMIN';

export const PERMISSION_CATALOG: {
  key: string;
  label: string;
  groupKey: string | null;
  sortOrder: number;
}[] = [
  { key: 'dashboard', label: 'Dashboard', groupKey: null, sortOrder: 10 },
  { key: 'todo', label: 'TO DO računovođe', groupKey: null, sortOrder: 20 },
  { key: 'tickets', label: 'Tickets', groupKey: null, sortOrder: 30 },
  { key: 'sales', label: 'Prodaja', groupKey: null, sortOrder: 40 },
  { key: 'clients', label: 'Korisnici', groupKey: null, sortOrder: 50 },
  { key: 'devices', label: 'Devices', groupKey: null, sortOrder: 60 },
  { key: 'distributors', label: 'Distributeri', groupKey: null, sortOrder: 70 },
  { key: 'licences', label: 'Licences', groupKey: null, sortOrder: 80 },
  { key: 'projects', label: 'Evidencija rada', groupKey: null, sortOrder: 90 },
  { key: 'leave', label: 'Odsustva', groupKey: null, sortOrder: 100 },
  { key: 'reports.overview', label: 'Reports — pregled', groupKey: 'reports', sortOrder: 110 },
  { key: 'reports.tickets', label: 'Reports — tiketi', groupKey: 'reports', sortOrder: 120 },
  { key: 'reports.devices', label: 'Reports — uređaji', groupKey: 'reports', sortOrder: 130 },
  { key: 'reports.tables', label: 'Reports — tabele', groupKey: 'reports', sortOrder: 140 },
  { key: 'reports.licences', label: 'Reports — licence', groupKey: 'reports', sortOrder: 150 },
  { key: 'reports.generator', label: 'Reports — AI generator', groupKey: 'reports', sortOrder: 160 },
  { key: 'reports.alerts', label: 'Reports — alerti', groupKey: 'reports', sortOrder: 170 },
  { key: 'forms', label: 'Forms', groupKey: null, sortOrder: 180 },
  { key: 'tables', label: 'Tables', groupKey: null, sortOrder: 190 },
  { key: 'settings', label: 'Settings', groupKey: 'settings', sortOrder: 200 },
  { key: 'settings.users', label: 'Settings — Users', groupKey: 'settings', sortOrder: 210 },
  { key: 'settings.roles', label: 'Settings — Role', groupKey: 'settings', sortOrder: 220 },
  { key: 'calls', label: 'Quick/Outgoing Call', groupKey: null, sortOrder: 230 },
  { key: 'travelOrders', label: 'Putni nalozi', groupKey: null, sortOrder: 240 },
  { key: 'travelOrders.all', label: 'Putni nalozi — svi (isplata)', groupKey: null, sortOrder: 250 },
  { key: 'soldDevices', label: 'Prodati uređaji', groupKey: null, sortOrder: 260 },
];

export const SYSTEM_ROLE_DEFS: {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}[] = [
  { slug: 'SUPER_ADMIN', name: 'Super Admin', description: 'Pun pristup sistemu', sortOrder: 0 },
  { slug: 'SUPPORT', name: 'Support', description: 'Podrška', sortOrder: 1 },
  { slug: 'SALES', name: 'Sales', description: 'Prodaja', sortOrder: 2 },
  { slug: 'USER', name: 'User', description: 'Korisnik firme', sortOrder: 3 },
  { slug: 'ACCOUNTANT', name: 'Računovođa', description: 'Računovodstvo', sortOrder: 4 },
];

/** Default permissions for custom roles (all denied). */
export function emptyPermissionMap(): PermissionMap {
  const map: PermissionMap = {};
  for (const r of PERMISSION_CATALOG) {
    map[r.key] = { view: false, edit: false };
  }
  return map;
}

/** Full access map (for SUPER_ADMIN display). */
export function fullPermissionMap(): PermissionMap {
  const map: PermissionMap = {};
  for (const r of PERMISSION_CATALOG) {
    map[r.key] = { view: true, edit: true };
  }
  return map;
}

export function normalizePermissionEntry(
  canView: boolean,
  canEdit: boolean,
): PermissionEntry {
  const view = canView || canEdit;
  return { view, edit: canEdit && view };
}

export function hasPermission(
  map: PermissionMap | null | undefined,
  resource: string,
  action: PermissionAction,
  roleSlug?: string | null,
): boolean {
  if (roleSlug === SUPER_ADMIN_SLUG) return true;
  if (!map) return false;
  const entry = map[resource];
  if (!entry) return false;
  return action === 'edit' ? entry.edit : entry.view;
}
