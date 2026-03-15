/**
 * 예산 출납 관리 앱
 * - 계층별 예산 선택 (세부사업 → 세부항목 → 원가통계비목 → 산출내역)
 * - 지출 입력 시 해당 예산 잔액 자동 반영
 * - 지출 내역 수정/삭제
 */

(function () {
  'use strict';

  // 기정 예산 데이터 (예산잔액은 지출 합계로 계산)
  const INITIAL_BUDGET = [
    { 세부사업: '동아리활동', 세부항목: '예술공감교육(연극)', 원가통계비목: '교육운영비', 산출내역: '운영물품구입비(보조금)', 예산현액: 300000 },
    { 세부사업: '동아리활동', 세부항목: '예술공감교육(연극)', 원가통계비목: '운영수당', 산출내역: '강사수당(보조금)', 예산현액: 3200000 },
    { 세부사업: '동아리활동', 세부항목: '예술공감교육(연극)', 원가통계비목: '운영수당', 산출내역: '강사수당(자체)', 예산현액: 0 },
    { 세부사업: '동아리활동', 세부항목: '학교특색교육활동', 원가통계비목: '교육운영비', 산출내역: '간식비', 예산현액: 825000 },
    { 세부사업: '동아리활동', 세부항목: '학교특색교육활동', 원가통계비목: '교육운영비', 산출내역: '식비', 예산현액: 220000 },
    { 세부사업: '동아리활동', 세부항목: '학교특색교육활동', 원가통계비목: '교육운영비', 산출내역: '운영물품구입', 예산현액: 250000 },
    { 세부사업: '동아리활동', 세부항목: '학교특색교육활동', 원가통계비목: '교육운영비', 산출내역: '차량임차', 예산현액: 1500000 },
    { 세부사업: '동아리활동', 세부항목: '학생밴드동아리(꿈길꽃길)', 원가통계비목: '교육운영비', 산출내역: '운영물품구입비(보조금)', 예산현액: 2250000 },
    { 세부사업: '동아리활동', 세부항목: '학생밴드동아리(꿈길꽃길)', 원가통계비목: '비품구입비', 산출내역: '비품구입비(보조금)', 예산현액: 350000 },
    { 세부사업: '동아리활동', 세부항목: '학생밴드동아리(꿈길꽃길)', 원가통계비목: '운영수당', 산출내역: '강사수당(보조금)', 예산현액: 13440000 },
    { 세부사업: '동아리활동', 세부항목: '학생밴드동아리(꿈길꽃길)', 원가통계비목: '운영수당', 산출내역: '강사수당(자체)', 예산현액: 4000000 },
    { 세부사업: '예술 교과활동', 세부항목: '음악교과운영', 원가통계비목: '교육운영비', 산출내역: '운영물품구입', 예산현액: 1500000 },
    { 세부사업: '예술 교과활동', 세부항목: '음악교과운영', 원가통계비목: '비품구입비', 산출내역: '악기구입', 예산현액: 1000000 },
    { 세부사업: '예술 교과활동', 세부항목: '음악교과운영', 원가통계비목: '일반수용비', 산출내역: '청소용구 및 쓰레기봉투 구입', 예산현액: 100000 },
  ];

  const STORAGE_BUDGET = 'budgetItems';
  const STORAGE_EXPENSES = 'expenses';

  // id 부여한 예산 배열 (로컬 저장용, 잔액은 계산)
  let budgetItems = [];
  let expenses = [];

  const $ = (id) => document.getElementById(id);

  function formatMoney(n) {
    return '₩' + Number(n).toLocaleString();
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_BUDGET);
      if (saved) {
        budgetItems = JSON.parse(saved);
      } else {
        budgetItems = [];
      }
    } catch (e) {
      budgetItems = [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_EXPENSES);
      expenses = saved ? JSON.parse(saved) : [];
    } catch (e) {
      expenses = [];
    }
  }

  function saveBudget() {
    localStorage.setItem(STORAGE_BUDGET, JSON.stringify(budgetItems));
  }

  function saveExpenses() {
    localStorage.setItem(STORAGE_EXPENSES, JSON.stringify(expenses));
  }

  function doBackup() {
    const data = {
      version: 1,
      budgetItems: budgetItems,
      expenses: expenses,
      savedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '예산출납_백업_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function doRestore(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.budgetItems) || !Array.isArray(data.expenses)) {
          alert('올바른 백업 파일이 아닙니다.');
          return;
        }
        if (!confirm('백업 파일을 불러오면 현재 데이터가 교체됩니다. 계속할까요?')) return;
        budgetItems = data.budgetItems;
        expenses = data.expenses;
        saveBudget();
        saveExpenses();
        buildCascade();
        renderBudgetTable();
        renderExpenseList();
        renderFilter();
        onSanchulChange();
        clearForm();
        alert('불러오기가 완료되었습니다.');
      } catch (e) {
        alert('파일을 읽는 중 오류가 났습니다. 올바른 백업 파일인지 확인해 주세요.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function nextBudgetId() {
    if (budgetItems.length === 0) return 0;
    return 1 + Math.max(...budgetItems.map((b) => b.id));
  }

  function loadExampleBudget() {
    const msg =
      budgetItems.length > 0
        ? '예시 데이터를 불러오면 현재 예산 항목이 아래 예시 14개 항목으로 교체됩니다. 기존 지출 내역은 유지됩니다. 계속하시겠습니까?'
        : '예시 데이터(동아리·예술 교과 등 14개 항목)를 불러옵니다. 계속하시겠습니까?';
    if (!confirm(msg)) return;
    budgetItems = INITIAL_BUDGET.map((row, i) => ({
      id: i,
      세부사업: row.세부사업,
      세부항목: row.세부항목,
      원가통계비목: row.원가통계비목,
      산출내역: row.산출내역,
      예산현액: row.예산현액,
    }));
    saveBudget();
    buildCascade();
    renderBudgetTable();
    renderFilter();
    onSanchulChange();
  }

  function addBudgetRow(row) {
    const id = nextBudgetId();
    budgetItems.push({
      id,
      세부사업: row.세부사업.trim(),
      세부항목: row.세부항목.trim(),
      원가통계비목: row.원가통계비목.trim(),
      산출내역: row.산출내역.trim(),
      예산현액: Number(row.예산현액) || 0,
    });
    saveBudget();
    buildCascade();
    renderBudgetTable();
  }

  function deleteBudgetRow(id) {
    const used = expenses.some((e) => e.budgetId === id);
    if (used) {
      alert('이 예산 항목을 사용한 지출 내역이 있어 삭제할 수 없습니다.');
      return;
    }
    if (!confirm('이 예산 항목을 삭제할까요?')) return;
    budgetItems = budgetItems.filter((b) => b.id !== id);
    saveBudget();
    buildCascade();
    renderBudgetTable();
    onSanchulChange();
  }

  function renderBudgetTable() {
    const tbody = $('budget-tbody');
    tbody.innerHTML = '';
    budgetItems.forEach((b) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        (b.세부사업 || '-') +
        '</td><td>' +
        (b.세부항목 || '-') +
        '</td><td>' +
        (b.원가통계비목 || '-') +
        '</td><td>' +
        (b.산출내역 || '-') +
        '</td><td class="amount">' +
        formatMoney(b.예산현액) +
        '</td><td class="actions-cell"><button type="button" class="delete btn-delete-budget">삭제</button></td>';
      tr.querySelector('.btn-delete-budget').addEventListener('click', () => deleteBudgetRow(b.id));
      tbody.appendChild(tr);
    });
    $('budget-empty-msg').classList.toggle('hidden', budgetItems.length > 0);
  }

  function getSpentByBudgetId(budgetId) {
    return expenses
      .filter((e) => e.budgetId === budgetId)
      .reduce((sum, e) => sum + (e.total || 0), 0);
  }

  function getRemain(budget) {
    const spent = getSpentByBudgetId(budget.id);
    return Math.max(0, budget.예산현액 - spent);
  }

  function getUnique(values) {
    return [...new Set(values)];
  }

  function fillSelect(selectId, options, valueKey, labelKey) {
    const sel = $(selectId);
    const current = sel.value;
    sel.innerHTML = '<option value="">선택하세요</option>';
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = typeof valueKey === 'string' ? opt[valueKey] : opt;
      o.textContent = typeof labelKey === 'string' ? opt[labelKey] : opt;
      sel.appendChild(o);
    });
    if (current && options.some((o) => (typeof valueKey === 'string' ? o[valueKey] : o) === current)) {
      sel.value = current;
    }
  }

  function setCascadeDisabled(fromIndex) {
    const ids = ['sel-hangmok', 'sel-bimok', 'sel-sanchul'];
    for (let i = fromIndex; i < ids.length; i++) {
      const sel = $(ids[i]);
      sel.disabled = true;
      sel.innerHTML = '<option value="">선택하세요</option>';
    }
  }

  function buildCascade() {
    fillSelect(
      'sel-saup',
      getUnique(budgetItems.map((b) => b.세부사업)),
      null,
      null
    );
    setCascadeDisabled(1);
  }

  function onSaupChange() {
    const saup = $('sel-saup').value;
    setCascadeDisabled(1);
    if (!saup) return;
    const filtered = budgetItems.filter((b) => b.세부사업 === saup);
    const hangmoks = getUnique(filtered.map((b) => b.세부항목));
    fillSelect('sel-hangmok', hangmoks, null, null);
    $('sel-hangmok').disabled = false;
  }

  function onHangmokChange() {
    const saup = $('sel-saup').value;
    const hangmok = $('sel-hangmok').value;
    setCascadeDisabled(2);
    if (!saup || !hangmok) return;
    const filtered = budgetItems.filter((b) => b.세부사업 === saup && b.세부항목 === hangmok);
    const bimoks = getUnique(filtered.map((b) => b.원가통계비목));
    fillSelect('sel-bimok', bimoks, null, null);
    $('sel-bimok').disabled = false;
  }

  function onBimokChange() {
    const saup = $('sel-saup').value;
    const hangmok = $('sel-hangmok').value;
    const bimok = $('sel-bimok').value;
    setCascadeDisabled(3);
    if (!saup || !hangmok || !bimok) return;
    const filtered = budgetItems.filter(
      (b) => b.세부사업 === saup && b.세부항목 === hangmok && b.원가통계비목 === bimok
    );
    fillSelect('sel-sanchul', filtered, 'id', '산출내역');
    $('sel-sanchul').disabled = false;
  }

  function onSanchulChange() {
    const id = $('sel-sanchul').value;
    const info = $('selected-budget-info');
    if (!id) {
      info.hidden = true;
      $('input-budget-id').value = '';
      return;
    }
    const budget = budgetItems.find((b) => String(b.id) === id);
    if (!budget) return;
    info.hidden = false;
    $('budget-label').textContent = [budget.세부사업, budget.세부항목, budget.원가통계비목, budget.산출내역].join(' > ');
    $('budget-total').textContent = formatMoney(budget.예산현액);
    $('budget-remain').textContent = formatMoney(getRemain(budget));
    $('input-budget-id').value = id;
  }

  function recalcTotal() {
    const unit = Number($('input-unit-price').value) || 0;
    const qty = Number($('input-quantity').value) || 0;
    $('input-total').value = unit * qty;
  }

  let editingExpenseId = null;

  function clearForm() {
    $('expense-form').reset();
    $('input-total').value = '';
    $('input-quantity').value = '1';
    $('input-budget-id').value = '';
    $('btn-submit').textContent = '등록';
    $('btn-cancel-edit').hidden = true;
    editingExpenseId = null;
    recalcTotal();
  }

  function setFormForEdit(expense) {
    editingExpenseId = expense.id;
    $('input-pumui-date').value = expense.pumuiDate || '';
    $('input-pumui-no').value = expense.pumuiNo || '';
    $('input-purchase-date').value = expense.purchaseDate || '';
    $('input-detail').value = expense.detail || '';
    $('input-unit-price').value = expense.unitPrice ?? '';
    $('input-quantity').value = expense.quantity ?? 1;
    $('input-total').value = expense.total ?? '';
    $('input-budget-id').value = String(expense.budgetId);

    const budget = budgetItems.find((b) => b.id === expense.budgetId);
    if (budget) {
      $('sel-saup').value = budget.세부사업;
      onSaupChange();
      $('sel-hangmok').value = budget.세부항목;
      onHangmokChange();
      $('sel-bimok').value = budget.원가통계비목;
      onBimokChange();
      $('sel-sanchul').value = String(budget.id);
      onSanchulChange();
    }
    $('btn-submit').textContent = '수정';
    $('btn-cancel-edit').hidden = false;
    recalcTotal();
  }

  function onSubmit(e) {
    e.preventDefault();
    const budgetId = $('input-budget-id').value;
    if (!budgetId) {
      alert('예산을 선택해 주세요.');
      return;
    }
    const total = Number($('input-total').value) || 0;
    const budget = budgetItems.find((b) => String(b.id) === budgetId);
    if (!budget) return;
    const remain = getRemain(budget);
    if (total > remain) {
      if (!confirm('선택한 예산 잔액(' + formatMoney(remain) + ')을 초과합니다. 그래도 등록할까요?')) {
        return;
      }
    }
    const row = {
      id: editingExpenseId ?? 'e' + Date.now(),
      budgetId: Number(budgetId),
      pumuiDate: $('input-pumui-date').value,
      pumuiNo: ($('input-pumui-no').value || '').trim(),
      purchaseDate: $('input-purchase-date').value,
      detail: $('input-detail').value.trim(),
      unitPrice: Number($('input-unit-price').value) || 0,
      quantity: Number($('input-quantity').value) || 1,
      total: total,
    };
    if (editingExpenseId != null) {
      const idx = expenses.findIndex((x) => x.id === editingExpenseId);
      if (idx !== -1) expenses[idx] = row;
    } else {
      expenses.push(row);
    }
    saveExpenses();
    clearForm();
    renderExpenseList();
    renderFilter();
    onSanchulChange();
  }

  function deleteExpense(id) {
    if (!confirm('이 지출 내역을 삭제할까요?')) return;
    expenses = expenses.filter((e) => e.id !== id);
    saveExpenses();
    renderExpenseList();
    renderFilter();
    onSanchulChange();
    if (editingExpenseId === id) clearForm();
  }

  function renderExpenseList() {
    const tbody = $('expense-tbody');
    const filterVal = $('filter-budget').value;
    let list = expenses;
    if (filterVal !== '') {
      const bid = Number(filterVal);
      list = expenses.filter((e) => e.budgetId === bid);
    }
    list.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    tbody.innerHTML = '';
    list.forEach((e) => {
      const budget = budgetItems.find((b) => b.id === e.budgetId);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        (budget ? budget.산출내역 : '-') +
        '</td>' +
        '<td>' +
        (e.pumuiDate || '-') +
        '</td>' +
        '<td>' +
        (e.pumuiNo || '-') +
        '</td>' +
        '<td>' +
        (e.purchaseDate || '-') +
        '</td>' +
        '<td>' +
        (e.detail || '-') +
        '</td>' +
        '<td class="amount">' +
        formatMoney(e.unitPrice) +
        '</td>' +
        '<td class="amount">' +
        (e.quantity || 0) +
        '</td>' +
        '<td class="amount">' +
        formatMoney(e.total) +
        '</td>' +
        '<td class="actions-cell"><button type="button" class="edit">수정</button><button type="button" class="delete">삭제</button></td>';
      tr.querySelector('.edit').addEventListener('click', () => setFormForEdit(e));
      tr.querySelector('.delete').addEventListener('click', () => deleteExpense(e.id));
      tbody.appendChild(tr);
    });
    $('empty-msg').classList.toggle('hidden', list.length > 0);
  }

  function renderFilter() {
    const sel = $('filter-budget');
    const cur = sel.value;
    sel.innerHTML = '<option value="">전체</option>';
    const used = [...new Set(expenses.map((e) => e.budgetId))];
    used.forEach((bid) => {
      const b = budgetItems.find((x) => x.id === bid);
      if (!b) return;
      const opt = document.createElement('option');
      opt.value = bid;
      opt.textContent = b.산출내역 + ' (' + formatMoney(getRemain(b)) + ' 잔액)';
      sel.appendChild(opt);
    });
    if (cur && used.includes(Number(cur))) sel.value = cur;
  }

  function init() {
    loadData();
    buildCascade();
    renderBudgetTable();
    $('btn-load-example').addEventListener('click', loadExampleBudget);
    $('btn-backup').addEventListener('click', doBackup);
    $('btn-restore').addEventListener('click', () => $('input-restore-file').click());
    $('input-restore-file').addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (file) {
        doRestore(file);
        this.value = '';
      }
    });
    $('budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const saup = $('budget-saup').value.trim();
      const hangmok = $('budget-hangmok').value.trim();
      const bimok = $('budget-bimok').value.trim();
      const sanchul = $('budget-sanchul').value.trim();
      const amount = $('budget-amount').value;
      if (!saup || !hangmok || !bimok || !sanchul) {
        alert('세부사업, 세부항목, 원가통계비목, 산출내역을 모두 입력해 주세요.');
        return;
      }
      addBudgetRow({ 세부사업: saup, 세부항목: hangmok, 원가통계비목: bimok, 산출내역: sanchul, 예산현액: amount });
      $('budget-form').reset();
    });
    $('sel-saup').addEventListener('change', onSaupChange);
    $('sel-hangmok').addEventListener('change', onHangmokChange);
    $('sel-bimok').addEventListener('change', onBimokChange);
    $('sel-sanchul').addEventListener('change', onSanchulChange);
    $('input-unit-price').addEventListener('input', recalcTotal);
    $('input-quantity').addEventListener('input', recalcTotal);
    $('expense-form').addEventListener('submit', onSubmit);
    $('btn-cancel-edit').addEventListener('click', clearForm);
    $('filter-budget').addEventListener('change', renderExpenseList);
    renderExpenseList();
    renderFilter();
    const today = new Date().toISOString().slice(0, 10);
    if (!$('input-pumui-date').value) $('input-pumui-date').value = today;
    if (!$('input-purchase-date').value) $('input-purchase-date').value = today;
  }

  init();
})();
