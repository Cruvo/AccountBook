'use strict';

// ============================================================
// Reports – aggregation & CSV export
// ============================================================

const Reports = {

  // ── Monthly report ────────────────────────────────────────
  getMonthlyReport(year, month) {
    const entries    = DB.getEntriesByMonth(year, month);
    const categories = DB.getCategories();
    const items      = DB.getItems();

    let totalIncome = 0, totalExpense = 0;
    const byCategory = {};   // catId → { cat, type, total, items: {itemId → {item, total, entries[]}} }

    entries.forEach(e => {
      const item = items.find(i => i.id === e.itemId);
      if (!item) return;
      const cat = categories.find(c => c.id === item.categoryId);
      if (!cat) return;

      const amt = parseFloat(e.amount) || 0;
      if (e.type === 'income')  totalIncome  += amt;
      else                      totalExpense += amt;

      if (!byCategory[cat.id]) byCategory[cat.id] = { cat, type: cat.type, total: 0, items: {} };
      byCategory[cat.id].total += amt;

      if (!byCategory[cat.id].items[item.id]) byCategory[cat.id].items[item.id] = { item, total: 0, entries: [] };
      byCategory[cat.id].items[item.id].total += amt;
      byCategory[cat.id].items[item.id].entries.push(e);
    });

    // Convert item maps → sorted arrays
    Object.values(byCategory).forEach(c => {
      c.items = Object.values(c.items).sort((a, b) => b.total - a.total);
    });

    const categorySummary = Object.values(byCategory).sort((a, b) => b.total - a.total);
    return { year, month, totalIncome, totalExpense, netBalance: totalIncome - totalExpense, categorySummary, entries };
  },

  // ── Yearly report ─────────────────────────────────────────
  getYearlyReport(year) {
    let totalIncome = 0, totalExpense = 0;
    const months = Array.from({ length: 12 }, (_, i) => {
      const r = this.getMonthlyReport(year, i + 1);
      totalIncome  += r.totalIncome;
      totalExpense += r.totalExpense;
      return r;
    });
    return { year, months, totalIncome, totalExpense, netBalance: totalIncome - totalExpense };
  },

  // ── Last N months trend (for charts) ─────────────────────
  getMonthlyTrend(n = 6) {
    const result = [];
    const now    = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const r = this.getMonthlyReport(d.getFullYear(), d.getMonth() + 1);
      result.push({
        label:   d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        income:  r.totalIncome,
        expense: r.totalExpense,
        net:     r.netBalance
      });
    }
    return result;
  },

  // ── CSV helpers ───────────────────────────────────────────
  exportEntriesCSV(entries) {
    const categories = DB.getCategories();
    const items      = DB.getItems();
    const header = ['Date', 'Type', 'Category', 'Item', 'Amount', 'Note'];
    const rows = entries.map(e => {
      const item = items.find(i => i.id === e.itemId);
      const cat  = item ? categories.find(c => c.id === item.categoryId) : null;
      return [e.date, e.type, cat?.name ?? '', item?.name ?? '', e.amount, e.note || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    this._download([header.join(','), ...rows].join('\n'), `entries_${Date.now()}.csv`);
  },

  exportMonthlySummaryCSV(report) {
    const header = ['Category', 'Type', 'Item', 'Amount'];
    const rows = [];
    report.categorySummary.forEach(cs => {
      cs.items.forEach((it, idx) => {
        rows.push([idx === 0 ? cs.cat.name : '', idx === 0 ? cs.type : '', it.item.name, it.total.toFixed(2)]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      });
    });
    rows.push(['', '', 'Total Income',  report.totalIncome.toFixed(2)].join(','));
    rows.push(['', '', 'Total Expense', report.totalExpense.toFixed(2)].join(','));
    rows.push(['', '', 'Net Balance',   report.netBalance.toFixed(2)].join(','));
    const mn = new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' });
    this._download([header.join(','), ...rows].join('\n'), `report_${mn}_${report.year}.csv`);
  },

  _download(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};
