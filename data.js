'use strict';

// ============================================================
// Data Layer – localStorage CRUD
// ============================================================

const DB = {
    KEYS: {
        categories: 'ab_categories',
        items: 'ab_items',
        entries: 'ab_entries',
        budgets: 'ab_budgets',
        settings: 'ab_settings'
    },

    SEED_CATEGORIES: [
        { id: 'c1', name: 'Salary', type: 'income', emoji: '💼', color: '#10b981' },
        { id: 'c2', name: 'Freelance', type: 'income', emoji: '💻', color: '#3b82f6' },
        { id: 'c3', name: 'Investments', type: 'income', emoji: '📈', color: '#6366f1' },
        { id: 'c4', name: 'Food & Dining', type: 'expense', emoji: '🍽️', color: '#f59e0b' },
        { id: 'c5', name: 'Transport', type: 'expense', emoji: '🚗', color: '#ef4444' },
        { id: 'c6', name: 'Utilities', type: 'expense', emoji: '💡', color: '#8b5cf6' },
        { id: 'c7', name: 'Entertainment', type: 'expense', emoji: '🎬', color: '#ec4899' },
        { id: 'c8', name: 'Health', type: 'expense', emoji: '🏥', color: '#14b8a6' },
        { id: 'c9', name: 'Shopping', type: 'expense', emoji: '🛍️', color: '#f97316' },
        { id: 'c10', name: 'Savings', type: 'income', emoji: '🏦', color: '#22c55e' },
    ],

    SEED_ITEMS: [
        { id: 'i1', categoryId: 'c1', name: 'Monthly Salary' },
        { id: 'i2', categoryId: 'c2', name: 'Web Design Project' },
        { id: 'i3', categoryId: 'c2', name: 'Consulting' },
        { id: 'i4', categoryId: 'c3', name: 'Stock Dividends' },
        { id: 'i5', categoryId: 'c4', name: 'Groceries' },
        { id: 'i6', categoryId: 'c4', name: 'Restaurant' },
        { id: 'i7', categoryId: 'c4', name: 'Coffee' },
        { id: 'i8', categoryId: 'c5', name: 'Fuel' },
        { id: 'i9', categoryId: 'c5', name: 'Public Transit' },
        { id: 'i10', categoryId: 'c6', name: 'Electricity' },
        { id: 'i11', categoryId: 'c6', name: 'Internet' },
        { id: 'i12', categoryId: 'c6', name: 'Water' },
        { id: 'i13', categoryId: 'c7', name: 'Movies' },
        { id: 'i14', categoryId: 'c7', name: 'Streaming Subscriptions' },
        { id: 'i15', categoryId: 'c7', name: 'Games' },
        { id: 'i16', categoryId: 'c8', name: 'Doctor Visit' },
        { id: 'i17', categoryId: 'c8', name: 'Gym Membership' },
        { id: 'i18', categoryId: 'c9', name: 'Clothing' },
        { id: 'i19', categoryId: 'c9', name: 'Electronics' },
        { id: 'i20', categoryId: 'c10', name: 'Fixed Deposit' },
        { id: 'i21', categoryId: 'c10', name: 'Emergency Fund' },
        { id: 'i22', categoryId: 'c10', name: 'Pocket Money' },
        { id: 'i23', categoryId: 'c10', name: 'Catering' },
    ],

    _get(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    _set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

    init() {
        if (!localStorage.getItem(this.KEYS.categories)) {
            this._set(this.KEYS.categories, this.SEED_CATEGORIES);
            this._set(this.KEYS.items, this.SEED_ITEMS);
            this._set(this.KEYS.entries, []);
            this._set(this.KEYS.budgets, []);
        }
        if (!localStorage.getItem(this.KEYS.settings)) {
            this._set(this.KEYS.settings, { theme: 'dark', currency: '₹', savingsGoal: 20 });
        }
    },

    // ── Categories ───────────────────────────────────────────
    getCategories() { return this._get(this.KEYS.categories); },
    getCategoryById(id) { return this.getCategories().find(c => c.id === id) || null; },
    addCategory(data) {
        const cats = this.getCategories();
        const cat = { ...data, id: this.genId() };
        cats.push(cat);
        this._set(this.KEYS.categories, cats);
        return cat;
    },
    updateCategory(id, u) { this._set(this.KEYS.categories, this.getCategories().map(c => c.id === id ? { ...c, ...u } : c)); },
    deleteCategory(id) {
        this._set(this.KEYS.categories, this.getCategories().filter(c => c.id !== id));
        this.getItemsByCategory(id).forEach(i => this.deleteItem(i.id));
    },

    // ── Items ────────────────────────────────────────────────
    getItems() { return this._get(this.KEYS.items); },
    getItemById(id) { return this.getItems().find(i => i.id === id) || null; },
    getItemsByCategory(catId) { return this.getItems().filter(i => i.categoryId === catId); },
    addItem(data) {
        const items = this.getItems();
        const item = { ...data, id: this.genId() };
        items.push(item);
        this._set(this.KEYS.items, items);
        return item;
    },
    updateItem(id, u) { this._set(this.KEYS.items, this.getItems().map(i => i.id === id ? { ...i, ...u } : i)); },
    deleteItem(id) {
        this._set(this.KEYS.items, this.getItems().filter(i => i.id !== id));
        this._set(this.KEYS.entries, this.getEntries().filter(e => e.itemId !== id));
    },

    // ── Entries ──────────────────────────────────────────────
    getEntries() { return this._get(this.KEYS.entries); },
    getEntryById(id) { return this.getEntries().find(e => e.id === id) || null; },
    getEntriesByMonth(year, month) {
        return this.getEntries().filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
        });
    },
    getEntriesByYear(year) { return this.getEntries().filter(e => new Date(e.date).getFullYear() === year); },
    addEntry(data) {
        const entries = this.getEntries();
        const entry = { ...data, id: this.genId() };
        entries.push(entry);
        this._set(this.KEYS.entries, entries);
        return entry;
    },
    updateEntry(id, u) { this._set(this.KEYS.entries, this.getEntries().map(e => e.id === id ? { ...e, ...u } : e)); },
    deleteEntry(id) { this._set(this.KEYS.entries, this.getEntries().filter(e => e.id !== id)); },

    // ── Budgets ──────────────────────────────────────────────
    getBudgets() { return this._get(this.KEYS.budgets); },
    getBudgetsByMonth(m) { return this.getBudgets().filter(b => b.month === m); },
    getBudgetByCatMonth(catId, m) { return this.getBudgets().find(b => b.categoryId === catId && b.month === m) || null; },
    setBudget(catId, month, limit) {
        const budgets = this.getBudgets();
        const idx = budgets.findIndex(b => b.categoryId === catId && b.month === month);
        if (idx >= 0) budgets[idx].limit = limit;
        else budgets.push({ id: this.genId(), categoryId: catId, month, limit });
        this._set(this.KEYS.budgets, budgets);
    },
    deleteBudget(id) { this._set(this.KEYS.budgets, this.getBudgets().filter(b => b.id !== id)); },

    // ── Settings ─────────────────────────────────────────────
    getSettings() { try { return JSON.parse(localStorage.getItem(this.KEYS.settings)) || {}; } catch { return {}; } },
    saveSettings(updates) { this._set(this.KEYS.settings, { ...this.getSettings(), ...updates }); },

    // ── Backup / Restore ────────────────────────────────────
    exportAll() {
        return JSON.stringify({
            version: 1,
            categories: this.getCategories(),
            items: this.getItems(),
            entries: this.getEntries(),
            budgets: this.getBudgets(),
            settings: this.getSettings()
        }, null, 2);
    },
    importAll(json) {
        const d = JSON.parse(json);
        if (!d.version) throw new Error('Invalid backup');
        if (d.categories) this._set(this.KEYS.categories, d.categories);
        if (d.items) this._set(this.KEYS.items, d.items);
        if (d.entries) this._set(this.KEYS.entries, d.entries);
        if (d.budgets) this._set(this.KEYS.budgets, d.budgets);
        if (d.settings) this._set(this.KEYS.settings, d.settings);
    },
    clearAll() {
        Object.values(this.KEYS).forEach(k => localStorage.removeItem(k));
    }
};
