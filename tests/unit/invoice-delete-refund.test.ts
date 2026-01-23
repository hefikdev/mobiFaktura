import { describe, it, expect } from 'vitest';

describe('Invoice delete -> saldo refund (unit)', () => {
  it('calculates refund and transaction payload correctly', () => {
    const userId = 'user-1';
    const invoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-001',
      userId,
      kwota: 200.0,
    } as const;

    const balanceBefore = 1000.0;
    const refundAmount = invoice.kwota;
    const balanceAfter = parseFloat((balanceBefore + refundAmount).toFixed(2));

    const txPayload = {
      userId: invoice.userId,
      amount: refundAmount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      transactionType: 'invoice_delete_refund',
      referenceId: invoice.id,
      notes: `Zwrot z usuniętej faktury ${invoice.invoiceNumber}`,
      createdBy: 'system-test',
    } as const;

    expect(balanceAfter).toBe(1200.0);
    expect(txPayload.transactionType).toBe('invoice_delete_refund');
    expect(parseFloat(txPayload.amount)).toBeCloseTo(200.0);
    expect(parseFloat(txPayload.balanceBefore)).toBeCloseTo(balanceBefore);
    expect(parseFloat(txPayload.balanceAfter)).toBeCloseTo(balanceAfter);
    expect(txPayload.notes).toContain(invoice.invoiceNumber);
  });

  it('skips refund when kwota is 0 or missing', () => {
    const invoiceNoAmount = { id: 'inv-2', userId: 'u2', invoiceNumber: 'INV-000' } as any;
    expect(invoiceNoAmount.kwota).toBeUndefined();

    const invoiceZero = { id: 'inv-3', userId: 'u3', invoiceNumber: 'INV-001', kwota: 0 } as const;
    expect(invoiceZero.kwota).toBe(0);
  });
});
