const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const COLORS_EXP = ['#c9923a','#2d6a4f','#b5341a','#2563a8','#7c3aed','#0891b2','#be185d','#65a30d','#d97706','#1d4ed8','#059669','#dc2626'];

let txType = 'income';
let selectedMonth = new Date().getMonth();
let barChartInst, donutChartInst;

// DATA
// Limpa dados antigos apenas uma vez (você pediu o site sem nenhum dado).
const CLEAN_FLAG = 'orcam_clean_v1';
if (localStorage.getItem(CLEAN_FLAG) !== '1') {
  localStorage.removeItem('orcam_tx');
  localStorage.removeItem('orcam_goals');
  localStorage.setItem(CLEAN_FLAG, '1');
}

let transactions = JSON.parse(localStorage.getItem('orcam_tx') || '[]');
let goals = JSON.parse(localStorage.getItem('orcam_goals') || '[]');

let editGoalId = null;

function save() {
  localStorage.setItem('orcam_tx', JSON.stringify(transactions));
  localStorage.setItem('orcam_goals', JSON.stringify(goals));
}

document.getElementById('currentYear').textContent = new Date().getFullYear();

// Month chips
const chips = document.getElementById('monthChips');
MONTHS.forEach((m, i) => {
  const c = document.createElement('button');
  c.className = 'month-chip' + (i === selectedMonth ? ' active' : '');
  c.textContent = m.substring(0,3);
  c.onclick = () => {
    selectedMonth = i;
    renderChips();
    renderTransactions();
  };
  chips.appendChild(c);
});

function renderChips() {
  [...chips.children].forEach((c,i) => c.classList.toggle('active', i === selectedMonth));
}

// Populate month select in modal
const txMonthSel = document.getElementById('txMonth');
MONTHS.forEach((m,i) => {
  const o = document.createElement('option');
  o.value = i;
  o.textContent = m;
  txMonthSel.appendChild(o);
});

function fmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthTotals(m) {
  const txs = transactions.filter(t => t.month === m);
  const income = txs.filter(t => t.type === 'income').reduce((s,t) => s + t.value, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + t.value, 0);
  return { income, expense, balance: income - expense };
}

function renderMetrics() {
  const totals = MONTHS.map((_, i) => monthTotals(i));
  const totalIncome = totals.reduce((s,t) => s + t.income, 0);
  const totalExpense = totals.reduce((s,t) => s + t.expense, 0);
  const totalBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalBalance / totalIncome) * 100).toFixed(1) : 0;

  document.getElementById('metricsBar').innerHTML = `
    <div class="metric-card green">
      <div class="metric-label">Receitas Anuais</div>
      <div class="metric-value">${fmt(totalIncome)}</div>
      <div class="metric-sub">acumulado no ano</div>
    </div>
    <div class="metric-card red">
      <div class="metric-label">Despesas Anuais</div>
      <div class="metric-value">${fmt(totalExpense)}</div>
      <div class="metric-sub">acumulado no ano</div>
    </div>
    <div class="metric-card gold">
      <div class="metric-label">Saldo Líquido</div>
      <div class="metric-value">${fmt(totalBalance)}</div>
      <div class="metric-pill ${totalBalance >= 0 ? 'pill-green' : 'pill-red'}">${totalBalance >= 0 ? 'Positivo' : 'Negativo'}</div>
    </div>
    <div class="metric-card blue">
      <div class="metric-label">Taxa de Poupança</div>
      <div class="metric-value">${savingsRate}%</div>
      <div class="metric-sub">do total recebido</div>
    </div>
  `;
}

function renderBarChart() {
  const incomes = MONTHS.map((_, i) => monthTotals(i).income);
  const expenses = MONTHS.map((_, i) => monthTotals(i).expense);

  if (barChartInst) barChartInst.destroy();

  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: MONTHS.map(m => m.substring(0,3)),
      datasets: [
        { label:'Receitas', data: incomes, backgroundColor:'#2d6a4f', borderRadius:5, borderSkipped:false },
        { label:'Despesas', data: expenses, backgroundColor:'#b5341a', borderRadius:5, borderSkipped:false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display:true, position:'top', labels:{ boxWidth:10, font:{size:11}, color:'#5a5245' } }
      },
      scales: {
        x: { grid:{display:false}, ticks:{ color:'#9a9085', font:{size:10} } },
        y: {
          grid:{ color:'rgba(26,21,16,0.06)' },
          ticks:{ color:'#9a9085', font:{size:10}, callback: v => 'R$' + Math.round(v/1000) + 'k' }
        }
      }
    }
  });
}

function renderDonutChart() {
  const cats = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.value;
  });

  const labels = Object.keys(cats);
  const data = labels.map(k => cats[k]);

  if (donutChartInst) donutChartInst.destroy();

  donutChartInst = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: COLORS_EXP.slice(0, labels.length), borderWidth:0, hoverOffset:6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position:'bottom', labels:{ boxWidth:9, font:{size:10}, color:'#5a5245', padding:8 } }
      }
    }
  });
}

function renderSummaryTable() {
  const tbody = document.getElementById('summaryTable');
  tbody.innerHTML = MONTHS.map((m, i) => {
    const { income, expense, balance } = monthTotals(i);
    const status = balance >= 0
      ? `<span class="metric-pill pill-green">Sobra</span>`
      : `<span class="metric-pill pill-red">Déficit</span>`;

    return `<tr>
      <td class="month-name">${m}</td>
      <td class="positive">${fmt(income)}</td>
      <td class="negative">${fmt(expense)}</td>
      <td class="${balance >= 0 ? 'positive' : 'negative'}">${fmt(balance)}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function renderTransactions() {
  const tbody = document.getElementById('transactionsTable');
  const filtered = transactions.filter(t => t.month === selectedMonth);

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhum lançamento neste mês. Clique em "+ Novo Lançamento" para começar.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td>${t.desc}</td>
      <td><span style="font-size:0.78rem;color:var(--ink3);">${t.category}</span></td>
      <td><span class="metric-pill ${t.type === 'income' ? 'pill-green' : 'pill-red'}">${t.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
      <td class="${t.type === 'income' ? 'positive' : 'negative'}">${t.type === 'income' ? '+' : '-'}${fmt(t.value)}</td>
      <td><button onclick="deleteTx(${t.id})" style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:1rem;opacity:0.5;">×</button></td>
    </tr>
  `).join('');
}

function renderGoals() {
  const grid = document.getElementById('goalsGrid');

  if (!goals.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Nenhuma meta cadastrada ainda.</div>`;
    return;
  }

  grid.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const color = pct >= 75 ? '#2d6a4f' : pct >= 40 ? '#c9923a' : '#2563a8';

    return `<div class="goal-card">
      <button class="goal-edit-btn" onclick="openEditGoalModal(${g.id})" aria-label="Editar meta" title="Editar meta">✎</button>
      <button class="goal-delete-btn" onclick="deleteGoal(${g.id})" aria-label="Excluir meta" title="Excluir meta">×</button>
      <div class="goal-top">
        <div class="goal-name">${g.name}</div>
        <div class="goal-emoji">${g.emoji}</div>
      </div>
      <div class="goal-amounts">Guardado: <span>${fmt(g.current)}</span> de <span>${fmt(g.target)}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color};"></div></div>
      <div class="goal-pct">${pct}% concluído</div>
    </div>`;
  }).join('');
}

function openEditGoalModal(id) {
  const g = goals.find(x => x.id === id);
  if (!g) return;

  editGoalId = id;

  document.getElementById('editGoalName').value = g.name;
  document.getElementById('editGoalTarget').value = g.target;
  document.getElementById('editGoalCurrent').value = g.current;
  document.getElementById('editGoalEmoji').value = g.emoji;

  document.getElementById('editGoalModal').classList.add('open');
  document.getElementById('editGoalName').focus();
}

function closeEditGoalModal() {
  editGoalId = null;
  document.getElementById('editGoalModal').classList.remove('open');
}

function updateGoal() {
  if (editGoalId === null) return;

  const name = document.getElementById('editGoalName').value.trim();
  const target = parseFloat(document.getElementById('editGoalTarget').value);
  const current = parseFloat(document.getElementById('editGoalCurrent').value) || 0;
  const emoji = document.getElementById('editGoalEmoji').value;

  if (!name || isNaN(target) || target <= 0) {
    alert('Preencha nome e valor da meta.');
    return;
  }

  const idx = goals.findIndex(g => g.id === editGoalId);
  if (idx === -1) return;

  goals[idx] = { ...goals[idx], name, target, current, emoji };
  save();

  closeEditGoalModal();
  refreshActivePage();
}

// Pages
function showPage(page, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  if (tabEl && tabEl.classList) tabEl.classList.add('active');

  if (page === 'dashboard') {
    renderMetrics();
    renderBarChart();
    renderDonutChart();
    renderSummaryTable();
  }
  if (page === 'monthly') renderTransactions();
  if (page === 'goals') renderGoals();
}

function refreshActivePage() {
  const active = document.querySelector('.page.active');
  if (!active || !active.id) return;

  if (active.id === 'page-dashboard') {
    renderMetrics();
    renderBarChart();
    renderDonutChart();
    renderSummaryTable();
    return;
  }
  if (active.id === 'page-monthly') {
    renderTransactions();
    return;
  }
  if (active.id === 'page-goals') {
    renderGoals();
  }
}

// Modal
function openModal() {
  txMonthSel.value = selectedMonth;
  document.getElementById('txModal').classList.add('open');
  document.getElementById('txDesc').focus();
}
function closeModal() {
  document.getElementById('txModal').classList.remove('open');
}
function setType(type) {
  txType = type;
  document.getElementById('btnIncome').className = 'type-btn' + (type === 'income' ? ' active-income' : '');
  document.getElementById('btnExpense').className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
}

function saveTransaction() {
  const desc = document.getElementById('txDesc').value.trim();
  const value = parseFloat(document.getElementById('txValue').value);
  const month = parseInt(document.getElementById('txMonth').value, 10);
  const category = document.getElementById('txCategory').value;

  if (!desc || isNaN(value) || value <= 0) {
    alert('Preencha descrição e valor válido.');
    return;
  }

  transactions.push({ id: Date.now(), type: txType, desc, value, month, category });
  save();
  closeModal();
  refreshActivePage();

  document.getElementById('txDesc').value = '';
  document.getElementById('txValue').value = '';
}

function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  refreshActivePage();
}

// Goal modal
function openGoalModal() {
  document.getElementById('goalModal').classList.add('open');
}
function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('open');
}
function saveGoal() {
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
  const emoji = document.getElementById('goalEmoji').value;

  if (!name || isNaN(target) || target <= 0) {
    alert('Preencha nome e valor da meta.');
    return;
  }

  goals.push({ id: Date.now(), name, target, current, emoji });
  save();

  closeGoalModal();
  renderGoals();

  document.getElementById('goalName').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalCurrent').value = '0';
}

function deleteGoal(id) {
  goals = goals.filter(g => g.id !== id);
  save();
  refreshActivePage();
}

// Bulk transactions modal
function openBulkModal() {
  document.getElementById('bulkModal').classList.add('open');
  document.getElementById('bulkText').focus();
}
function closeBulkModal() {
  document.getElementById('bulkModal').classList.remove('open');
}

function parseTxType(token) {
  const t = String(token || '').trim().toLowerCase();
  if (!t) return null;
  if (t === 'income' || t === 'receita' || t === 'r' || t === '+' || t === 'plus') return 'income';
  if (t === 'expense' || t === 'despesa' || t === 'd' || t === '-' || t === 'minus') return 'expense';
  return null;
}

function parseMoneyBR(token) {
  const raw = String(token || '').trim().replace(/^r\$\s*/i, '');
  if (!raw) return NaN;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

function parseMonthToken(token, fallbackMonth) {
  if (token === undefined || token === null || String(token).trim() === '') return fallbackMonth;
  const s = String(token).trim().toLowerCase();

  // Nomes/abreviações em português
  const ptNames = {
    jan: 0, janeiro: 0,
    fev: 1, fevereiro: 1,
    mar: 2, março: 2, marco: 2,
    abr: 3, abril: 3,
    mai: 4, maio: 4,
    jun: 5, junho: 5,
    jul: 6, julho: 6,
    ago: 7, agosto: 7,
    set: 8, setembro: 8,
    out: 9, outubro: 9,
    nov: 10, novembro: 10,
    dez: 11, dezembro: 11,
  };
  if (ptNames[s] !== undefined) return ptNames[s];

  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return fallbackMonth;
  // Permite 0-11 ou 1-12.
  if (n >= 0 && n <= 11) return n;
  if (n >= 1 && n <= 12) return n - 1;
  return fallbackMonth;
}

function addBulkTransactions() {
  const textarea = document.getElementById('bulkText');
  const raw = textarea.value || '';
  const lines = raw.split(/\r?\n/);

  let added = 0;
  let skipped = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Aceita separadores comuns: ;  |  TAB
    const parts = trimmed.split(/[;\t|]/).map(p => p.trim()).filter(Boolean);
    // Esperado: tipo;descricao;valor;categoria;[mes]
    if (parts.length < 4) {
      skipped++;
      return;
    }

    const type = parseTxType(parts[0]);
    const desc = parts[1];
    const value = parseMoneyBR(parts[2]);
    const category = parts[3];
    const month = parseMonthToken(parts[4], selectedMonth);

    if (!type || !desc || !category || Number.isNaN(value) || value <= 0) {
      skipped++;
      return;
    }

    transactions.push({
      id: Date.now() + Math.floor(Math.random() * 1000000),
      type,
      desc,
      value,
      month,
      category
    });
    added++;
  });

  if (added === 0) {
    alert(skipped > 0 ? 'Nada foi adicionado. Verifique o formato das linhas.' : 'Nada para adicionar.');
    return;
  }

  save();
  closeBulkModal();
  textarea.value = '';
  refreshActivePage();
}

// Atalhos de teclado (ganha velocidade no cadastro)
document.addEventListener('keydown', (e) => {
  const txOpen = document.getElementById('txModal')?.classList?.contains('open');
  const bulkOpen = document.getElementById('bulkModal')?.classList?.contains('open');

  if (txOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === 'Enter') {
      const active = document.activeElement;
      const allowedIds = new Set(['txDesc', 'txValue', 'txMonth', 'txCategory']);
      if (active && allowedIds.has(active.id)) {
        e.preventDefault();
        saveTransaction();
      }
    }
  }

  if (bulkOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeBulkModal();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      addBulkTransactions();
    }
  }
});

// Init
renderMetrics();
renderBarChart();
renderDonutChart();
renderSummaryTable();