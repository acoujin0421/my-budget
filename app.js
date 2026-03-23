// ★ Vercel 배포 후 이 URL을 본인 API 주소로 바꿔주세요.
const API_URL = "https://my-budget-nine-alpha.vercel.app/api/save";

// 상태
let state = { budgets: [], expenses: [], selectedBudgetId: null, editingExpenseId: null };

// DOM 요소
const budgetNav = document.getElementById("budgetNav");
const addBudgetBtn = document.getElementById("addBudgetBtn");
const dashboardEmpty = document.getElementById("dashboardEmpty");
const dashboardContent = document.getElementById("dashboardContent");
const selectedBudgetTitle = document.getElementById("selectedBudgetTitle");
const totalBudgetEl = document.getElementById("totalBudget");
const totalSpentEl = document.getElementById("totalSpent");
const balanceEl = document.getElementById("balance");
const editBudgetBtn = document.getElementById("editBudgetBtn");
const deleteBudgetBtn = document.getElementById("deleteBudgetBtn");
const expenseLogBody = document.getElementById("expenseLogBody");
const noExpenses = document.getElementById("noExpenses");
const expenseForm = document.getElementById("expenseForm");
const expenseBudgetSelect = document.getElementById("expenseBudgetSelect");
const expenseSubmissionDate = document.getElementById("expenseSubmissionDate");
const expenseDate = document.getElementById("expenseDate");
const expenseDetails = document.getElementById("expenseDetails");
const expenseUnitPrice = document.getElementById("expenseUnitPrice");
const expenseQuantity = document.getElementById("expenseQuantity");
const expenseAmount = document.getElementById("expenseAmount");
const cancelExpenseEdit = document.getElementById("cancelExpenseEdit");
const saveStatus = document.getElementById("saveStatus");
const budgetModal = document.getElementById("budgetModal");
const budgetForm = document.getElementById("budgetForm");
const budgetModalTitle = document.getElementById("budgetModalTitle");
const closeBudgetModal = document.getElementById("closeBudgetModal");

// 유틸
function fmt(n) {
  return "₩ " + (n ?? 0).toLocaleString();
}

function id() {
  return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 예산별 지출 합계
function getSpentByBudget(budgetId) {
  return state.expenses
    .filter((e) => e.budgetId === budgetId)
    .reduce((sum, e) => sum + (e.금액 || 0), 0);
}

// 예산별 잔액
function getBalance(budget) {
  const spent = getSpentByBudget(budget.id);
  return (budget.기정예산 || 0) - spent;
}

// 데이터 로드
async function loadData() {
  try {
    const res = await fetch(`./data.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`로드 실패: ${res.status}`);
    const data = await res.json();
    state.budgets = data.budgets || [];
    state.expenses = data.expenses || [];
    if (state.budgets.length === 0) state.budgets = [];
    if (!Array.isArray(state.expenses)) state.expenses = [];
  } catch (e) {
    saveStatus.textContent = "데이터 로드 실패: " + e.message;
    saveStatus.className = "status error";
    state.budgets = [];
    state.expenses = [];
  }
  render();
}

// GitHub 저장
async function saveToServer() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgets: state.budgets, expenses: state.expenses }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`${res.status} ${msg}`);
    }
    saveStatus.textContent = "저장 완료";
    saveStatus.className = "status success";
    return true;
  } catch (e) {
    saveStatus.textContent = "저장 실패: " + e.message;
    saveStatus.className = "status error";
    return false;
  }
}

// 왼쪽: 예산 목록 렌더
function renderBudgetNav() {
  budgetNav.innerHTML = "";
  state.budgets.forEach((b) => {
    const balance = getBalance(b);
    const name = `${b.세부항목} - ${b.산출내역}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "budget-item" + (state.selectedBudgetId === b.id ? " active" : "");
    btn.dataset.budgetId = b.id;
    btn.innerHTML = `
      <span class="name">${escapeHtml(name)}</span>
      <span class="balance ${balance < 0 ? "negative" : ""}">${fmt(balance)}</span>
    `;
    btn.addEventListener("click", () => selectBudget(b.id));
    budgetNav.appendChild(btn);
  });
}

// 가운데: 대시보드 렌더
function renderDashboard() {
  if (!state.selectedBudgetId) {
    dashboardEmpty.hidden = false;
    dashboardContent.hidden = true;
    return;
  }

  dashboardEmpty.hidden = true;
  dashboardContent.hidden = false;

  const budget = state.budgets.find((b) => b.id === state.selectedBudgetId);
  if (!budget) return;

  const spent = getSpentByBudget(budget.id);
  const balance = getBalance(budget);
  const title = `${budget.세부사업} > ${budget.세부항목} > ${budget.산출내역}`;

  selectedBudgetTitle.textContent = title;
  totalBudgetEl.textContent = fmt(budget.기정예산);
  totalSpentEl.textContent = fmt(spent);
  balanceEl.textContent = fmt(balance);
  balanceEl.className = "value " + (balance < 0 ? "negative" : "");

  const logs = state.expenses
    .filter((e) => e.budgetId === budget.id)
    .sort((a, b) => (b.지출날짜 || "").localeCompare(a.지출날짜 || ""));

  expenseLogBody.innerHTML = "";
  noExpenses.hidden = logs.length > 0;

  logs.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.품의날짜 || "-")}</td>
      <td>${escapeHtml(e.지출날짜 || "-")}</td>
      <td>${escapeHtml(e.구입상세내역 || "-")}</td>
      <td>${fmt(e.단가)}</td>
      <td>${e.수 ?? "-"}</td>
      <td>${fmt(e.금액)}</td>
      <td>
        <button type="button" class="btn-icon btn-edit-expense" data-id="${escapeHtml(e.id)}" title="수정">✎</button>
        <button type="button" class="btn-icon btn-delete-expense" data-id="${escapeHtml(e.id)}" title="삭제">✕</button>
      </td>
    `;
    tr.querySelector(".btn-edit-expense").addEventListener("click", () => editExpense(e.id));
    tr.querySelector(".btn-delete-expense").addEventListener("click", () => deleteExpense(e.id));
    expenseLogBody.appendChild(tr);
  });
}

// 오른쪽: 예산 선택 옵션 렌더
function renderExpenseBudgetSelect() {
  const current = expenseBudgetSelect.value;
  expenseBudgetSelect.innerHTML = '<option value="">-- 예산 선택 --</option>';
  state.budgets.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = `${b.세부항목} - ${b.산출내역}`;
    if (b.id === current || (state.selectedBudgetId === b.id && !current)) opt.selected = true;
    expenseBudgetSelect.appendChild(opt);
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function render() {
  renderBudgetNav();
  renderDashboard();
  renderExpenseBudgetSelect();
}

function selectBudget(id) {
  state.selectedBudgetId = id;
  render();
}

// 지출 폼: 단가×수 → 금액 자동 계산
expenseUnitPrice.addEventListener("input", calcAmount);
expenseQuantity.addEventListener("input", calcAmount);
function calcAmount() {
  const u = Number(expenseUnitPrice.value) || 0;
  const q = Number(expenseQuantity.value) || 1;
  if (u && q) expenseAmount.value = u * q;
}

// 지출 등록/수정
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const budgetId = expenseBudgetSelect.value;
  if (!budgetId) return;

  const item = {
    budgetId,
    품의날짜: expenseSubmissionDate.value,
    지출날짜: expenseDate.value,
    구입상세내역: expenseDetails.value.trim(),
    단가: Number(expenseUnitPrice.value) || 0,
    수: Number(expenseQuantity.value) || 1,
    금액: Number(expenseAmount.value) || 0,
  };

  if (state.editingExpenseId) {
    const idx = state.expenses.findIndex((x) => x.id === state.editingExpenseId);
    if (idx >= 0) {
      state.expenses[idx] = { ...state.expenses[idx], ...item };
    }
    state.editingExpenseId = null;
    cancelExpenseEdit.hidden = true;
  } else {
    state.expenses.push({ id: id(), ...item });
  }

  const ok = await saveToServer();
  if (ok) {
    expenseForm.reset();
    expenseQuantity.value = 1;
  }
  render();
});

// 지출 수정
function editExpense(expenseId) {
  const e = state.expenses.find((x) => x.id === expenseId);
  if (!e) return;
  state.editingExpenseId = expenseId;
  expenseBudgetSelect.value = e.budgetId;
  expenseSubmissionDate.value = e.품의날짜 || "";
  expenseDate.value = e.지출날짜 || "";
  expenseDetails.value = e.구입상세내역 || "";
  expenseUnitPrice.value = e.단가 ?? "";
  expenseQuantity.value = e.수 ?? 1;
  expenseAmount.value = e.금액 ?? "";
  cancelExpenseEdit.hidden = false;
  renderExpenseBudgetSelect();
}

// 지출 삭제
async function deleteExpense(expenseId) {
  if (!confirm("이 지출을 삭제할까요?")) return;
  state.expenses = state.expenses.filter((x) => x.id !== expenseId);
  state.editingExpenseId = null;
  cancelExpenseEdit.hidden = true;
  await saveToServer();
  render();
}

cancelExpenseEdit.addEventListener("click", () => {
  state.editingExpenseId = null;
  cancelExpenseEdit.hidden = true;
  expenseForm.reset();
  render();
});

// 예산 폼 드롭다운(기존 예산 참고) 채우기
function fillBudgetDatalists() {
  const fields = ["세부사업", "세부항목", "원가통계비목", "산출내역"];
  fields.forEach((f) => {
    const listId = "datalist" + f;
    const key = f;
    const values = [...new Set(state.budgets.map((b) => b[key]).filter(Boolean))].sort();
    const dl = document.getElementById(listId);
    dl.innerHTML = "";
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
    });
  });
}

// 예산 추가 모달
addBudgetBtn.addEventListener("click", () => {
  budgetModalTitle.textContent = "예산 추가";
  budgetForm.reset();
  budgetForm.dataset.editId = "";
  fillBudgetDatalists();
  budgetModal.showModal();
});

closeBudgetModal.addEventListener("click", () => budgetModal.close());
budgetModal.addEventListener("click", (e) => {
  if (e.target === budgetModal) budgetModal.close();
});

// 예산 수정
editBudgetBtn.addEventListener("click", () => {
  if (!state.selectedBudgetId) return;
  const b = state.budgets.find((x) => x.id === state.selectedBudgetId);
  if (!b) return;
  budgetModalTitle.textContent = "예산 수정";
  document.getElementById("budget세부사업").value = b.세부사업 || "";
  document.getElementById("budget세부항목").value = b.세부항목 || "";
  document.getElementById("budget원가통계비목").value = b.원가통계비목 || "";
  document.getElementById("budget산출내역").value = b.산출내역 || "";
  document.getElementById("budget기정예산").value = b.기정예산 ?? "";
  budgetForm.dataset.editId = b.id;
  fillBudgetDatalists();
  budgetModal.showModal();
});

// 예산 삭제
deleteBudgetBtn.addEventListener("click", async () => {
  if (!state.selectedBudgetId) return;
  const b = state.budgets.find((x) => x.id === state.selectedBudgetId);
  if (!b) return;
  const count = state.expenses.filter((e) => e.budgetId === b.id).length;
  const msg = count > 0
    ? `이 예산에 연결된 지출 ${count}건도 함께 삭제됩니다. 계속할까요?`
    : "이 예산을 삭제할까요?";
  if (!confirm(msg)) return;
  state.budgets = state.budgets.filter((x) => x.id !== state.selectedBudgetId);
  state.expenses = state.expenses.filter((e) => e.budgetId !== state.selectedBudgetId);
  state.selectedBudgetId = null;
  await saveToServer();
  render();
  budgetModal.close();
});

// 예산 폼 제출
budgetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = budgetForm.dataset.editId;
  const item = {
    세부사업: document.getElementById("budget세부사업").value.trim(),
    세부항목: document.getElementById("budget세부항목").value.trim(),
    원가통계비목: document.getElementById("budget원가통계비목").value.trim(),
    산출내역: document.getElementById("budget산출내역").value.trim(),
    기정예산: Number(document.getElementById("budget기정예산").value) || 0,
  };

  if (editId) {
    const idx = state.budgets.findIndex((x) => x.id === editId);
    if (idx >= 0) state.budgets[idx] = { ...state.budgets[idx], ...item };
  } else {
    state.budgets.push({ id: id(), ...item });
  }

  await saveToServer();
  const msg = editId ? "예산이 수정되었습니다." : "예산이 추가되었습니다.";
  alert(msg);
  budgetModal.close();
  render();
});

// 오늘 날짜 기본값
const today = new Date().toISOString().slice(0, 10);
if (!expenseSubmissionDate.value) expenseSubmissionDate.value = today;
if (!expenseDate.value) expenseDate.value = today;

// 사이드바 리사이즈
const STORAGE_LEFT = "budget-sidebar-left";
const STORAGE_RIGHT = "budget-sidebar-right";
const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 480;
const MIN_RIGHT = 260;
const MAX_RIGHT = 520;

function loadSidebarWidths() {
  try {
    const left = localStorage.getItem(STORAGE_LEFT);
    const right = localStorage.getItem(STORAGE_RIGHT);
    if (left) document.documentElement.style.setProperty("--sidebar-left-width", left + "px");
    if (right) document.documentElement.style.setProperty("--sidebar-right-width", right + "px");
  } catch (_) {}
}

function setupResize(handleId, side) {
  const handle = document.getElementById(handleId);
  const leftBar = document.getElementById("leftSidebar");
  const rightBar = document.getElementById("rightSidebar");

  if (!handle) return;

  let startX = 0;
  let startW = 0;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    const cs = getComputedStyle(document.documentElement);
    if (side === "left") {
      startW = parseInt(cs.getPropertyValue("--sidebar-left-width"), 10) || 300;
    } else {
      startW = parseInt(cs.getPropertyValue("--sidebar-right-width"), 10) || 340;
    }
    handle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(e) {
      const dx = side === "left" ? e.clientX - startX : startX - e.clientX;
      let newW = startW + dx;
      if (side === "left") {
        newW = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, newW));
        document.documentElement.style.setProperty("--sidebar-left-width", newW + "px");
        try { localStorage.setItem(STORAGE_LEFT, String(newW)); } catch (_) {}
      } else {
        newW = Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, newW));
        document.documentElement.style.setProperty("--sidebar-right-width", newW + "px");
        try { localStorage.setItem(STORAGE_RIGHT, String(newW)); } catch (_) {}
      }
    }

    function onUp() {
      handle.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

loadSidebarWidths();
setupResize("resizeLeft", "left");
setupResize("resizeRight", "right");

// 초기화
loadData();
