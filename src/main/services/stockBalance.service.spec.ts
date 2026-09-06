import { describe, it, expect, beforeEach } from 'vitest';
import { StockBalanceService } from './stockBalance.service';

describe('StockBalanceService.computeDelta', () => {
  let service: StockBalanceService;

  beforeEach(() => {
    // We only need computeDelta which is a pure function — no DB needed
    service = new StockBalanceService(null as any);
  });

  // ═══════════════════════════════════════════════════
  // INFLOWS — items arrive at store → available increases
  // ═══════════════════════════════════════════════════

  describe('Inflows (available increases)', () => {
    it('OPENING_BALANCE: available += qtyIn - qtyOut', () => {
      const d = service.computeDelta('OPENING_BALANCE', 100, 0);
      expect(d.availableDelta).toBe(100);
    });

    it('PURCHASE_RECEIPT: available += qtyIn', () => {
      const d = service.computeDelta('PURCHASE_RECEIPT', 50, 0);
      expect(d.availableDelta).toBe(50);
    });

    it('TRANSFER_IN: available += qtyIn', () => {
      const d = service.computeDelta('TRANSFER_IN', 25, 0);
      expect(d.availableDelta).toBe(25);
    });

    it('RETURN_IN: available += qtyIn', () => {
      const d = service.computeDelta('RETURN_IN', 10, 0);
      expect(d.availableDelta).toBe(10);
    });

    it('CARRY_FORWARD: available += qtyIn', () => {
      const d = service.computeDelta('CARRY_FORWARD', 200, 0);
      expect(d.availableDelta).toBe(200);
    });

    it('ADJUSTMENT_PLUS: available += qtyIn', () => {
      const d = service.computeDelta('ADJUSTMENT_PLUS', 5, 0);
      expect(d.availableDelta).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════
  // OUTFLOWS — items leave store → available decreases
  // ═══════════════════════════════════════════════════

  describe('Outflows (available decreases)', () => {
    it('ISSUE_OUT: available decreases by qtyOut', () => {
      const d = service.computeDelta('ISSUE_OUT', 0, 30);
      expect(d.availableDelta).toBe(-30);
    });

    it('TRANSFER_OUT: available decreases by qtyOut', () => {
      const d = service.computeDelta('TRANSFER_OUT', 0, 20);
      expect(d.availableDelta).toBe(-20);
    });

    it('RETURN_OUT: available decreases by qtyOut', () => {
      const d = service.computeDelta('RETURN_OUT', 0, 10);
      expect(d.availableDelta).toBe(-10);
    });

    it('VENDOR_RETURN: available decreases by qtyOut', () => {
      const d = service.computeDelta('VENDOR_RETURN', 0, 15);
      expect(d.availableDelta).toBe(-15);
    });

    it('ADJUSTMENT_MINUS: available decreases by qtyOut', () => {
      const d = service.computeDelta('ADJUSTMENT_MINUS', 0, 5);
      expect(d.availableDelta).toBe(-5);
    });
  });

  // ═══════════════════════════════════════════════════
  // STATE CHANGES — stock moves between categories
  // ═══════════════════════════════════════════════════

  describe('State changes', () => {
    it('INSTALL_OUT: available → installed', () => {
      const d = service.computeDelta('INSTALL_OUT', 0, 10);
      expect(d.availableDelta).toBe(-10);
      expect(d.installedDelta).toBe(10);
    });

    it('UNINSTALL_OUT: installed decreases', () => {
      const d = service.computeDelta('UNINSTALL_OUT', 0, 5);
      expect(d.installedDelta).toBe(-5);
    });

    it('DAMAGE_OUT: available → damaged', () => {
      const d = service.computeDelta('DAMAGE_OUT', 0, 8);
      expect(d.availableDelta).toBe(-8);
      expect(d.damagedDelta).toBe(8);
    });

    it('REPAIR_OUT: available → repair', () => {
      const d = service.computeDelta('REPAIR_OUT', 0, 3);
      expect(d.availableDelta).toBe(-3);
      expect(d.repairDelta).toBe(3);
    });

    it('REPAIR_IN: repair → available', () => {
      const d = service.computeDelta('REPAIR_IN', 3, 3);
      expect(d.availableDelta).toBe(3);
      expect(d.repairDelta).toBe(-3);
    });

    it('SCRAP_OUT: available → scrap', () => {
      const d = service.computeDelta('SCRAP_OUT', 0, 5);
      expect(d.availableDelta).toBe(-5);
      expect(d.scrapDelta).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════
  // CONSUMPTION — THE KEY FIX
  // ═══════════════════════════════════════════════════

  describe('Consumption (THE KEY FIX)', () => {
    it('CONSUMPTION_OUT: available decreases by qtyOut', () => {
      const d = service.computeDelta('CONSUMPTION_OUT', 0, 5);
      expect(d.availableDelta).toBe(-5);
      expect(d.installedDelta).toBe(0);
      expect(d.damagedDelta).toBe(0);
      expect(d.repairDelta).toBe(0);
      expect(d.scrapDelta).toBe(0);
    });

    it('CONSUMPTION_REVERSAL: available increases by qtyIn', () => {
      const d = service.computeDelta('CONSUMPTION_REVERSAL', 5, 0);
      expect(d.availableDelta).toBe(5);
      expect(d.installedDelta).toBe(0);
      expect(d.damagedDelta).toBe(0);
      expect(d.repairDelta).toBe(0);
      expect(d.scrapDelta).toBe(0);
    });

    it('CONSUMPTION_OUT then CONSUMPTION_REVERSAL: net zero', () => {
      const out = service.computeDelta('CONSUMPTION_OUT', 0, 10);
      const rev = service.computeDelta('CONSUMPTION_REVERSAL', 10, 0);
      expect(out.availableDelta + rev.availableDelta).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // REPLACEMENT
  // ═══════════════════════════════════════════════════

  describe('Replacement', () => {
    it('REPLACEMENT_OUT: available decreases', () => {
      const d = service.computeDelta('REPLACEMENT_OUT', 0, 1);
      expect(d.availableDelta).toBe(-1);
    });

    it('REPLACEMENT_IN: available increases', () => {
      const d = service.computeDelta('REPLACEMENT_IN', 1, 0);
      expect(d.availableDelta).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════
  // REVERSAL
  // ═══════════════════════════════════════════════════

  describe('Reversal', () => {
    it('REVERSAL (inflow): available increases', () => {
      const d = service.computeDelta('REVERSAL', 10, 0);
      expect(d.availableDelta).toBe(10);
    });

    it('REVERSAL (outflow): available decreases', () => {
      const d = service.computeDelta('REVERSAL', 0, 5);
      expect(d.availableDelta).toBe(-5);
    });
  });

  // ═══════════════════════════════════════════════════
  // SHIFT (location-dependent)
  // ═══════════════════════════════════════════════════

  describe('Shift', () => {
    it('SHIFT_IN with locationId: installed increases', () => {
      const d = service.computeDelta('SHIFT_IN', 5, 0, 42);
      expect(d.installedDelta).toBe(5);
      expect(d.availableDelta).toBe(0);
    });

    it('SHIFT_IN without locationId: available increases', () => {
      const d = service.computeDelta('SHIFT_IN', 5, 0, null);
      expect(d.availableDelta).toBe(5);
      expect(d.installedDelta).toBe(0);
    });

    it('SHIFT_OUT with locationId: installed decreases', () => {
      const d = service.computeDelta('SHIFT_OUT', 0, 5, 42);
      expect(d.installedDelta).toBe(-5);
    });

    it('SHIFT_OUT without locationId: available decreases', () => {
      const d = service.computeDelta('SHIFT_OUT', 0, 5, null);
      expect(d.availableDelta).toBe(-5);
    });
  });

  // ═══════════════════════════════════════════════════
  // UNKNOWN movement type — should produce zero deltas
  // ═══════════════════════════════════════════════════

  describe('Unknown movement type', () => {
    it('produces zero deltas', () => {
      const d = service.computeDelta('UNKNOWN_TYPE', 10, 5);
      expect(d.availableDelta).toBe(0);
      expect(d.installedDelta).toBe(0);
      expect(d.damagedDelta).toBe(0);
      expect(d.repairDelta).toBe(0);
      expect(d.scrapDelta).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// STOCK FORMULA INTEGRATION TEST
// ═══════════════════════════════════════════════════════════════

describe('Stock formula: Received - Consumed = Available (after fix)', () => {
  let service: StockBalanceService;

  beforeEach(() => {
    service = new StockBalanceService(null as any);
  });

  it('Full lifecycle: Opening → Receipt → Consumption → Available correct', () => {
    // Simulate a full stock lifecycle for an item at a store
    const deltas = [
      service.computeDelta('OPENING_BALANCE', 25, 0),    // +25 available
      service.computeDelta('PURCHASE_RECEIPT', 10, 0),   // +10 available
      service.computeDelta('CONSUMPTION_OUT', 0, 5),     // -5 available (FIXED)
    ];

    let available = 0;
    for (const d of deltas) {
      available += d.availableDelta;
    }

    // Expected: 25 + 10 - 5 = 30
    expect(available).toBe(30);
  });

  it('Consumption reversal restores available', () => {
    const deltas = [
      service.computeDelta('OPENING_BALANCE', 25, 0),
      service.computeDelta('CONSUMPTION_OUT', 0, 5),
      service.computeDelta('CONSUMPTION_REVERSAL', 5, 0),  // Cancel consumption
    ];

    let available = 0;
    for (const d of deltas) {
      available += d.availableDelta;
    }

    // Expected: 25 - 5 + 5 = 25 (back to original)
    expect(available).toBe(25);
  });

  it('Mixed movements: all categories correct', () => {
    const deltas = [
      service.computeDelta('OPENING_BALANCE', 100, 0),    // +100
      service.computeDelta('PURCHASE_RECEIPT', 50, 0),    // +50
      service.computeDelta('TRANSFER_IN', 25, 0),         // +25
      service.computeDelta('ISSUE_OUT', 0, 30),           // -30
      service.computeDelta('TRANSFER_OUT', 0, 20),        // -20
      service.computeDelta('INSTALL_OUT', 0, 10),         // -10 available, +10 installed
      service.computeDelta('DAMAGE_OUT', 0, 5),           // -5 available, +5 damaged
      service.computeDelta('CONSUMPTION_OUT', 0, 8),      // -8 available (FIXED)
      service.computeDelta('SCRAP_OUT', 0, 2),            // -2 available, +2 scrap
    ];

    let available = 0, installed = 0, damaged = 0, scrap = 0;
    for (const d of deltas) {
      available += d.availableDelta;
      installed += d.installedDelta;
      damaged += d.damagedDelta;
      scrap += d.scrapDelta;
    }

    // Available: 100 + 50 + 25 - 30 - 20 - 10 - 5 - 8 - 2 = 100
    expect(available).toBe(100);
    expect(installed).toBe(10);
    expect(damaged).toBe(5);
    expect(scrap).toBe(2);
  });
});
