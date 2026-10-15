export function isLeaf(item, items) {
  return !items.some(
    (other) =>
      other.id !== item.id &&
      other.code.toUpperCase().startsWith(item.code.toUpperCase() + "."),
  );
}
export function curve(project, items) {
  const leaves = items.filter((item) => isLeaf(item, items)),
    planned = {},
    actual = {};
  for (const item of leaves) {
    if (item.startMonth && item.endMonth && item.weight) {
      const [sy, sm] = item.startMonth.split("-").map(Number),
        [ey, em] = item.endMonth.split("-").map(Number),
        n = (ey - sy) * 12 + em - sm + 1;
      if (n > 0 && n <= 1200) {
        const d = new Date(item.startMonth + "-01T00:00:00Z");
        for (let i = 0; i < n; i++) {
          const key = d.toISOString().slice(0, 7);
          planned[key] = (planned[key] || 0) + item.weight / n;
          d.setUTCMonth(d.getUTCMonth() + 1);
        }
      }
    }
    for (const row of item.actuals || [])
      if (row.progressPct != null)
        actual[row.month] =
          (actual[row.month] || 0) +
          (row.progressPct / 100) * (item.weight || 0);
  }
  let p = 0,
    a = 0;
  const scurveData = [
    ...new Set([...Object.keys(planned), ...Object.keys(actual)]),
  ]
    .sort()
    .map((month) => {
      p += planned[month] || 0;
      a += actual[month] || 0;
      return {
        month,
        planned: Number(p.toFixed(2)),
        actual: Number(a.toFixed(2)),
      };
    });
  return {
    project,
    boqItems: items.map((item) => ({ ...item, isLeaf: isLeaf(item, items) })),
    scurveData,
    summary: {
      totalWeight: leaves.reduce((s, i) => s + (i.weight || 0), 0).toFixed(2),
      itemCount: leaves.length,
      scheduledCount: leaves.filter((i) => i.startMonth && i.endMonth).length,
    },
  };
}
