import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';

// Determine hierarchy level from code like A, A.1, A.1.a, A.1.a.1, B.I, B.I.1, Sub Total A
function parseCodeLevel(code) {
  const s = String(code).trim();

  // Skip rows like "Sub Total X", "TOTAL", "Grand Total"
  if (/^(sub total|total|grand total)/i.test(s)) return { level: 0, isTotal: true };

  // Pure single letter: A, B, C → level 1 (group header)
  if (/^[A-Z]$/.test(s)) return { level: 1 };

  // Split by dots to count depth: A.1 → 2, A.1.a → 3, A.1.a.1 → 4
  const parts = s.split('.');
  return { level: parts.length };
}

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const projectId = formData.get('projectId');
    const file = formData.get('file');

    if (!projectId || !file) {
      return NextResponse.json({ error: 'projectId dan file diperlukan' }, { status: 400 });
    }

    if (typeof file.arrayBuffer !== 'function' || file.size > 4 * 1024 * 1024 || !/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ error: 'File Excel maksimum 4 MB.' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 });

    // ── Find header row (row containing "URAIAN") ──────────────────────────
    let headerRow = -1;
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (row && row.some(c => typeof c === 'string' && /uraian/i.test(c))) {
        headerRow = i;
        break;
      }
    }

    // Data starts after header + 2 numbering rows (row 11, 12, 13 → data from 14)
    const dataStartRow = headerRow >= 0 ? headerRow + 3 : 13;

    // ── Column mapping (0-indexed) ─────────────────────────────────────────
    // Col 0: NO / KODE
    // Col 1: URAIAN PEKERJAAN
    // Col 2: VOLUME AMM (owner)
    // Col 3: VOLUME PJM (contractor, this is the one we use)
    // Col 4: SATUAN
    // Col 5: HARGA SATUAN BAHAN
    // Col 6: HARGA SATUAN UPAH
    // Col 7: JUMLAH HARGA BAHAN
    // Col 8: JUMLAH HARGA UPAH
    // Col 9: TOTAL PRICE

    const items = [];
    let sortOrder = 0;

    for (let i = dataStartRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

      const rawCode = row[0];
      const desc = row[1] != null ? String(row[1]).trim() : null;

      if (!rawCode || !desc) continue;

      const code = String(rawCode).trim();
      const { level, isTotal } = parseCodeLevel(code);

      // Skip subtotal / total rows
      if (isTotal || level === 0) continue;

      const volPJM   = typeof row[3] === 'number' ? row[3] : null;
      const unit     = row[4] != null ? String(row[4]).trim() : null;
      const hrgBahan = typeof row[5] === 'number' ? row[5] : null;
      const hrgUpah  = typeof row[6] === 'number' ? row[6] : null;
      const jmlBahan = typeof row[7] === 'number' ? row[7] : (typeof row[7] === 'number' ? row[7] : null);
      const jmlUpah  = typeof row[8] === 'number' ? row[8] : null;
      const total    = typeof row[9] === 'number' ? row[9] : null;

      // Derive groupCode from first segment of code
      const groupCode = code.split('.')[0];

      items.push({
        projectId,
        code,
        groupCode,
        description: desc,
        level,
        sortOrder: sortOrder++,
        unit,
        quantity: volPJM,
        costMaterial: hrgBahan,
        costLabor: hrgUpah,
        totalMaterial: jmlBahan,
        totalLabor: jmlUpah,
        totalPrice: total,
        weight: null, // calculated below
        no: null,
        subNo: null,
      });
    }

    // Calculate weight (%) based on totalPrice vs contractValue
    const contractValue = project.contractValue || 0;
    const itemsWithWeight = items.map(item => ({
      ...item,
      weight: contractValue && item.totalPrice
        ? parseFloat(((item.totalPrice / contractValue) * 100).toFixed(4))
        : null,
    }));

    // Replace all BOQ items for this project
    await prisma.bOQItem.deleteMany({ where: { projectId } });
    await prisma.bOQItem.createMany({ data: itemsWithWeight });

    return NextResponse.json({ success: true, count: itemsWithWeight.length });
  } catch (err) {
    console.error('BOQ upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
