import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoices = await prisma.salesInvoice.findMany({
      include: {
        project: true,
        journalVoucher: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching sales invoices:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data tagihan' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    const { projectId, description, subTotal, taxRate, date, dueDate, category, downPaymentId } = data;

    // Hitung total
    const parsedSubTotal = parseFloat(subTotal) || 0;
    const parsedTaxRate = parseFloat(taxRate) || 0;
    
    // Potong DP jika ada
    let finalSubTotal = parsedSubTotal;
    let deductedInvoice = null;
    if (downPaymentId) {
      deductedInvoice = await prisma.salesInvoice.findUnique({ where: { id: downPaymentId } });
      if (deductedInvoice) {
        finalSubTotal = finalSubTotal - deductedInvoice.subTotal;
      }
    }

    const taxAmount = (finalSubTotal * parsedTaxRate) / 100;
    const totalAmount = finalSubTotal + taxAmount;

    // Generate Invoice No
    const count = await prisma.salesInvoice.count();
    const invoiceNo = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

    // Buat tagihan dalam transaksi (juga bikin Jurnal otomatis)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat Jurnal
      const jvNo = `JV-REV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
      
      const glPiutang = await tx.gLAccount.findFirst({ where: { accountType: 'PIUTANG' } });
      const glPendapatan = await tx.gLAccount.findFirst({ where: { accountType: 'PENDAPATAN' } });
      const glPPN = await tx.gLAccount.findFirst({ where: { accountType: 'HUTANG', name: { contains: 'PPN' } } }) || await tx.gLAccount.findFirst({ where: { accountType: 'HUTANG' } });

      const jv = await tx.journalVoucher.create({
        data: {
          journalNo: jvNo,
          date: new Date(date),
          description: `Jurnal Otomatis - Penjualan ${invoiceNo}`,
          totalAmount: totalAmount,
          items: {
            create: [
              // Debit: Piutang
              { glAccountId: glPiutang?.id || (await tx.gLAccount.findFirst()).id, description: invoiceNo, debit: totalAmount, credit: 0 },
              // Kredit: Pendapatan
              { glAccountId: glPendapatan?.id || (await tx.gLAccount.findFirst()).id, description: invoiceNo, debit: 0, credit: finalSubTotal },
              // Kredit: PPN Keluaran
              { glAccountId: glPPN?.id || (await tx.gLAccount.findFirst()).id, description: invoiceNo, debit: 0, credit: taxAmount },
            ]
          }
        }
      });

      // 2. Buat Sales Invoice
      const invoice = await tx.salesInvoice.create({
        data: {
          invoiceNo,
          projectId,
          description,
          subTotal: finalSubTotal,
          taxRate: parsedTaxRate,
          taxAmount,
          totalAmount,
          date: new Date(date),
          dueDate: dueDate ? new Date(dueDate) : null,
          category,
          downPaymentId: downPaymentId || null,
          journalVoucherId: jv.id,
        },
      });

      return invoice;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating sales invoice:', error);
    return NextResponse.json(
      { error: 'Gagal membuat tagihan', details: error.message },
      { status: 500 }
    );
  }
}
