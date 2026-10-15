import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/scurve?projectId=xxx
 * Returns:
 *  - boqItems with schedule + actuals
 *  - scurvePlan: [{month, planned}] — cumulative % rencana per bulan
 *  - scurveActual: [{month, actual}] — cumulative % aktual per bulan
 */
export async function GET(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const boqItems = await prisma.bOQItem.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    include: { actuals: { orderBy: { month: 'asc' } } },
  });

  // ─── Generate S-Curve Plan ────────────────────────────────────
  // For each item with weight + startMonth + endMonth:
  // distribute weight linearly across months
  const monthlyPlan = {}; // { "2025-01": number }

  for (const item of boqItems) {
    if (!item.weight || !item.startMonth || !item.endMonth) continue;

    const start = parseYYYYMM(item.startMonth);
    const end = parseYYYYMM(item.endMonth);
    const months = monthsBetween(start, end);
    if (months === 0) continue;

    const weightPerMonth = item.weight / months;
    let cur = new Date(start);
    for (let m = 0; m < months; m++) {
      const key = formatYYYYMM(cur);
      monthlyPlan[key] = (monthlyPlan[key] || 0) + weightPerMonth;
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  // ─── Generate S-Curve Actual ──────────────────────────────────
  // Sum progressPct × weight per item per month
  const monthlyActual = {};
  for (const item of boqItems) {
    if (!item.weight) continue;
    for (const actual of item.actuals) {
      if (actual.progressPct == null) continue;
      // progressPct is 0-100 for this item this month
      const contribution = (actual.progressPct / 100) * item.weight;
      monthlyActual[actual.month] = (monthlyActual[actual.month] || 0) + contribution;
    }
  }

  // ─── Sort & cumulate ─────────────────────────────────────────
  const allMonths = [...new Set([...Object.keys(monthlyPlan), ...Object.keys(monthlyActual)])].sort();

  let cumPlan = 0;
  let cumActual = 0;
  const scurveData = allMonths.map(month => {
    cumPlan += monthlyPlan[month] || 0;
    cumActual += monthlyActual[month] || 0;
    return {
      month,
      planned: parseFloat(cumPlan.toFixed(2)),
      actual: monthlyActual[month] != null ? parseFloat(cumActual.toFixed(2)) : null,
    };
  });

  return NextResponse.json({
    project,
    boqItems,
    scurveData,
    summary: {
      totalWeight: boqItems.reduce((s, i) => s + (i.weight || 0), 0).toFixed(2),
      itemCount: boqItems.length,
      scheduledCount: boqItems.filter(i => i.startMonth && i.endMonth).length,
    }
  });
}

function parseYYYYMM(str) {
  const [y, m] = str.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function formatYYYYMM(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}
