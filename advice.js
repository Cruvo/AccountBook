'use strict';

// ============================================================
// Financial Advice Engine
// ============================================================

const AdviceEngine = {

    NEEDS_KW: ['food', 'dining', 'transport', 'utilities', 'health', 'rent', 'grocery', 'insurance', 'medical', 'electric', 'water', 'internet'],
    WANTS_KW: ['entertainment', 'games', 'shopping', 'movies', 'subscription', 'clothing', 'electronics', 'coffee', 'eating'],
    SAVINGS_KW: ['savings', 'investment', 'fixed deposit', 'emergency', 'pension', 'mutual fund', 'deposit'],

    classify(catName) {
        const l = catName.toLowerCase();
        if (this.SAVINGS_KW.some(k => l.includes(k))) return 'savings';
        if (this.NEEDS_KW.some(k => l.includes(k))) return 'needs';
        if (this.WANTS_KW.some(k => l.includes(k))) return 'wants';
        return 'other';
    },

    getAdvice(year, month) {
        const report = Reports.getMonthlyReport(year, month);
        const trend = Reports.getMonthlyTrend(6);
        const settings = DB.getSettings();
        const cur = settings.currency || '₹';
        const { totalIncome, totalExpense, netBalance, categorySummary } = report;
        const advice = [];

        if (totalIncome === 0 && totalExpense === 0) {
            return [{ type: 'info', icon: '📝', title: 'No Data Yet', body: 'Add some journal entries this month to get personalised financial advice.' }];
        }

        // ── 1. 50/30/20 Analysis ─────────────────────────────
        let needs = 0, wants = 0;
        const savedAmt = totalIncome - totalExpense;
        const savingsPct = totalIncome > 0 ? (savedAmt / totalIncome) * 100 : 0;

        categorySummary.forEach(cs => {
            if (cs.type !== 'expense') return;
            const cls = this.classify(cs.cat.name);
            if (cls === 'needs') needs += cs.total;
            else if (cls === 'wants') wants += cs.total;
        });

        const needsPct = totalIncome > 0 ? (needs / totalIncome) * 100 : 0;
        const wantsPct = totalIncome > 0 ? (wants / totalIncome) * 100 : 0;

        advice.push({
            type: 'rule',
            icon: '⚖️',
            title: '50/30/20 Budget Rule',
            breakdown: [
                { label: 'Needs', value: needsPct, target: 50, ideal: '≤ 50%', color: '#10b981' },
                { label: 'Wants', value: wantsPct, target: 30, ideal: '≤ 30%', color: '#f59e0b' },
                { label: 'Savings', value: savingsPct, target: 20, ideal: '≥ 20%', color: '#6366f1' },
            ]
        });

        if (needsPct > 60)
            advice.push({
                type: 'warning', icon: '⚠️', title: 'High Essential Spending',
                body: `Essentials are ${needsPct.toFixed(1)}% of income. Try negotiating bills — utilities, internet, and insurance are often negotiable and can free up significant cash.`
            });

        if (wantsPct > 35)
            advice.push({
                type: 'warning', icon: '🛍️', title: 'Discretionary Spending Alert',
                body: `You're spending ${wantsPct.toFixed(1)}% on wants. Apply the 24-hour rule: wait a day before any non-essential purchase to cut impulse buys.`
            });

        if (savingsPct >= 20)
            advice.push({
                type: 'success', icon: '🏆', title: 'Savings Goal Achieved! 🎉',
                body: `You saved ${savingsPct.toFixed(1)}% of income — outstanding! Consider routing surplus into an index fund or SIP for long-term wealth building.`
            });
        else if (savingsPct >= 10)
            advice.push({
                type: 'info', icon: '💡', title: 'Almost There on Savings',
                body: `Saving ${savingsPct.toFixed(1)}% — you're halfway to the 20% goal. You need ${cur}${Math.max(0, (totalIncome * 0.2) - savedAmt).toFixed(0)} more. Review your "wants" for potential cuts.`
            });
        else if (savingsPct < 0)
            advice.push({
                type: 'danger', icon: '🔴', title: 'Spending More Than You Earn',
                body: `You overspent by ${cur}${Math.abs(netBalance).toFixed(2)}. Review entries now and cut non‑essentials immediately. Build a 3–6 month emergency fund as a safety buffer.`
            });
        else
            advice.push({
                type: 'danger', icon: '🔴', title: 'Low Savings Rate',
                body: `Only ${savingsPct.toFixed(1)}% saved. Automate savings — transfer to a dedicated account on payday before you have a chance to spend it.`
            });

        // ── 2. Biggest expense category ──────────────────────
        const expCats = categorySummary.filter(c => c.type === 'expense');
        if (expCats.length > 0) {
            const top = expCats[0];
            const topPct = totalIncome > 0 ? ((top.total / totalIncome) * 100).toFixed(1) : '—';
            advice.push({
                type: 'info', icon: top.cat.emoji || '📊', title: `Biggest Expense: ${top.cat.name}`,
                body: `${top.cat.name} accounts for ${cur}${top.total.toFixed(2)} (${topPct}% of income). Review individual items to find reduction opportunities.`
            });
        }

        // ── 3. Budget overspend alerts ────────────────────────
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        DB.getBudgetsByMonth(monthStr).forEach(b => {
            const cat = DB.getCategoryById(b.categoryId);
            const cs = categorySummary.find(c => c.cat.id === b.categoryId);
            const spent = cs ? cs.total : 0;
            if (spent > b.limit)
                advice.push({
                    type: 'danger', icon: '🚨', title: `Budget Exceeded: ${cat?.name ?? 'Category'}`,
                    body: `Spent ${cur}${spent.toFixed(2)} vs. budget ${cur}${b.limit.toFixed(2)} — ${((spent / b.limit - 1) * 100).toFixed(0)}% over. Cut back immediately!`
                });
            else if (spent > b.limit * 0.8)
                advice.push({
                    type: 'warning', icon: '⚡', title: `Budget Warning: ${cat?.name ?? 'Category'}`,
                    body: `${((spent / b.limit) * 100).toFixed(0)}% of ${cat?.name ?? ''} budget used. Only ${cur}${(b.limit - spent).toFixed(2)} left — proceed carefully.`
                });
        });

        // ── 4. Month‑over‑month trend ─────────────────────────
        if (trend.length >= 2) {
            const curr = trend[trend.length - 1];
            const prev = trend[trend.length - 2];
            if (prev.expense > 0) {
                const pct = (((curr.expense - prev.expense) / prev.expense) * 100).toFixed(1);
                if (curr.expense > prev.expense)
                    advice.push({
                        type: 'warning', icon: '📈', title: 'Spending Trend Up',
                        body: `Expenses rose ${pct}% vs. last month. If unintentional, scan recent entries for unexpected or recurring charges.`
                    });
                else
                    advice.push({
                        type: 'success', icon: '📉', title: 'Spending Trend Down',
                        body: `Spending dropped ${Math.abs(pct)}% from last month. Redirect the difference into savings!`
                    });
            }
        }

        // ── 5. Recurring tip ─────────────────────────────────
        const tips = [
            { icon: '🎯', title: 'Set Monthly Budgets', body: 'Use the Budgets section to cap spending per category. Early warnings help you avoid surprises.' },
            { icon: '📆', title: 'Track Daily', body: 'Two minutes of daily logging gives you complete clarity — gaps in tracking hide overspending.' },
            { icon: '🔁', title: 'Review at Month‑End', body: 'Use the Monthly Report to adjust category budgets based on actual spending patterns.' },
            { icon: '🛒', title: 'Plan Before You Shop', body: 'A shopping list cuts impulse buys — the #1 budget killer.' },
            { icon: '📊', title: 'Annual Review', body: 'Use the Yearly Report to identify seasonal spending spikes and plan ahead.' },
        ];
        advice.push({ type: 'tip', ...tips[month % tips.length] });

        return advice;
    }
};
