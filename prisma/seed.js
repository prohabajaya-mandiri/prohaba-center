import { prisma } from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || new URL(process.env.DATABASE_URL).searchParams.get('schema') !== 'prohaba_dev' || process.env.ALLOW_DESTRUCTIVE_DEMO_SEED !== 'true') {
    throw new Error('Demo seed hanya boleh pada schema prohaba_dev dengan ALLOW_DESTRUCTIVE_DEMO_SEED=true.');
  }
  console.log('🌱 Seeding database ERP Prohaba Jaya Mandiri...');

  // Clean existing data (ignore errors on first run)
  const tables = [
    'auditLog', 'payrollApproval', 'payrollItem', 'payroll',
    'attendance', 'employeeProject', 'employee', 'progressItem',
    'sCurveBaseline', 'bOQItem', 'document', 'mRItem', 'materialRequest',
    'pOItem', 'purchaseOrder', 'journalVoucherItem', 'journalVoucher', 'purchaseInvoice', 'vendor',
    'salesInvoice', 'project', 'purchaseFlag', 'sitePurchase', 'priceReference', 'user', 'gLAccount'
  ];
  for (const table of tables) {
    try { await prisma[table].deleteMany(); } catch {}
  }

  // ─── Users ────────────────────────────────────────────────
  console.log('Creating users...');
  await Promise.all([
    prisma.user.create({ data: { name: 'Direktur Utama', email: 'admin@prohaba.co.id', password: await bcrypt.hash('admin123', 10), role: 'TOP_MANAGEMENT' } }),
    prisma.user.create({ data: { name: 'Ratna Dewi', email: 'hrd@prohaba.co.id', password: await bcrypt.hash('hrd123', 10), role: 'HRD' } }),
    prisma.user.create({ data: { name: 'Hendra Wijaya', email: 'pjo@prohaba.co.id', password: await bcrypt.hash('pjo123', 10), role: 'PJO' } }),
    prisma.user.create({ data: { name: 'Sari Indah', email: 'finance@prohaba.co.id', password: await bcrypt.hash('finance123', 10), role: 'FINANCE' } }),
    prisma.user.create({ data: { name: 'Budi Santoso', email: 'logistik@prohaba.co.id', password: await bcrypt.hash('logistik123', 10), role: 'LOGISTIK' } }),
    prisma.user.create({ data: { name: 'Ir. Andi Surya', email: 'engineering@prohaba.co.id', password: await bcrypt.hash('engineering123', 10), role: 'ENGINEERING' } }),
    prisma.user.create({ data: { name: 'Pak Warsito', email: 'workshop@prohaba.co.id', password: await bcrypt.hash('workshop123', 10), role: 'WORKSHOP' } }),
  ]);

  // ─── Projects ────────────────────────────────────────────
  console.log('Creating projects...');
  await Promise.all([
    prisma.project.create({ data: { code: 'PRJ-001', name: 'Pembangunan Jetty & Coal Handling Facility', client: 'PT. Adaro Energy Tbk', location: 'Tabalong, Kalimantan Selatan', contractValue: 28500000000, startDate: new Date('2024-01-15'), endDate: new Date('2024-12-31') } }),
    prisma.project.create({ data: { code: 'PRJ-002', name: 'Konstruksi Conveyor Belt System', client: 'PT. Berau Coal', location: 'Berau, Kalimantan Timur', contractValue: 15800000000, startDate: new Date('2024-03-01'), endDate: new Date('2024-10-31') } }),
    prisma.project.create({ data: { code: 'PRJ-003', name: 'Fabrikasi & Instalasi Steel Structure', client: 'PT. Kideco Jaya Agung', location: 'Paser, Kalimantan Timur', contractValue: 9200000000, startDate: new Date('2023-09-01'), endDate: new Date('2024-07-31') } }),
    prisma.project.create({ data: { code: 'PRJ-004', name: 'Piping & Mechanical Works Mining Plant', client: 'PT. Arutmin Indonesia', location: 'Kotabaru, Kalimantan Selatan', contractValue: 12400000000, startDate: new Date('2024-04-01'), endDate: new Date('2025-03-31') } }),
    prisma.project.create({ data: { code: 'PRJ-005', name: 'Gudang & Fasilitas Penunjang Tambang', client: 'PT. Multi Harapan Utama', location: 'Kutai Kartanegara, Kaltim', contractValue: 6800000000, startDate: new Date('2023-11-01'), endDate: new Date('2024-08-31') } }),
    prisma.project.create({ data: { code: 'PRJ-006', name: 'Workshop & Maintenance Facility', client: 'PT. Indominco Mandiri', location: 'Bontang, Kalimantan Timur', contractValue: 5100000000, startDate: new Date('2024-05-01'), endDate: new Date('2025-01-31') } }),
    prisma.project.create({ data: { code: 'PRJ-007', name: 'Rehabilitasi & Upgrade Fasilitas Produksi', client: 'PT. Trubaindo Coal Mining', location: 'Kutai Barat, Kalimantan Timur', contractValue: 3900000000, startDate: new Date('2024-02-15'), endDate: new Date('2024-11-30') } }),
  ]);


  // ─── GL Accounts ─────────────────────────────────────────
  console.log('Creating GL Accounts...');
  await prisma.gLAccount.createMany({
    data: [
      { accountNo: '1100.01', name: 'Kas Kecil', accountType: 'KAS_BANK', balance: 15000000 },
      { accountNo: '1100.02', name: 'Bank Mandiri IDR', accountType: 'KAS_BANK', balance: 1250000000 },
      { accountNo: '1200.01', name: 'Piutang Usaha', accountType: 'PIUTANG', balance: 4500000000 },
      { accountNo: '1300.01', name: 'Persediaan Material', accountType: 'PERSEDIAAN', balance: 850000000 },
      { accountNo: '2100.01', name: 'Hutang Pemasok', accountType: 'HUTANG', balance: 2150000000 },
      { accountNo: '3100.01', name: 'Modal Disetor', accountType: 'EKUITAS', balance: 5000000000 },
      { accountNo: '4100.01', name: 'Pendapatan Konstruksi', accountType: 'PENDAPATAN', balance: 8500000000 },
      { accountNo: '5100.01', name: 'Beban Material', accountType: 'HARGA_POKOK_PENJUALAN', balance: 3200000000 },
      { accountNo: '5100.02', name: 'Beban Subkon', accountType: 'HARGA_POKOK_PENJUALAN', balance: 1100000000 },
      { accountNo: '6100.01', name: 'Beban Gaji & Upah', accountType: 'BEBAN', balance: 450000000 },
    ],
  });

  // ─── Vendors ─────────────────────────────────────────────
  console.log('Creating vendors...');
  await prisma.vendor.createMany({
    data: [
      { code: 'VND-001', name: 'PT. Baja Nusantara', contact: 'Pak Rahmat', phone: '0821-1234-5678', email: 'sales@bajanusantara.co.id' },
      { code: 'VND-002', name: 'CV. Teknik Andalan', contact: 'Bu Sri', phone: '0812-9876-5432' },
      { code: 'VND-003', name: 'PT. Logam Prima', contact: 'Pak Joko', phone: '0878-1111-2222' },
    ],
  });

  // ─── S-Curve & BOQ Data ────────────────────────────────
  console.log('Creating BOQ & S-Curve Data...');
  const prj1 = await prisma.project.findFirst({ where: { code: 'PRJ-001' } });
  const pjo = await prisma.user.findFirst({ where: { role: 'PJO' } });
  const logistik = await prisma.user.findFirst({ where: { role: 'LOGISTIK' } });
  const vendor1 = await prisma.vendor.findFirst({ where: { code: 'VND-001' } });

  if (prj1 && pjo && logistik && vendor1) {
    const boq1 = await prisma.bOQItem.create({ data: { projectId: prj1.id, code: '1.1', description: 'Pekerjaan Tanah', unit: 'm3', quantity: 1500, unitPrice: 50000, weight: 15, category: 'CIVIL' } });
    const boq2 = await prisma.bOQItem.create({ data: { projectId: prj1.id, code: '1.2', description: 'Struktur Baja', unit: 'ton', quantity: 200, unitPrice: 25000000, weight: 45, category: 'MECHANICAL' } });
    const boq3 = await prisma.bOQItem.create({ data: { projectId: prj1.id, code: '1.3', description: 'Instalasi Pipa', unit: 'm', quantity: 5000, unitPrice: 150000, weight: 40, category: 'PIPING' } });

    await prisma.sCurveBaseline.createMany({
      data: [
        { projectId: prj1.id, week: 1, planned: 5, date: new Date('2024-01-22') },
        { projectId: prj1.id, week: 2, planned: 12, date: new Date('2024-01-29') },
        { projectId: prj1.id, week: 3, planned: 25, date: new Date('2024-02-05') },
        { projectId: prj1.id, week: 4, planned: 40, date: new Date('2024-02-12') },
        { projectId: prj1.id, week: 5, planned: 60, date: new Date('2024-02-19') },
      ]
    });

    await prisma.progressItem.createMany({
      data: [
        { projectId: prj1.id, boqItemId: boq1.id, progressPct: 100, reportDate: new Date('2024-01-22'), inputBy: pjo.id },
        { projectId: prj1.id, boqItemId: boq2.id, progressPct: 20, reportDate: new Date('2024-01-29'), inputBy: pjo.id },
        { projectId: prj1.id, boqItemId: boq2.id, progressPct: 50, reportDate: new Date('2024-02-05'), inputBy: pjo.id },
        { projectId: prj1.id, boqItemId: boq3.id, progressPct: 10, reportDate: new Date('2024-02-12'), inputBy: pjo.id },
      ]
    });

    // ─── LOGISTICS & ANTI-MARKUP DATA ────────────────────────────────
    console.log('Creating Logistics Data...');
    
    // Price Reference Master
    await prisma.priceReference.createMany({
      data: [
        { itemCode: 'MAT-001', description: 'Semen Portland 50kg', unit: 'Sak', refPrice: 65000 },
        { itemCode: 'MAT-002', description: 'Besi Beton Ulir D16', unit: 'Btg', refPrice: 145000 },
        { itemCode: 'MAT-003', description: 'Pasir Cor', unit: 'm3', refPrice: 285000 },
        { itemCode: 'MAT-004', description: 'Solar Industri', unit: 'Liter', refPrice: 16500 },
      ]
    });

    // Material Request
    const mr = await prisma.materialRequest.create({
      data: {
        mrNumber: 'MR-2024-001',
        projectId: prj1.id,
        requestedBy: pjo.id,
        status: 'PO_CREATED',
        priority: 'HIGH',
        notes: 'Segera butuh untuk pengecoran pilar utama'
      }
    });

    await prisma.mRItem.createMany({
      data: [
        { mrId: mr.id, description: 'Semen Portland 50kg', unit: 'Sak', quantity: 100 },
        { mrId: mr.id, description: 'Besi Beton Ulir D16', unit: 'Btg', quantity: 500 },
      ]
    });

    // Purchase Order
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-2024-001',
        projectId: prj1.id,
        vendorId: vendor1.id,
        mrId: mr.id,
        status: 'SENT',
        totalAmount: 79000000,
        notes: 'Kirim ke Site Tabalong'
      }
    });

    await prisma.pOItem.createMany({
      data: [
        { poId: po.id, description: 'Semen Portland 50kg', unit: 'Sak', quantity: 100, unitPrice: 65000, totalPrice: 6500000 },
        { poId: po.id, description: 'Besi Beton Ulir D16', unit: 'Btg', quantity: 500, unitPrice: 145000, totalPrice: 72500000 },
      ]
    });

    // Site Purchase (Anti-Markup Example)
    // 1. Normal purchase (No markup)
    await prisma.sitePurchase.create({
      data: {
        projectId: prj1.id,
        purchaseDate: new Date('2024-02-15'),
        description: 'Solar Industri (Darurat Genset)',
        vendor: 'Toko Maju Tabalong',
        unit: 'Liter',
        quantity: 100,
        unitPrice: 17000, // Slightly higher than 16500, but < 10%
        totalAmount: 1700000,
        refPrice: 16500,
        priceFlag: false,
        status: 'APPROVED',
      }
    });

    // 2. Markup purchase (Flagged!)
    const flaggedSp = await prisma.sitePurchase.create({
      data: {
        projectId: prj1.id,
        purchaseDate: new Date('2024-02-16'),
        description: 'Semen Portland 50kg (Tambahan mendadak)',
        vendor: 'Toko Material XYZ',
        unit: 'Sak',
        quantity: 20,
        unitPrice: 85000, // Ref is 65000, so this is +30.7% markup
        totalAmount: 1700000,
        refPrice: 65000,
        priceFlag: true,
        flagPct: 30.76,
        status: 'PENDING',
        notes: 'Harga di toko ini jauh lebih mahal'
      }
    });

    await prisma.purchaseFlag.create({
      data: {
        sitePurchaseId: flaggedSp.id,
        flaggedBy: logistik.id, // System flagged it, or logistik flagged it
        reason: 'Sistem Deteksi Otomatis: Harga pembelian melebihi ambang batas wajar (+10%). Harga referensi: Rp 65.000',
      }
    });

    // ─── HR & PAYROLL DATA ───────────────────────────────────────────
    console.log('Seeding HR & Payroll...');
    const userHRD = await prisma.user.findFirst({ where: { role: 'HRD' } });
    const proj1 = prj1;
    const userPJO = pjo;

    const emp1 = await prisma.employee.create({
      data: {
        employeeNo: 'EMP-001',
        name: 'Agus Tukang',
        nik: '3201010101010001',
        position: 'Tukang Besi',
        department: 'Proyek',
        employeeType: 'HARIAN',
        baseSalary: 150000,
        joinDate: new Date('2023-01-10'),
        projects: {
          create: {
            projectId: proj1.id,
            startDate: new Date('2024-01-01'),
            role: 'Tukang Besi Utama'
          }
        }
      }
    });

    const emp2 = await prisma.employee.create({
      data: {
        employeeNo: 'EMP-002',
        name: 'Budi Mandor',
        nik: '3201010101010002',
        position: 'Mandor',
        department: 'Proyek',
        employeeType: 'STAFF',
        baseSalary: 6000000,
        joinDate: new Date('2022-05-15'),
        projects: {
          create: {
            projectId: proj1.id,
            startDate: new Date('2024-01-01'),
            role: 'Mandor Proyek'
          }
        }
      }
    });

    // Attendance for Emp1
    await prisma.attendance.create({
      data: {
        employeeId: emp1.id,
        date: new Date(),
        status: 'HADIR',
        overtime: 2,
        enteredBy: userPJO.id,
        notes: 'Lembur cor'
      }
    });

    // Draft Payroll
    const payroll = await prisma.payroll.create({
      data: {
        projectId: proj1.id,
        period: '2024-02',
        periodStart: new Date('2024-02-01'),
        periodEnd: new Date('2024-02-28'),
        totalAmount: 6150000,
        status: 'HRD_APPROVED',
        items: {
          create: [
            {
              employeeId: emp1.id,
              workDays: 20,
              overtime: 10,
              baseSalary: 150000,
              overtimePay: 200000,
              allowances: 0,
              deductions: 0,
              bpjsPay: 0,
              netSalary: (20 * 150000) + 200000
            },
            {
              employeeId: emp2.id,
              workDays: 24,
              overtime: 0,
              baseSalary: 6000000,
              overtimePay: 0,
              allowances: 500000,
              deductions: 0,
              bpjsPay: 100000,
              netSalary: 6000000 + 500000 - 100000
            }
          ]
        },
        approvals: {
          create: [
            {
              approvedBy: userHRD.id,
              role: 'HRD',
              action: 'APPROVED',
              notes: 'Absensi sesuai rekap.'
            }
          ]
        }
      }
    });

    console.log('✅ HR & Payroll seeded.');
  }

  console.log('\n✅ Seed selesai!');
  console.log('\n📋 Akun Demo:');
  console.log('  Top Management: admin@prohaba.co.id     / admin123');
  console.log('  HRD:            hrd@prohaba.co.id       / hrd123');
  console.log('  PJO:            pjo@prohaba.co.id       / pjo123');
  console.log('  Finance:        finance@prohaba.co.id   / finance123');
  console.log('  Logistik:       logistik@prohaba.co.id  / logistik123');
  console.log('  Engineering:    engineering@prohaba.co.id / engineering123');
  console.log('  Workshop:       workshop@prohaba.co.id  / workshop123');
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
