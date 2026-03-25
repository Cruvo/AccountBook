'use strict';

const App = {
  charts: {},
  entryPage: 1,
  entrySearch: '',
  entryFilterType: '',
  entryFilterCat: '',

  // ── Boot ────────────────────────────────────────────────
  init() {
    DB.init();
    this.applyTheme();
    document.querySelectorAll('.nav-item').forEach(el =>
      el.addEventListener('click', () => { this.navigate(el.dataset.page); this.closeSidebar(); })
    );
    document.getElementById('mob-toggle').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') this.hideModal();
    });
    this.navigate('dashboard');
  },

  // ── Helpers ──────────────────────────────────────────────
  applyTheme() {
    const { theme } = DB.getSettings();
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  },
  cur()       { return DB.getSettings().currency || '₹'; },
  fmt(n)      { return `${this.cur()}${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; },
  monthName(m){ return new Date(2000, m - 1).toLocaleString('default', { month: 'long' }); },
  today()     { return new Date().toISOString().slice(0, 10); },
  nowYM()     { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; },

  destroyCharts() {
    Object.values(this.charts).forEach(c => c?.destroy?.());
    this.charts = {};
  },

  navigate(page) {
    this.destroyCharts();
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page)
    );
    const titles = {
      dashboard: ['🏠 Dashboard', 'Your financial overview'],
      categories: ['🏷️ Categories', 'Manage income & expense categories'],
      items: ['📦 Items', 'Manage items within categories'],
      entries: ['📒 Journal', 'Record & browse transactions'],
      monthly: ['📅 Monthly Report', 'Analyse a specific month'],
      yearly: ['📊 Yearly Report', 'Full year breakdown'],
      advice: ['💡 Financial Advice', 'Personalised tips for your goals'],
      budgets: ['🎯 Budgets', 'Set monthly spending limits'],
      settings: ['⚙️ Settings', 'Preferences & data management'],
    };
    const [title, sub] = titles[page] || ['Account Book', ''];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-sub').textContent = sub;
    const map = {
      dashboard: () => this.renderDashboard(),
      categories: () => this.renderCategories(),
      items: () => this.renderItems(),
      entries: () => this.renderEntries(),
      monthly: () => this.renderMonthly(),
      yearly: () => this.renderYearly(),
      advice: () => this.renderAdvice(),
      budgets: () => this.renderBudgets(),
      settings: () => this.renderSettings(),
    };
    document.getElementById('main-content').innerHTML = '';
    (map[page] || map.dashboard)();
  },

  toggleSidebar()  { document.querySelector('.sidebar').classList.toggle('open'); },
  closeSidebar()   { document.querySelector('.sidebar').classList.remove('open'); },

  // ── Toast ────────────────────────────────────────────────
  toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  // ── Modal ────────────────────────────────────────────────
  showModal(title, html, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal-save').onclick = () => onSave();
  },
  hideModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  },

  // ── Confirm ──────────────────────────────────────────────
  confirm(msg) { return window.confirm(msg); },

  // ── DASHBOARD ────────────────────────────────────────────
  renderDashboard() {
    const { y, m } = this.nowYM();
    const r    = Reports.getMonthlyReport(y, m);
    const trend = Reports.getMonthlyTrend(6);
    const entries = DB.getEntries().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    const expCats = r.categorySummary.filter(c => c.type === 'expense');

    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card" style="--accent-clr:var(--income)">
          <div class="icon">💰</div>
          <div class="label">Income This Month</div>
          <div class="value" style="color:var(--income)">${this.fmt(r.totalIncome)}</div>
        </div>
        <div class="stat-card" style="--accent-clr:var(--expense)">
          <div class="icon">💸</div>
          <div class="label">Expenses This Month</div>
          <div class="value" style="color:var(--expense)">${this.fmt(r.totalExpense)}</div>
        </div>
        <div class="stat-card" style="--accent-clr:${r.netBalance>=0?'var(--income)':'var(--expense)'}">
          <div class="icon">${r.netBalance >= 0 ? '📈' : '📉'}</div>
          <div class="label">Net Balance</div>
          <div class="value" style="color:${r.netBalance>=0?'var(--income)':'var(--expense)'}">${this.fmt(r.netBalance)}</div>
        </div>
        <div class="stat-card" style="--accent-clr:var(--accent)">
          <div class="icon">📝</div>
          <div class="label">Total Entries</div>
          <div class="value">${DB.getEntries().length}</div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:24px">
        <div class="card">
          <div class="section-header"><span class="section-title">Monthly Trend</span></div>
          <div class="chart-container" style="height:220px"><canvas id="trendChart"></canvas></div>
        </div>
        <div class="card">
          <div class="section-header"><span class="section-title">Expenses by Category</span></div>
          <div class="chart-container" style="height:220px"><canvas id="pieChart"></canvas></div>
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <span class="section-title">Recent Transactions</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('entries')">View All →</button>
        </div>
        ${this.buildEntryTable(entries, true)}
      </div>`;

    // Trend chart
    this.charts.trend = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: trend.map(t => t.label),
        datasets: [
          { label: 'Income', data: trend.map(t => t.income), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', tension: .4, fill: true },
          { label: 'Expense', data: trend.map(t => t.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', tension: .4, fill: true },
        ]
      },
      options: this.lineOpts()
    });

    // Pie chart
    if (expCats.length > 0) {
      this.charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
          labels: expCats.map(c => c.cat.name),
          datasets: [{ data: expCats.map(c => c.total), backgroundColor: expCats.map(c => c.cat.color || '#6366f1'), borderWidth: 0 }]
        },
        options: { ...this.pieOpts(), cutout: '65%' }
      });
    } else {
      document.getElementById('pieChart').parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">🍩</div><p>No expenses this month</p></div>`;
    }
  },

  // ── CATEGORIES ───────────────────────────────────────────
  renderCategories() {
    const cats = DB.getCategories();
    const income  = cats.filter(c => c.type === 'income');
    const expense = cats.filter(c => c.type === 'expense');
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">All Categories</span>
        <button class="btn btn-primary" onclick="App.openCatModal()">＋ Add Category</button>
      </div>
      <h4 style="margin-bottom:12px;color:var(--income)">💰 Income Categories</h4>
      <div class="cat-grid" id="income-cats">${income.map(cat => this.catCard(cat)).join('') || '<p style="color:var(--text-muted)">None</p>'}</div>
      <h4 style="margin:22px 0 12px;color:var(--expense)">💸 Expense Categories</h4>
      <div class="cat-grid" id="expense-cats">${expense.map(cat => this.catCard(cat)).join('') || '<p style="color:var(--text-muted)">None</p>'}</div>`;
  },

  catCard(cat) {
    const items = DB.getItemsByCategory(cat.id).length;
    const bg = cat.color ? cat.color + '22' : 'rgba(99,102,241,.15)';
    return `<div class="cat-card">
      <div class="cat-card-top">
        <div class="cat-emoji" style="background:${bg}">${cat.emoji || '📁'}</div>
        <div class="cat-info">
          <div class="cat-name">${cat.name}</div>
          <div class="cat-meta">${items} item${items !== 1 ? 's' : ''} · <span class="badge badge-${cat.type}">${cat.type}</span></div>
        </div>
      </div>
      <div class="cat-actions">
        <button class="btn btn-ghost btn-sm" onclick="App.openCatModal('${cat.id}')">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="App.deleteCat('${cat.id}')">🗑️ Delete</button>
      </div>
    </div>`;
  },

  openCatModal(id = null) {
    const cat = id ? DB.getCategoryById(id) : {};
    const EMOJIS = ['💼','💻','📈','🏦','🍽️','🚗','💡','🎬','🏥','🛍️','🏠','✈️','🎓','💊','🐾','🌿','🎵','⚽'];
    this.showModal(id ? 'Edit Category' : 'New Category', `
      <div class="form-group">
        <label class="form-label">Category Name</label>
        <input class="form-control" id="cat-name" value="${cat.name || ''}" placeholder="e.g. Groceries">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <div class="type-toggle">
          <button class="type-btn ${(!id || cat.type==='income') ? 'active income' : ''}" onclick="App.setTypeBtn(this,'income')" data-val="income">💰 Income</button>
          <button class="type-btn ${(id && cat.type==='expense') ? 'active expense' : ''}" onclick="App.setTypeBtn(this,'expense')" data-val="expense">💸 Expense</button>
        </div>
        <input type="hidden" id="cat-type" value="${cat.type || 'income'}">
      </div>
      <div class="form-group">
        <label class="form-label">Emoji Icon</label>
        <input class="form-control" id="cat-emoji" value="${cat.emoji || ''}" placeholder="e.g. 🛒" maxlength="4">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${EMOJIS.map(e => `<span style="cursor:pointer;font-size:22px" onclick="document.getElementById('cat-emoji').value='${e}'">${e}</span>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input type="color" class="form-control" id="cat-color" value="${cat.color || '#6366f1'}" style="height:42px;padding:4px 8px;cursor:pointer">
      </div>`, () => {
        const name = document.getElementById('cat-name').value.trim();
        const type = document.getElementById('cat-type').value;
        const emoji = document.getElementById('cat-emoji').value.trim() || '📁';
        const color = document.getElementById('cat-color').value;
        if (!name) { this.toast('Name is required', 'error'); return; }
        if (id) DB.updateCategory(id, { name, type, emoji, color });
        else DB.addCategory({ name, type, emoji, color });
        this.hideModal();
        this.toast(id ? 'Category updated' : 'Category added');
        this.renderCategories();
      });
  },

  setTypeBtn(btn, val) {
    const parent = btn.closest('.type-toggle');
    parent.querySelectorAll('.type-btn').forEach(b => { b.classList.remove('active','income','expense'); });
    btn.classList.add('active', val);
    document.getElementById('cat-type').value = val;
  },

  deleteCat(id) {
    const items = DB.getItemsByCategory(id).length;
    if (!this.confirm(`Delete this category? It will also delete ${items} item(s) and all their entries.`)) return;
    DB.deleteCategory(id);
    this.toast('Category deleted', 'info');
    this.renderCategories();
  },

  // ── ITEMS ────────────────────────────────────────────────
  renderItems(filterCat = '') {
    const cats  = DB.getCategories();
    const items = DB.getItems();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">All Items</span>
        <button class="btn btn-primary" onclick="App.openItemModal()">＋ Add Item</button>
      </div>
      <div class="filter-bar">
        <select class="form-control" id="item-cat-filter" onchange="App.renderItems(this.value)">
          <option value="">All Categories</option>
          ${cats.map(c => `<option value="${c.id}" ${c.id===filterCat?'selected':''}>${c.emoji||''} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody id="items-tbody"></tbody>
        </table>
      </div>`;
    const tbody = document.getElementById('items-tbody');
    const filtered = filterCat ? items.filter(i => i.categoryId === filterCat) : items;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📦</div><h3>No items yet</h3><p>Add an item to get started.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(item => {
      const cat = DB.getCategoryById(item.categoryId);
      return `<tr>
        <td><strong>${item.name}</strong></td>
        <td><span>${cat?.emoji||''} ${cat?.name||'—'}</span></td>
        <td><span class="badge badge-${cat?.type||'expense'}">${cat?.type||''}</span></td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="App.openItemModal('${item.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="App.deleteItem('${item.id}')">🗑️</button>
        </td></tr>`;
    }).join('');
  },

  openItemModal(id = null) {
    const item = id ? DB.getItemById(id) : {};
    const cats = DB.getCategories();
    this.showModal(id ? 'Edit Item' : 'New Item', `
      <div class="form-group">
        <label class="form-label">Item Name</label>
        <input class="form-control" id="item-name" value="${item.name||''}" placeholder="e.g. Groceries">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-control" id="item-cat">
          ${cats.map(c => `<option value="${c.id}" ${c.id===item.categoryId?'selected':''}>${c.emoji||''} ${c.name} (${c.type})</option>`).join('')}
        </select>
      </div>`, () => {
        const name = document.getElementById('item-name').value.trim();
        const categoryId = document.getElementById('item-cat').value;
        if (!name) { this.toast('Name is required', 'error'); return; }
        if (id) DB.updateItem(id, { name, categoryId });
        else DB.addItem({ name, categoryId });
        this.hideModal();
        this.toast(id ? 'Item updated' : 'Item added');
        this.renderItems();
      });
  },

  deleteItem(id) {
    if (!this.confirm('Delete this item and all its entries?')) return;
    DB.deleteItem(id);
    this.toast('Item deleted', 'info');
    this.renderItems();
  },

  // ── JOURNAL ENTRIES ──────────────────────────────────────
  renderEntries() {
    const cats = DB.getCategories();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">Journal Entries</span>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost btn-sm" onclick="App.exportAllCSV()">⬇️ Export CSV</button>
          <button class="btn btn-primary" onclick="App.openEntryModal()">＋ Add Entry</button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="form-control" id="entry-search" placeholder="Search entries..." value="${this.entrySearch}" oninput="App.applyEntryFilter()">
        </div>
        <select class="form-control" id="entry-type-filter" onchange="App.applyEntryFilter()">
          <option value="">All Types</option>
          <option value="income" ${this.entryFilterType==='income'?'selected':''}>💰 Income</option>
          <option value="expense" ${this.entryFilterType==='expense'?'selected':''}>💸 Expense</option>
        </select>
        <select class="form-control" id="entry-cat-filter" onchange="App.applyEntryFilter()">
          <option value="">All Categories</option>
          ${cats.map(c2 => `<option value="${c2.id}" ${c2.id===this.entryFilterCat?'selected':''}>${c2.emoji||''} ${c2.name}</option>`).join('')}
        </select>
      </div>
      <div id="entry-table-wrap"></div>
      <div id="entry-page-wrap" class="pagination"></div>`;
    this.drawEntryTable();
  },

  applyEntryFilter() {
    this.entrySearch    = document.getElementById('entry-search')?.value || '';
    this.entryFilterType = document.getElementById('entry-type-filter')?.value || '';
    this.entryFilterCat  = document.getElementById('entry-cat-filter')?.value || '';
    this.entryPage = 1;
    this.drawEntryTable();
  },

  filteredEntries() {
    let entries = DB.getEntries().sort((a, b) => new Date(b.date) - new Date(a.date));
    const items = DB.getItems();
    if (this.entryFilterType) entries = entries.filter(e => e.type === this.entryFilterType);
    if (this.entryFilterCat)  entries = entries.filter(e => {
      const it = items.find(i => i.id === e.itemId);
      return it && it.categoryId === this.entryFilterCat;
    });
    if (this.entrySearch) {
      const q = this.entrySearch.toLowerCase();
      entries = entries.filter(e => {
        const it = items.find(i => i.id === e.itemId);
        return (it?.name||'').toLowerCase().includes(q) || (e.note||'').toLowerCase().includes(q) || e.date.includes(q);
      });
    }
    return entries;
  },

  drawEntryTable() {
    const PAGE = 12;
    const all  = this.filteredEntries();
    const total = Math.ceil(all.length / PAGE) || 1;
    this.entryPage = Math.min(this.entryPage, total);
    const slice = all.slice((this.entryPage - 1) * PAGE, this.entryPage * PAGE);

    document.getElementById('entry-table-wrap').innerHTML = this.buildEntryTable(slice, false);

    const pw = document.getElementById('entry-page-wrap');
    if (total <= 1) { pw.innerHTML = ''; return; }
    pw.innerHTML = Array.from({ length: total }, (_, i) =>
      `<button class="page-btn ${i+1===this.entryPage?'active':''}" onclick="App.entryPage=${i+1};App.drawEntryTable()">${i+1}</button>`
    ).join('');
  },

  buildEntryTable(entries, compact) {
    if (!entries.length) return `<div class="empty-state"><div class="empty-icon">📒</div><h3>No entries found</h3><p>Add your first journal entry.</p></div>`;
    const items = DB.getItems();
    const cats  = DB.getCategories();
    return `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Type</th><th>Amount</th>${compact?'':`<th>Note</th><th>Actions</th>`}</tr></thead>
      <tbody>${entries.map(e => {
        const it  = items.find(i => i.id === e.itemId);
        const cat = cats.find(c => c.id === it?.categoryId);
        const sign = e.type === 'income' ? '+' : '−';
        const col  = e.type === 'income' ? 'var(--income)' : 'var(--expense)';
        return `<tr>
          <td>${e.date}</td>
          <td>${it?.name||'—'}</td>
          <td>${cat ? `${cat.emoji||''} ${cat.name}` : '—'}</td>
          <td><span class="badge badge-${e.type}">${e.type}</span></td>
          <td style="color:${col};font-weight:700">${sign} ${this.fmt(e.amount)}</td>
          ${compact ? '' : `<td style="color:var(--text-muted);font-size:12px">${e.note||'—'}</td>
            <td class="td-actions">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="App.openEntryModal('${e.id}')">✏️</button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="App.deleteEntry('${e.id}')">🗑️</button>
            </td>`}
        </tr>`;
      }).join('')}</tbody></table></div>`;
  },

  openEntryModal(id = null) {
    const entry = id ? DB.getEntryById(id) : {};
    const cats  = DB.getCategories();
    const type  = entry.type || 'expense';
    const selCat = entry.itemId ? (DB.getItemById(entry.itemId)||{}).categoryId : '';
    const catOpts = cats.map(c => `<option value="${c.id}" ${c.id===selCat?'selected':''}>${c.emoji||''} ${c.name} (${c.type})</option>`).join('');
    const it    = entry.itemId ? DB.getItemById(entry.itemId) : null;
    const itemsInCat = selCat ? DB.getItemsByCategory(selCat) : (cats.length ? DB.getItemsByCategory(cats[0]?.id||'') : []);
    const itemOpts = itemsInCat.map(i => `<option value="${i.id}" ${i.id===entry.itemId?'selected':''}>${i.name}</option>`).join('');

    this.showModal(id ? 'Edit Entry' : 'New Entry', `
      <div class="form-group">
        <label class="form-label">Type</label>
        <div class="type-toggle">
          <button class="type-btn ${type==='income'?'active income':''}" onclick="App.setTypeBtn(this,'income')" data-val="income">💰 Income</button>
          <button class="type-btn ${type==='expense'?'active expense':''}" onclick="App.setTypeBtn(this,'expense')" data-val="expense">💸 Expense</button>
        </div>
        <input type="hidden" id="cat-type" value="${type}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="entry-cat" onchange="App.loadItemsForCat(this.value)">
            ${catOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Item</label>
          <select class="form-control" id="entry-item">${itemOpts||'<option>—</option>'}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="entry-date" value="${entry.date||this.today()}">
        </div>
        <div class="form-group">
          <label class="form-label">Amount (${this.cur()})</label>
          <input type="number" class="form-control" id="entry-amount" value="${entry.amount||''}" placeholder="0.00" min="0" step="0.01">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Note (optional)</label>
        <textarea class="form-control" id="entry-note" rows="2" placeholder="Any extra details...">${entry.note||''}</textarea>
      </div>`, () => {
        const itemId = document.getElementById('entry-item').value;
        const date   = document.getElementById('entry-date').value;
        const amount = parseFloat(document.getElementById('entry-amount').value);
        const note   = document.getElementById('entry-note').value.trim();
        const type2  = document.getElementById('cat-type').value;
        if (!itemId || !date || isNaN(amount) || amount <= 0) {
          this.toast('Please fill all required fields', 'error'); return;
        }
        if (id) DB.updateEntry(id, { itemId, date, amount, note, type: type2 });
        else    DB.addEntry({ itemId, date, amount, note, type: type2 });
        this.hideModal();
        this.toast(id ? 'Entry updated' : 'Entry recorded');
        this.renderEntries();
      });
  },

  loadItemsForCat(catId) {
    const items = DB.getItemsByCategory(catId);
    const sel   = document.getElementById('entry-item');
    sel.innerHTML = items.length
      ? items.map(i => `<option value="${i.id}">${i.name}</option>`).join('')
      : '<option value="">No items in this category</option>';
  },

  deleteEntry(id) {
    if (!this.confirm('Delete this entry?')) return;
    DB.deleteEntry(id);
    this.toast('Entry deleted', 'info');
    this.renderEntries();
  },

  exportAllCSV() {
    Reports.exportEntriesCSV(this.filteredEntries());
    this.toast('CSV exported');
  },

  // ── MONTHLY REPORT ───────────────────────────────────────
  renderMonthly() {
    const { y, m } = this.nowYM();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header" style="margin-bottom:20px">
        <div class="period-nav">
          <button class="btn btn-ghost btn-icon" id="m-prev">◀</button>
          <span class="period-label" id="m-label"></span>
          <button class="btn btn-ghost btn-icon" id="m-next">▶</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" id="m-csv">⬇️ CSV</button>
        </div>
      </div>
      <div id="monthly-body"></div>`;

    let cy = y, cm = m;
    const render = () => {
      const r = Reports.getMonthlyReport(cy, cm);
      document.getElementById('m-label').textContent = `${this.monthName(cm)} ${cy}`;
      document.getElementById('m-csv').onclick = () => { Reports.exportMonthlySummaryCSV(r); this.toast('CSV exported'); };
      document.getElementById('monthly-body').innerHTML = `
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
          <div class="stat-card" style="--accent-clr:var(--income)"><div class="icon">💰</div><div class="label">Total Income</div><div class="value" style="color:var(--income)">${this.fmt(r.totalIncome)}</div></div>
          <div class="stat-card" style="--accent-clr:var(--expense)"><div class="icon">💸</div><div class="label">Total Expenses</div><div class="value" style="color:var(--expense)">${this.fmt(r.totalExpense)}</div></div>
          <div class="stat-card" style="--accent-clr:${r.netBalance>=0?'var(--income)':'var(--expense)'}"><div class="icon">${r.netBalance>=0?'✅':'⚠️'}</div><div class="label">Net Balance</div><div class="value" style="color:${r.netBalance>=0?'var(--income)':'var(--expense)'}">${this.fmt(r.netBalance)}</div></div>
        </div>
        <div class="grid-2" style="margin-bottom:24px">
          <div class="card">
            <div class="section-title" style="margin-bottom:14px">Category Breakdown</div>
            <div class="chart-container" style="height:240px"><canvas id="m-pie"></canvas></div>
          </div>
          <div class="card">
            <div class="section-title" style="margin-bottom:14px">Detailed Breakdown</div>
            <div class="table-wrap" style="max-height:260px;overflow-y:auto">
              <table>
                <thead><tr><th>Category / Item</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead>
                <tbody>${r.categorySummary.map(cs => `
                  <tr><td class="report-cat-name">${cs.cat.emoji||''} ${cs.cat.name}</td><td><span class="badge badge-${cs.type}">${cs.type}</span></td><td style="text-align:right;font-weight:700">${this.fmt(cs.total)}</td></tr>
                  ${cs.items.map(it => `<tr class="report-item-row"><td style="padding-left:28px;color:var(--text-muted)">↳ ${it.item.name}</td><td></td><td style="text-align:right;color:var(--text-muted)">${this.fmt(it.total)}</td></tr>`).join('')}
                `).join('')}
                ${r.categorySummary.length===0?`<tr><td colspan="3"><div class="empty-state" style="padding:30px"><div class="empty-icon">📊</div><p>No entries for this period.</p></div></td></tr>`:''}
                </tbody>
              </table>
            </div>
          </div>
        </div>`;
      this.destroyCharts();
      const expC = r.categorySummary.filter(c2 => c2.type === 'expense');
      if (expC.length) {
        this.charts.mpie = new Chart(document.getElementById('m-pie'), {
          type: 'doughnut',
          data: { labels: expC.map(c2=>c2.cat.name), datasets: [{ data: expC.map(c2=>c2.total), backgroundColor: expC.map(c2=>c2.cat.color||'#6366f1'), borderWidth:0 }] },
          options: { ...this.pieOpts(), cutout: '60%' }
        });
      } else {
        document.getElementById('m-pie').parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">🍩</div><p>No expenses this period</p></div>`;
      }
    };
    render();
    document.getElementById('m-prev').onclick = () => { if (--cm < 1) { cm = 12; cy--; } render(); };
    document.getElementById('m-next').onclick = () => { if (++cm > 12) { cm = 1; cy++; } render(); };
  },

  // ── YEARLY REPORT ────────────────────────────────────────
  renderYearly() {
    const { y } = this.nowYM();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header" style="margin-bottom:20px">
        <div class="period-nav">
          <button class="btn btn-ghost btn-icon" id="y-prev">◀</button>
          <span class="period-label" id="y-label"></span>
          <button class="btn btn-ghost btn-icon" id="y-next">▶</button>
        </div>
      </div>
      <div id="yearly-body"></div>`;
    let cy = y;
    const render = () => {
      const r = Reports.getYearlyReport(cy);
      document.getElementById('y-label').textContent = `Year ${cy}`;
      document.getElementById('yearly-body').innerHTML = `
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
          <div class="stat-card" style="--accent-clr:var(--income)"><div class="icon">💰</div><div class="label">Annual Income</div><div class="value" style="color:var(--income)">${this.fmt(r.totalIncome)}</div></div>
          <div class="stat-card" style="--accent-clr:var(--expense)"><div class="icon">💸</div><div class="label">Annual Expenses</div><div class="value" style="color:var(--expense)">${this.fmt(r.totalExpense)}</div></div>
          <div class="stat-card" style="--accent-clr:${r.netBalance>=0?'var(--income)':'var(--expense)'}"><div class="icon">📊</div><div class="label">Year Net</div><div class="value" style="color:${r.netBalance>=0?'var(--income)':'var(--expense)'}">${this.fmt(r.netBalance)}</div></div>
        </div>
        <div class="card" style="margin-bottom:20px">
          <div class="section-title" style="margin-bottom:14px">Income vs Expenses — ${cy}</div>
          <div class="chart-container" style="height:260px"><canvas id="y-bar"></canvas></div>
        </div>
        <div class="card">
          <div class="section-title" style="margin-bottom:14px">Monthly Breakdown</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
              <tbody>
                ${r.months.map((mr, i) => `<tr>
                  <td>${this.monthName(i+1)}</td>
                  <td style="color:var(--income)">${this.fmt(mr.totalIncome)}</td>
                  <td style="color:var(--expense)">${this.fmt(mr.totalExpense)}</td>
                  <td style="color:${mr.netBalance>=0?'var(--income)':'var(--expense)'}"><strong>${this.fmt(mr.netBalance)}</strong></td>
                </tr>`).join('')}
                <tr class="total-row">
                  <td><strong>Total</strong></td>
                  <td style="color:var(--income)"><strong>${this.fmt(r.totalIncome)}</strong></td>
                  <td style="color:var(--expense)"><strong>${this.fmt(r.totalExpense)}</strong></td>
                  <td style="color:${r.netBalance>=0?'var(--income)':'var(--expense)'}"><strong>${this.fmt(r.netBalance)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`;
      this.destroyCharts();
      this.charts.ybar = new Chart(document.getElementById('y-bar'), {
        type: 'bar',
        data: {
          labels: r.months.map((_, i) => this.monthName(i+1).slice(0,3)),
          datasets: [
            { label: 'Income',  data: r.months.map(m => m.totalIncome),  backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 6 },
            { label: 'Expense', data: r.months.map(m => m.totalExpense), backgroundColor: 'rgba(239,68,68,.7)',  borderRadius: 6 },
          ]
        },
        options: this.barOpts()
      });
    };
    render();
    document.getElementById('y-prev').onclick = () => { cy--; render(); };
    document.getElementById('y-next').onclick = () => { cy++; render(); };
  },

  // ── FINANCIAL ADVICE ────────────────────────────────────
  renderAdvice() {
    const { y, m } = this.nowYM();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header" style="margin-bottom:6px">
        <span class="section-title">Advice for ${this.monthName(m)} ${y}</span>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:22px">Based on your journal entries this month.</p>
      <div class="advice-grid" id="advice-list"></div>`;
    const advices = AdviceEngine.getAdvice(y, m);
    const list = document.getElementById('advice-list');
    list.innerHTML = advices.map(a => {
      if (a.type === 'rule') {
        const rows = a.breakdown.map(b => {
          const over    = b.label.includes('Savings') ? b.value < b.target : b.value > b.target;
          const fill    = Math.min(100, Math.max(0, b.value));
          const color2  = over ? 'var(--expense)' : b.color;
          return `<div>
            <div class="rule-row-label"><span>${b.label}</span><span class="rule-value" style="color:${color2}">${b.value.toFixed(1)}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${fill}%;background:${color2}"></div></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Target: ${b.ideal}</div>
          </div>`;
        }).join('');
        return `<div class="advice-card rule"><div class="advice-title">⚖️ ${a.title}</div><div class="rule-breakdown">${rows}</div></div>`;
      }
      return `<div class="advice-card ${a.type}">
        <div class="advice-icon">${a.icon}</div>
        <div><div class="advice-title">${a.title}</div><div class="advice-body">${a.body}</div></div>
      </div>`;
    }).join('');
  },

  // ── BUDGETS ──────────────────────────────────────────────
  renderBudgets() {
    const { y, m } = this.nowYM();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="section-header"><span class="section-title">Monthly Budgets — ${this.monthName(m)} ${y}</span></div>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:22px">Set spending limits for expense categories and track progress.</p>
      <div class="budget-grid" id="budget-grid"></div>`;
    const cats    = DB.getCategories().filter(c2 => c2.type === 'expense');
    const report  = Reports.getMonthlyReport(y, m);
    const monthStr = `${y}-${String(m).padStart(2,'0')}`;
    const grid = document.getElementById('budget-grid');
    if (!cats.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h3>No expense categories</h3><p>Add some categories first.</p></div>`;
      return;
    }
    grid.innerHTML = cats.map(cat => {
      const budget = DB.getBudgetByCatMonth(cat.id, monthStr);
      const cs     = report.categorySummary.find(c2 => c2.cat.id === cat.id);
      const spent  = cs ? cs.total : 0;
      const limit  = budget ? budget.limit : 0;
      const pct    = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const color  = pct >= 100 ? 'var(--expense)' : pct >= 80 ? 'var(--warning)' : 'var(--income)';
      return `<div class="budget-card">
        <div class="budget-card-top">
          <span class="budget-cat-emoji">${cat.emoji||'📁'}</span>
          <span class="budget-cat-name">${cat.name}</span>
        </div>
        <div class="budget-amounts">
          <span>Spent: <strong style="color:var(--expense)">${this.fmt(spent)}</strong></span>
          <span>Budget: <strong>${limit > 0 ? this.fmt(limit) : 'Not set'}</strong></span>
        </div>
        ${limit > 0 ? `<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${pct.toFixed(0)}% used</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
          <input type="number" class="form-control" id="bgt-${cat.id}" value="${limit||''}" placeholder="Set limit..." min="0" step="100" style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="App.saveBudget('${cat.id}','${monthStr}')">Save</button>
          ${budget ? `<button class="btn btn-ghost btn-sm" onclick="App.deleteBudget('${budget.id}')">✕</button>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  saveBudget(catId, month) {
    const val = parseFloat(document.getElementById(`bgt-${catId}`)?.value);
    if (isNaN(val) || val < 0) { this.toast('Enter a valid amount', 'error'); return; }
    DB.setBudget(catId, month, val);
    this.toast('Budget saved');
    this.renderBudgets();
  },

  deleteBudget(id) {
    DB.deleteBudget(id);
    this.toast('Budget removed', 'info');
    this.renderBudgets();
  },

  // ── SETTINGS ────────────────────────────────────────────
  renderSettings() {
    const s = DB.getSettings();
    const c = document.getElementById('main-content');
    c.innerHTML = `
      <div class="card" style="max-width:520px;margin-bottom:20px">
        <div class="section-title" style="margin-bottom:18px">Preferences</div>
        <div class="form-group">
          <label class="form-label">Currency Symbol</label>
          <select class="form-control" id="set-currency">
            ${['₹','$','€','£','¥','₩','CHF','AED'].map(c2=>`<option ${s.currency===c2?'selected':''}>${c2}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Theme</label>
          <select class="form-control" id="set-theme">
            <option value="dark"  ${s.theme==='dark' ?'selected':''}>🌙 Dark</option>
            <option value="light" ${s.theme==='light'?'selected':''}>☀️ Light</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Savings Goal (%)</label>
          <input type="number" class="form-control" id="set-goal" value="${s.savingsGoal||20}" min="0" max="100">
        </div>
        <button class="btn btn-primary" onclick="App.saveSettings()">💾 Save Preferences</button>
      </div>
      <div class="card" style="max-width:520px">
        <div class="section-title" style="margin-bottom:18px">Data Management</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <button class="btn btn-ghost" onclick="App.exportBackup()">⬇️ Export Full Backup (JSON)</button>
          <label class="btn btn-ghost" style="cursor:pointer">
            ⬆️ Import Backup (JSON)
            <input type="file" accept=".json" style="display:none" onchange="App.importBackup(this)">
          </label>
          <button class="btn btn-danger" onclick="App.clearAllData()">🗑️ Clear All Data</button>
        </div>
      </div>`;
  },

  saveSettings() {
    DB.saveSettings({
      currency:    document.getElementById('set-currency').value,
      theme:       document.getElementById('set-theme').value,
      savingsGoal: parseInt(document.getElementById('set-goal').value) || 20,
    });
    this.applyTheme();
    this.toast('Settings saved');
  },

  exportBackup() {
    const blob = new Blob([DB.exportAll()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `account_book_backup_${this.today()}.json`; a.click();
    this.toast('Backup exported');
  },

  importBackup(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try { DB.importAll(e.target.result); this.toast('Backup imported'); this.navigate('dashboard'); }
      catch { this.toast('Invalid backup file', 'error'); }
    };
    reader.readAsText(file);
  },

  clearAllData() {
    if (!this.confirm('This will delete ALL data permanently. Are you sure?')) return;
    DB.clearAll(); DB.init();
    this.toast('All data cleared', 'info');
    this.navigate('dashboard');
  },

  // ── Chart option presets ─────────────────────────────────
  lineOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7a7a9c', font: { size: 11 } } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#7a7a9c' } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#7a7a9c' } }
      }
    };
  },
  pieOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#7a7a9c', font: { size: 11 }, padding: 14 } }
      }
    };
  },
  barOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7a7a9c' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#7a7a9c' } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#7a7a9c' } }
      }
    };
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
