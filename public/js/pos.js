'use strict';

// Apply saved theme
(function () {
  const saved = localStorage.getItem('pos-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

/* =============================================
   STATE
   ============================================= */
let cart = [];
let selectedCartIndex = -1;
let searchResults = [];
let searchSelectedIndex = -1;
let searchDebounceTimer = null;
let isProcessing = false;

const CURRENCY = window.POS_CONFIG.currencySymbol || '₹';
const AUTO_PRINT = window.POS_CONFIG.autoPrint || false;
const PRINTER_SIZE = window.POS_CONFIG.printerSize || '80mm';
const UNIT_META = window.POS_CONFIG.unitMeta || {};

function getUnitMeta(unit) {
  return UNIT_META[unit] || UNIT_META.pcs || { short: 'pcs', decimal: false, subUnit: null };
}

// Weight/volume products (kg, ltr) are almost always sold in small quantities
// that staff think of in the sub-unit (e.g. "250 g" of rice rather than
// "0.25 kg"). Defaulting the qty field to the sub-unit means a cashier can
// type the number straight off a weighing scale and have it price correctly
// without first touching the unit dropdown.
function getDefaultDisplayUnit(meta) {
  return meta && meta.decimal && meta.subUnit ? 'sub' : 'base';
}

// Round to 3 decimals to avoid floating point drift on weight/volume math
function roundTo(n, places) {
  const factor = Math.pow(10, places);
  return Math.round(n * factor) / factor;
}

// Formats a base-unit qty (e.g. kg) for display, switching to sub-unit for small amounts
function formatQtyLabel(qty, unit) {
  const meta = getUnitMeta(unit);
  const n = Number(qty) || 0;
  if (meta.decimal) {
    if (meta.subUnit && n > 0 && n < 1) {
      return `${Math.round(n * meta.subUnit.factor)} ${meta.subUnit.short}`;
    }
    return `${roundTo(n, 3)} ${meta.short}`;
  }
  return `${n} ${meta.short}`;
}

/* =============================================
   DOM REFS
   ============================================= */
const searchInput    = document.getElementById('posSearchInput');
const searchResults$ = document.getElementById('searchResults');
const cartBody       = document.getElementById('cartBody');
const cartEmpty      = document.getElementById('cartEmpty');
const cartTableWrap  = document.getElementById('cartTableWrap');

const subtotalEl     = document.getElementById('summarySubtotal');
const discountEl     = document.getElementById('summaryDiscount');
const taxEl          = document.getElementById('summaryTax');
const grandTotalEl   = document.getElementById('summaryGrandTotal');

const cashInput      = document.getElementById('cashReceived');
const upiInput       = document.getElementById('upiAmount');
const cardInput      = document.getElementById('cardAmount');
const balanceEl      = document.getElementById('balanceDisplay');

const chargeBtn      = document.getElementById('chargeBtn');
const holdBtn        = document.getElementById('holdBtn');
const clearBtn       = document.getElementById('clearBtn');

const custName       = document.getElementById('customerName');
const custPhone      = document.getElementById('customerPhone');

const heldDrawer     = document.getElementById('heldDrawer');
const heldList       = document.getElementById('heldOrderList');
const drawerOverlay  = document.getElementById('drawerOverlay');

/* =============================================
   SEARCH
   ============================================= */
searchInput.addEventListener('input', function () {
  clearTimeout(searchDebounceTimer);
  const val = this.value.trim();
  if (!val) { hideResults(); return; }
  searchDebounceTimer = setTimeout(() => fetchSearch(val), 180);
});

searchInput.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (searchResults.length > 0) {
      searchSelectedIndex = Math.min(searchSelectedIndex + 1, searchResults.length - 1);
      renderResultsSelection();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchSelectedIndex = Math.max(searchSelectedIndex - 1, 0);
    renderResultsSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (searchResults$.classList.contains('visible') && searchSelectedIndex >= 0) {
      addToCart(searchResults[searchSelectedIndex]);
    } else if (searchResults.length === 1) {
      addToCart(searchResults[0]);
    } else if (searchResults$.classList.contains('visible') && searchResults.length > 0) {
      addToCart(searchResults[0]);
    }
  } else if (e.key === 'Escape') {
    hideResults();
  }
});

async function fetchSearch(query) {
  try {
    const isBarcode = /^\d{4,}$/.test(query);
    const url = isBarcode
      ? `/api/products/search?barcode=${encodeURIComponent(query)}`
      : `/api/products/search?q=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (isBarcode && data.success && data.products.length === 1) {
      addToCart(data.products[0]);
      searchInput.value = '';
      hideResults();
      return;
    }

    searchResults = data.products || [];
    searchSelectedIndex = searchResults.length > 0 ? 0 : -1;
    renderResults();
  } catch (err) {
    console.error('Search error:', err);
  }
}

function renderResults() {
  if (searchResults.length === 0) {
    searchResults$.innerHTML = '<div class="pos-result-item"><div class="pos-result-info"><div class="pos-result-name">No products found</div></div></div>';
    searchResults$.classList.add('visible');
    return;
  }
  searchResults$.innerHTML = searchResults.map((p, i) => {
    const isOut = !p.unlimitedStock && p.stock <= 0;
    const isLow = !p.unlimitedStock && p.stock > 0 && p.stock <= 5;
    const unitShort = getUnitMeta(p.unit).short;
    const stockLabel = p.unlimitedStock ? '∞ In Stock' : isOut ? 'Out of Stock' : isLow ? `Low: ${formatQtyLabel(p.stock, p.unit)}` : `Stock: ${formatQtyLabel(p.stock, p.unit)}`;
    const stockClass = isOut ? 'out-of-stock' : isLow ? 'low-stock' : '';
    return `<div class="pos-result-item${i === searchSelectedIndex ? ' selected' : ''}" data-idx="${i}">
      <div class="pos-result-info">
        <div class="pos-result-name">${escHtml(p.name)}</div>
        <div class="pos-result-meta">${escHtml(p.barcode)} · ${escHtml(p.sku)}</div>
      </div>
      <div class="pos-result-right">
        <div class="pos-result-price">${CURRENCY}${p.sellingPrice.toFixed(2)} / ${unitShort}</div>
        <div class="pos-result-stock ${stockClass}">${stockLabel}</div>
      </div>
    </div>`;
  }).join('');
  searchResults$.classList.add('visible');

  searchResults$.querySelectorAll('.pos-result-item').forEach((el, i) => {
    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      addToCart(searchResults[i]);
    });
    el.addEventListener('mouseover', function () {
      searchSelectedIndex = i;
      renderResultsSelection();
    });
  });
}

function renderResultsSelection() {
  searchResults$.querySelectorAll('.pos-result-item').forEach((el, i) => {
    el.classList.toggle('selected', i === searchSelectedIndex);
  });
}

function hideResults() {
  searchResults$.classList.remove('visible');
  searchResults = [];
  searchSelectedIndex = -1;
}

/* =============================================
   CART
   ============================================= */
function addToCart(product) {
  if (!product.unlimitedStock && product.stock <= 0) {
    showToast('Out of stock: ' + product.name, 'danger');
    return;
  }

  const unit = product.unit || 'pcs';
  const meta = getUnitMeta(unit);

  const existing = cart.findIndex((i) => i.productId === product._id);
  if (existing >= 0) {
    const item = cart[existing];
    const step = meta.decimal ? 1 : 1; // scanning again adds 1 base unit either way
    const newQty = roundTo(item.qty + step, 3);
    if (!product.unlimitedStock && newQty > product.stock) {
      showToast(`Max stock reached for ${product.name}`, 'warning');
      return;
    }
    item.qty = newQty;
    selectedCartIndex = existing;
  } else {
    cart.push({
      productId: product._id,
      name: product.name,
      barcode: product.barcode,
      sku: product.sku,
      unit,
      unitPrice: product.sellingPrice,
      qty: 1,
      displayUnit: getDefaultDisplayUnit(meta),
      discount: 0,
      taxPercent: product.taxPercent || 0,
      stock: product.stock,
      unlimitedStock: product.unlimitedStock
    });
    selectedCartIndex = cart.length - 1;
  }

  searchInput.value = '';
  hideResults();
  renderCart();
  updateTotals();
  searchInput.focus();
}

function renderCart() {
  if (cart.length === 0) {
    cartEmpty.style.display = 'flex';
    cartTableWrap.style.display = 'none';
    return;
  }
  cartEmpty.style.display = 'none';
  cartTableWrap.style.display = 'block';

  cartBody.innerHTML = cart.map((item, i) => {
    const lineTotal = calcLineTotal(item);
    const meta = getUnitMeta(item.unit);
    return `<tr class="cart-row${i === selectedCartIndex ? ' cart-row-selected' : ''}" data-idx="${i}">
      <td>
        <div class="cart-product-name">${escHtml(item.name)}</div>
        <div class="cart-product-meta">${escHtml(item.barcode)}</div>
      </td>
      <td>
        ${renderQtyCell(item, i, meta)}
      </td>
      <td style="font-family:var(--font-mono)">${CURRENCY}${item.unitPrice.toFixed(2)}<span class="qty-unit-label"> /${meta.short}</span></td>
      <td>
        <input class="cart-discount-input" type="number" min="0" value="${item.discount}"
          placeholder="0"
          data-action="discount"
          tabindex="-1" />
      </td>
      <td class="cart-line-total" id="lineTotal-${i}">${CURRENCY}${lineTotal.toFixed(2)}</td>
      <td>
        <button class="btn-delete-row" data-action="remove-row" tabindex="-1">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// Highlights the active cart row without rebuilding the table — rebuilding
// on focus was replacing the input the user had just clicked into, which
// silently ate their keystrokes. This just toggles a class instead.
function selectCartRow(idx) {
  selectedCartIndex = idx;
  cartBody.querySelectorAll('.cart-row').forEach((tr) => {
    tr.classList.toggle('cart-row-selected', Number(tr.dataset.idx) === idx);
  });
}

// Updates just the line-total cell + order summary while the user is still
// typing, without touching the input's DOM node (so focus/cursor survive).
function previewLineTotal(idx) {
  const item = cart[idx];
  if (!item) return;
  const cell = document.getElementById(`lineTotal-${idx}`);
  if (cell) cell.textContent = `${CURRENCY}${calcLineTotal(item).toFixed(2)}`;
  updateTotals();
}

function previewWeightQty(idx, val) {
  const item = cart[idx];
  if (!item) return;
  const meta = getUnitMeta(item.unit);
  const displayUnit = item.displayUnit || 'base';
  const amount = parseFloat(val);
  if (!isNaN(amount) && amount >= 0) {
    item.qty = displayUnit === 'sub' && meta.subUnit ? amount / meta.subUnit.factor : amount;
  }
  previewLineTotal(idx);
}

function previewQty(idx, val) {
  const item = cart[idx];
  if (!item) return;
  const amount = parseInt(val, 10);
  if (!isNaN(amount) && amount >= 0) item.qty = amount;
  previewLineTotal(idx);
}

function previewDiscount(idx, val) {
  const item = cart[idx];
  if (!item) return;
  const amount = parseFloat(val);
  item.discount = isNaN(amount) ? 0 : Math.max(0, amount);
  previewLineTotal(idx);
}

function renderQtyCell(item, i, meta) {
  if (meta.decimal && meta.subUnit) {
    const displayUnit = item.displayUnit || 'base';
    const factor = meta.subUnit ? meta.subUnit.factor : 1;
    const shownAmount = displayUnit === 'sub' ? roundTo(item.qty * factor, 0) : roundTo(item.qty, 3);
    const step = displayUnit === 'sub' ? 1 : 0.001;
    return `<div class="qty-control weight-qty">
        <button class="qty-btn" data-action="qty-dec" tabindex="-1">−</button>
        <input class="qty-input" type="number" min="0" step="${step}" value="${shownAmount}"
          data-action="qty-weight"
          tabindex="-1" />
        <button class="qty-btn" data-action="qty-inc" tabindex="-1">+</button>
        <select class="qty-unit-select" data-action="qty-unit" tabindex="-1">
          <option value="base" ${displayUnit === 'base' ? 'selected' : ''}>${meta.short}</option>
          <option value="sub" ${displayUnit === 'sub' ? 'selected' : ''}>${meta.subUnit.short}</option>
        </select>
      </div>`;
  }
  return `<div class="qty-control">
      <button class="qty-btn" data-action="qty-dec" tabindex="-1">−</button>
      <input class="qty-input" type="number" min="1" value="${item.qty}"
        data-action="qty-plain"
        tabindex="-1" />
      <button class="qty-btn" data-action="qty-inc" tabindex="-1">+</button>
      <span class="qty-unit-label">${meta.short}</span>
    </div>`;
}

function calcLineTotal(item) {
  const base = item.unitPrice * item.qty - (item.discount || 0);
  const tax = base * (item.taxPercent || 0) / 100;
  return Math.max(0, base + tax);
}

function changeQty(idx, delta) {
  const item = cart[idx];
  if (!item) return;
  const meta = getUnitMeta(item.unit);
  let newQty;
  if (meta.decimal) {
    const displayUnit = item.displayUnit || 'base';
    const step = displayUnit === 'sub' && meta.subUnit ? (1 / meta.subUnit.factor) : 0.1;
    newQty = roundTo(item.qty + delta * step, 3);
  } else {
    newQty = item.qty + delta;
  }
  if (newQty < (meta.decimal ? 0.001 : 1)) { removeFromCart(idx); return; }
  if (!item.unlimitedStock && newQty > item.stock) {
    showToast('Insufficient stock', 'warning'); return;
  }
  item.qty = newQty;
  selectedCartIndex = idx;
  renderCart();
  updateTotals();
}

function setQty(idx, val) {
  const item = cart[idx];
  if (!item) return;
  const qty = Math.max(1, parseInt(val, 10) || 1);
  if (!item.unlimitedStock && qty > item.stock) {
    showToast('Insufficient stock', 'warning');
    item.qty = item.stock;
  } else {
    item.qty = qty;
  }
  selectedCartIndex = idx;
  renderCart();
  updateTotals();
}

// Sets qty for weight/volume items, interpreting the typed amount in whichever
// unit (base or sub) is currently selected for that row, e.g. "500" + "g" -> 0.5 kg
function setWeightQty(idx, val) {
  const item = cart[idx];
  if (!item) return;
  const meta = getUnitMeta(item.unit);
  const displayUnit = item.displayUnit || 'base';
  const amount = Math.max(0, parseFloat(val) || 0);
  let newQty = displayUnit === 'sub' && meta.subUnit ? amount / meta.subUnit.factor : amount;
  newQty = roundTo(newQty, 3);

  if (newQty <= 0) { removeFromCart(idx); return; }
  if (!item.unlimitedStock && newQty > item.stock) {
    showToast('Insufficient stock', 'warning');
    newQty = roundTo(item.stock, 3);
  }
  item.qty = newQty;
  selectedCartIndex = idx;
  renderCart();
  updateTotals();
}

// Switches which unit (base e.g. kg, or sub e.g. g) the qty input displays/accepts for this row
function setDisplayUnit(idx, val) {
  const item = cart[idx];
  if (!item) return;
  item.displayUnit = val === 'sub' ? 'sub' : 'base';
  selectedCartIndex = idx;
  renderCart();
}

function setDiscount(idx, val) {
  const item = cart[idx];
  if (!item) return;
  item.discount = Math.max(0, parseFloat(val) || 0);
  renderCart();
  updateTotals();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  if (selectedCartIndex >= cart.length) selectedCartIndex = cart.length - 1;
  renderCart();
  updateTotals();
}

// All cart-row interactions (qty +/-, qty typing, unit switch, discount
// typing, row delete, row selection) are wired here via delegation instead
// of inline HTML event attributes, since the app's CSP (script-src-attr:
// 'none') blocks onclick/oninput/onchange/onfocus attributes outright.
function getRowIndex(el) {
  const row = el.closest('.cart-row');
  return row ? Number(row.dataset.idx) : -1;
}

cartBody.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-action="qty-inc"], [data-action="qty-dec"], [data-action="remove-row"]');
  if (!btn) return;
  const idx = getRowIndex(btn);
  if (idx < 0) return;
  const action = btn.dataset.action;
  if (action === 'qty-inc') changeQty(idx, 1);
  else if (action === 'qty-dec') changeQty(idx, -1);
  else if (action === 'remove-row') removeFromCart(idx);
});

cartBody.addEventListener('input', function (e) {
  const target = e.target;
  const idx = getRowIndex(target);
  if (idx < 0) return;
  if (target.dataset.action === 'qty-weight') previewWeightQty(idx, target.value);
  else if (target.dataset.action === 'qty-plain') previewQty(idx, target.value);
  else if (target.dataset.action === 'discount') previewDiscount(idx, target.value);
});

cartBody.addEventListener('change', function (e) {
  const target = e.target;
  const idx = getRowIndex(target);
  if (idx < 0) return;
  if (target.dataset.action === 'qty-weight') setWeightQty(idx, target.value);
  else if (target.dataset.action === 'qty-plain') setQty(idx, target.value);
  else if (target.dataset.action === 'discount') setDiscount(idx, target.value);
  else if (target.dataset.action === 'qty-unit') setDisplayUnit(idx, target.value);
});

// 'focus' does not bubble, so use 'focusin' to catch focus on any
// qty/discount input inside a delegated row without rebuilding the DOM.
cartBody.addEventListener('focusin', function (e) {
  const target = e.target;
  if (target.tagName !== 'INPUT') return;
  const idx = getRowIndex(target);
  if (idx >= 0) selectCartRow(idx);
});

/* =============================================
   TOTALS
   ============================================= */
function updateTotals() {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;
  cart.forEach((item) => {
    const base = item.unitPrice * item.qty;
    const disc = item.discount || 0;
    const tax = (base - disc) * (item.taxPercent || 0) / 100;
    subtotal += base;
    discountTotal += disc;
    taxTotal += tax;
  });
  const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);

  subtotalEl.textContent = CURRENCY + subtotal.toFixed(2);
  discountEl.textContent = '- ' + CURRENCY + discountTotal.toFixed(2);
  taxEl.textContent = CURRENCY + taxTotal.toFixed(2);
  grandTotalEl.textContent = CURRENCY + grandTotal.toFixed(2);

  updateBalance(grandTotal);
  chargeBtn.disabled = cart.length === 0;
}

function getGrandTotal() {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;
  cart.forEach((item) => {
    const base = item.unitPrice * item.qty;
    const disc = item.discount || 0;
    subtotal += base;
    discountTotal += disc;
    taxTotal += (base - disc) * (item.taxPercent || 0) / 100;
  });
  return Math.max(0, subtotal - discountTotal + taxTotal);
}

/* =============================================
   PAYMENT
   ============================================= */
const payTabs = document.querySelectorAll('.pay-tab');
let activePayMethod = 'cash';

payTabs.forEach((tab) => {
  tab.addEventListener('click', function () {
    activePayMethod = this.dataset.method;
    payTabs.forEach((t) => t.classList.remove('active'));
    this.classList.add('active');
    updatePaymentFields();
    updateBalance(getGrandTotal());
  });
});

function updatePaymentFields() {
  const show = (el, visible) => { if (el) el.closest('.payment-input-group').style.display = visible ? '' : 'none'; };
  const cashGrp  = cashInput  ? cashInput.closest('.payment-input-group')  : null;
  const upiGrp   = upiInput   ? upiInput.closest('.payment-input-group')   : null;
  const cardGrp  = cardInput  ? cardInput.closest('.payment-input-group')  : null;

  if (cashGrp)  cashGrp.style.display  = (activePayMethod === 'cash' || activePayMethod === 'mixed') ? '' : 'none';
  if (upiGrp)   upiGrp.style.display   = (activePayMethod === 'upi'  || activePayMethod === 'mixed') ? '' : 'none';
  if (cardGrp)  cardGrp.style.display  = (activePayMethod === 'card' || activePayMethod === 'mixed') ? '' : 'none';
}

[cashInput, upiInput, cardInput].forEach((inp) => {
  if (inp) inp.addEventListener('input', () => updateBalance(getGrandTotal()));
});

function updateBalance(grandTotal) {
  const cash = parseFloat(cashInput?.value) || 0;
  const upi  = parseFloat(upiInput?.value)  || 0;
  const card = parseFloat(cardInput?.value) || 0;
  let received = 0;
  if (activePayMethod === 'cash')  received = cash;
  if (activePayMethod === 'upi')   received = upi;
  if (activePayMethod === 'card')  received = card;
  if (activePayMethod === 'mixed') received = cash + upi + card;

  const balance = received - grandTotal;
  balanceEl.textContent = CURRENCY + Math.abs(balance).toFixed(2);
  balanceEl.className = 'balance-value ' + (balance >= 0 ? 'positive' : 'negative');
  if (balance < 0) {
    balanceEl.textContent = '- ' + CURRENCY + Math.abs(balance).toFixed(2);
  }
}

/* =============================================
   CHARGE / BILLING
   ============================================= */
chargeBtn.addEventListener('click', processBill);

async function processBill() {
  if (isProcessing || cart.length === 0) return;

  const grandTotal = getGrandTotal();
  const cash  = parseFloat(cashInput?.value)  || 0;
  const upi   = parseFloat(upiInput?.value)   || 0;
  const card  = parseFloat(cardInput?.value)  || 0;

  // Validate payment amount
  let totalPaid = 0;
  if (activePayMethod === 'cash')  totalPaid = cash;
  if (activePayMethod === 'upi')   totalPaid = upi;
  if (activePayMethod === 'card')  totalPaid = card;
  if (activePayMethod === 'mixed') totalPaid = cash + upi + card;

  if (totalPaid < grandTotal - 0.01) {
    showToast('Payment amount is less than the total', 'danger');
    return;
  }

  isProcessing = true;
  chargeBtn.disabled = true;
  chargeBtn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const payload = {
      items: cart.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        discount: i.discount || 0
      })),
      customerName: custName?.value?.trim() || '',
      customerPhone: custPhone?.value?.trim() || '',
      paymentMethod: activePayMethod,
      paymentDetails: {
        cashReceived: cash,
        upiAmount: upi,
        cardAmount: card,
        balance: totalPaid - grandTotal
      }
    };

    const res = await fetch('/billing/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      showToast(`Bill ${data.invoiceNo} created!`, 'success');
      clearCartState();
      openReceipt(data.billId);
    } else {
      showToast(data.message || 'Billing failed', 'danger');
    }
  } catch (err) {
    showToast('Network error. Please retry.', 'danger');
  } finally {
    isProcessing = false;
    chargeBtn.disabled = false;
    chargeBtn.innerHTML = '<i class="bi bi-check-circle"></i> Charge';
  }
}

function openReceipt(billId) {
  const size = PRINTER_SIZE === '58mm' ? '58mm' : '80mm';
  const url = `/billing/${billId}/print/${size}`;
  if (AUTO_PRINT) {
    const win = window.open(url, '_blank', 'width=400,height=700');
    if (win) {
      win.onload = function () { win.focus(); win.print(); };
    }
  } else {
    window.open(url, '_blank', 'width=400,height=700');
  }
}

/* =============================================
   HOLD / CLEAR / RESUME
   ============================================= */
holdBtn.addEventListener('click', holdOrder);
clearBtn.addEventListener('click', clearCartConfirm);

async function holdOrder() {
  if (cart.length === 0) { showToast('Cart is empty', 'warning'); return; }

  const label = prompt('Hold label (optional):', `Hold ${new Date().toLocaleTimeString()}`) || '';

  const payload = {
    items: cart,
    customerName: custName?.value?.trim() || '',
    customerPhone: custPhone?.value?.trim() || '',
    holdLabel: label
  };

  try {
    const res = await fetch('/pos/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Order held', 'success');
      clearCartState();
    } else {
      showToast(data.message, 'danger');
    }
  } catch (err) {
    showToast('Failed to hold order', 'danger');
  }
}

function clearCartConfirm() {
  if (cart.length === 0) return;
  if (confirm('Clear entire cart?')) clearCartState();
}

function clearCartState() {
  cart = [];
  selectedCartIndex = -1;
  if (custName)  custName.value  = '';
  if (custPhone) custPhone.value = '';
  if (cashInput) cashInput.value = '';
  if (upiInput)  upiInput.value  = '';
  if (cardInput) cardInput.value = '';
  renderCart();
  updateTotals();
  searchInput.focus();
}

/* =============================================
   HELD ORDERS DRAWER
   ============================================= */
document.getElementById('heldOrdersBtn')?.addEventListener('click', openHeldDrawer);

async function openHeldDrawer() {
  try {
    const res = await fetch('/pos/held');
    const data = await res.json();
    renderHeldList(data.heldOrders || []);
  } catch (e) {}
  heldDrawer.classList.add('open');
  drawerOverlay.classList.add('visible');
}

function closeHeldDrawer() {
  heldDrawer.classList.remove('open');
  drawerOverlay.classList.remove('visible');
}

drawerOverlay.addEventListener('click', closeHeldDrawer);
document.getElementById('closeHeldDrawer')?.addEventListener('click', closeHeldDrawer);

function renderHeldList(orders) {
  if (orders.length === 0) {
    heldList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:0.875rem">No held orders</p>';
    return;
  }
  heldList.innerHTML = orders.map((o) => `
    <div class="held-order-card" data-id="${o._id}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="held-order-label">${escHtml(o.holdLabel || 'Held Order')}</div>
          <div class="held-order-meta">${o.items.length} item${o.items.length !== 1 ? 's' : ''} · ${o.customerName || 'No customer'}</div>
          <div class="held-order-meta" style="margin-top:2px">${new Date(o.createdAt).toLocaleTimeString()}</div>
        </div>
        <button class="btn-delete-held" data-action="delete-held" data-id="${o._id}" style="background:transparent;border:none;color:var(--danger);cursor:pointer;padding:4px;font-size:1rem">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    </div>
  `).join('');

  heldList.querySelectorAll('.held-order-card').forEach((card) => {
    card.addEventListener('click', async function (e) {
      if (e.target.closest('[data-action="delete-held"]')) return;
      const id = this.dataset.id;
      await resumeHeldOrder(id);
      closeHeldDrawer();
    });
  });

  heldList.querySelectorAll('[data-action="delete-held"]').forEach((btn) => {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      const id = this.dataset.id;
      if (!confirm('Delete this held order?')) return;
      await fetch(`/pos/held/${id}`, { method: 'DELETE' });
      openHeldDrawer();
    });
  });
}

async function resumeHeldOrder(id) {
  try {
    const res = await fetch(`/pos/held/${id}`);
    const data = await res.json();
    if (!data.success) { showToast('Could not load held order', 'danger'); return; }

    const held = data.heldOrder;

    if (cart.length > 0) {
      if (!confirm('This will replace the current cart. Continue?')) return;
    }

    cart = held.items.map((item) => {
      const unit = item.unit || (item.product && item.product.unit) || 'pcs';
      return {
        productId: item.product._id || item.product,
        name: item.name,
        barcode: item.barcode || '',
        sku: item.sku || '',
        unit,
        unitPrice: item.unitPrice,
        qty: item.qty,
        displayUnit: getDefaultDisplayUnit(getUnitMeta(unit)),
        discount: item.discount || 0,
        taxPercent: item.taxPercent || 0,
        stock: item.product.stock || 0,
        unlimitedStock: item.product.unlimitedStock || false
      };
    });

    if (custName && held.customerName)  custName.value  = held.customerName;
    if (custPhone && held.customerPhone) custPhone.value = held.customerPhone;

    renderCart();
    updateTotals();
    showToast('Order resumed', 'success');

    // Delete the held order since it's back in cart
    await fetch(`/pos/held/${id}`, { method: 'DELETE' });
  } catch (err) {
    showToast('Failed to resume order', 'danger');
  }
}

/* =============================================
   KEYBOARD SHORTCUTS
   ============================================= */
document.addEventListener('keydown', function (e) {
  // F2 — focus search
  if (e.key === 'F2') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  // F3 — held orders
  if (e.key === 'F3') { e.preventDefault(); openHeldDrawer(); }
  // F4 — hold current order
  if (e.key === 'F4') { e.preventDefault(); holdOrder(); }
  // F8 — clear cart
  if (e.key === 'F8') { e.preventDefault(); clearCartConfirm(); }
  // F10 — charge (process bill)
  if (e.key === 'F10') { e.preventDefault(); processBill(); }
  // Delete key when cart row is selected
  if (e.key === 'Delete' && document.activeElement === searchInput && selectedCartIndex >= 0 && searchInput.value === '') {
    removeFromCart(selectedCartIndex);
  }
  // +/- when search is focused for selected row qty
  if (e.key === '+' && document.activeElement === searchInput && selectedCartIndex >= 0) {
    e.preventDefault(); changeQty(selectedCartIndex, 1);
  }
  if (e.key === '-' && document.activeElement === searchInput && selectedCartIndex >= 0) {
    e.preventDefault(); changeQty(selectedCartIndex, -1);
  }
  // Arrow keys to move through cart
  if (e.key === 'ArrowDown' && document.activeElement === searchInput && !searchResults$.classList.contains('visible')) {
    e.preventDefault();
    if (selectedCartIndex < cart.length - 1) { selectedCartIndex++; renderCart(); }
  }
  if (e.key === 'ArrowUp' && document.activeElement === searchInput && !searchResults$.classList.contains('visible')) {
    e.preventDefault();
    if (selectedCartIndex > 0) { selectedCartIndex--; renderCart(); }
  }
});

/* =============================================
   THEME
   ============================================= */
document.getElementById('posThemeToggle')?.addEventListener('click', function () {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pos-theme', next);
});

/* =============================================
   UTILITIES
   ============================================= */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const el = document.createElement('div');
  el.className = `pos-toast pos-toast-${type}`;
  el.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'x-circle' : 'info-circle'}"></i> ${msg}`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toastContainer';
  el.className = 'pos-toast-container';
  document.body.appendChild(el);
  return el;
}

/* Init */
document.addEventListener('DOMContentLoaded', function () {
  updatePaymentFields();
  updateTotals();
  searchInput.focus();
});