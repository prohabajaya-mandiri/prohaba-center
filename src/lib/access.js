export const ROLES = ['TOP_MANAGEMENT', 'HRD', 'PJO', 'LOGISTIK', 'FINANCE', 'ENGINEERING', 'WORKSHOP'];
const moduleRoles = {
  dashboard: ROLES, projects: ROLES,
  scurve: ['TOP_MANAGEMENT', 'PJO', 'FINANCE', 'ENGINEERING'],
  boq: ['TOP_MANAGEMENT', 'PJO', 'FINANCE', 'ENGINEERING'],
  documents: ['TOP_MANAGEMENT', 'ENGINEERING', 'PJO', 'WORKSHOP'],
  workshop: ['TOP_MANAGEMENT', 'ENGINEERING', 'WORKSHOP', 'PJO'],
  'material-request': ['TOP_MANAGEMENT', 'PJO', 'LOGISTIK'],
  logistik: ['TOP_MANAGEMENT', 'PJO', 'LOGISTIK'],
  procurement: ['TOP_MANAGEMENT', 'LOGISTIK', 'FINANCE'],
  'site-purchase': ['TOP_MANAGEMENT', 'PJO', 'LOGISTIK', 'FINANCE'],
  finance: ['TOP_MANAGEMENT', 'FINANCE'], revenue: ['TOP_MANAGEMENT', 'FINANCE'],
  hr: ['TOP_MANAGEMENT', 'HRD', 'PJO'], payroll: ['TOP_MANAGEMENT', 'HRD', 'FINANCE'],
  users: ['TOP_MANAGEMENT'], 'audit-log': ['TOP_MANAGEMENT'],
};
export function canAccess(role, pathname, method = 'GET') {
  const parts = pathname.split('/').filter(Boolean);
  const moduleName = parts[0] === 'api' ? parts[1] : parts[0];
  if (!moduleRoles[moduleName]?.includes(role)) return false;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  if (moduleName === 'projects') return ['TOP_MANAGEMENT', 'PJO'].includes(role);
  if (moduleName === 'documents') return ['TOP_MANAGEMENT', 'ENGINEERING', 'PJO'].includes(role);
  if (['scurve', 'boq'].includes(moduleName)) return ['TOP_MANAGEMENT', 'ENGINEERING', 'PJO'].includes(role);
  if (pathname === '/api/payroll/generate') return ['TOP_MANAGEMENT', 'HRD'].includes(role);
  return true;
}
export function isSameOriginMutation(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const url = new URL(request.url);
  // Next.js may use an internal hostname in request.url behind a reverse proxy.
  const host = request.headers.get('host') ?? url.host;
  const protocol = process.env.VERCEL ? 'https:' : url.protocol;
  return origin === `${protocol}//${host}`;
}

