import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsGuWajmtzgaDerLTvSHn_5MuplE-YFo4",
  authDomain: "african-store-app.firebaseapp.com",
  projectId: "african-store-app",
  storageBucket: "african-store-app.firebasestorage.app",
  messagingSenderId: "1020490285113",
  appId: "1:1020490285113:web:c376ce1457ca7414b68de8",
  measurementId: "G-RP6Q9KFY6L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productsRef = collection(db, "products");
const ordersRef = collection(db, "orders");

const BACKEND_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://african-store-api.onrender.com";

let allProducts = [];
let filteredProducts = [];
let cart = loadCart();
let activeCategory = "all";

const productsSection = document.getElementById("productsSection");
const cartItemsEl = document.getElementById("cartItems");
const cartEmptyMessage = document.getElementById("cartEmptyMessage");
const subtotalEl = document.getElementById("subtotal");
const deliveryFeeEl = document.getElementById("deliveryFee");
const totalEl = document.getElementById("total");
const cartCountEl = document.getElementById("cartCount");

const customerNameEl = document.getElementById("customerName");
const customerPhoneEl = document.getElementById("customerPhone");
const customerAddressEl = document.getElementById("customerAddress");
const customerProvinceEl = document.getElementById("customerProvince");
const deliveryMethodEl = document.getElementById("deliveryMethod");
const paymentMethodEl = document.getElementById("paymentMethod");
const orderNotesEl = document.getElementById("orderNotes");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const searchInput = document.getElementById("searchInput");
const categoryFilters = document.getElementById("categoryFilters");
const cartToggleBtn = document.getElementById("cartToggleBtn");
const checkoutSection = document.getElementById("checkoutSection");

function loadCart() {
  try {
    const raw = localStorage.getItem("sewaOnlineCart");
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Could not load cart:", error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem("sewaOnlineCart", JSON.stringify(cart));
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function round2(value) {
  return Number(value || 0).toFixed(2);
}

function setNotice(message, type = "success") {
  const oldBox = document.getElementById("storeNoticeBox");
  if (oldBox) oldBox.remove();

  if (!checkoutSection) return;

  const box = document.createElement("div");
  box.id = "storeNoticeBox";
  box.className = type === "error" ? "error-box" : "notice-box";
  box.textContent = message;

  checkoutSection.appendChild(box);

  setTimeout(() => {
    if (box) box.remove();
  }, 5000);
}

function getDeliveryFee(subtotal, method) {
  if (method !== "delivery") return 0;
  if (subtotal >= 200) return 0;
  return 10;
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 0);
  }, 0);

  const deliveryMethod = deliveryMethodEl?.value || "pickup";
  const deliveryFee = getDeliveryFee(subtotal, deliveryMethod);
  const total = subtotal + deliveryFee;

  if (subtotalEl) subtotalEl.textContent = `$${round2(subtotal)}`;
  if (deliveryFeeEl) deliveryFeeEl.textContent = `$${round2(deliveryFee)}`;
  if (totalEl) totalEl.textContent = `$${round2(total)}`;

  if (cartCountEl) {
    const totalQty = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    cartCountEl.textContent = String(totalQty);
  }

  saveCart();

  return { subtotal, deliveryFee, total };
}

function renderCart() {
  if (!cartItemsEl) return;

  cartItemsEl.innerHTML = "";

  if (!cart.length) {
    if (cartEmptyMessage) cartEmptyMessage.style.display = "block";
    updateCartTotals();
    return;
  }

  if (cartEmptyMessage) cartEmptyMessage.style.display = "none";

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
      <div class="cart-item-left">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-meta">$${round2(item.price)} each</div>
      </div>

      <div class="cart-item-right">
        <div class="qty-controls">
          <button class="qty-btn" data-action="minus" data-id="${item.productId}">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" data-action="plus" data-id="${item.productId}">+</button>
        </div>
        <button class="remove-btn" data-action="remove" data-id="${item.productId}">Remove</button>
      </div>
    `;

    cartItemsEl.appendChild(row);
  });

  updateCartTotals();
}

function addToCart(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  const stock = Number(product.stock || 0);
  const existing = cart.find((item) => item.productId === productId);

  if (existing) {
    if (existing.quantity >= stock) {
      alert("No more stock available for this product.");
      return;
    }

    existing.quantity += 1;
  } else {
    if (stock <= 0) {
      alert("This product is out of stock.");
      return;
    }

    cart.push({
      productId: product.id,
      name: product.name,
      category: product.category || "",
      price: Number(product.price || 0),
      quantity: 1,
      image: product.image || ""
    });
  }

  renderCart();
}

function changeCartQty(productId, action) {
  const cartItem = cart.find((item) => item.productId === productId);
  const product = allProducts.find((p) => p.id === productId);

  if (!cartItem || !product) return;

  if (action === "plus") {
    if (cartItem.quantity < Number(product.stock || 0)) {
      cartItem.quantity += 1;
    } else {
      alert("No more stock available for this product.");
    }
  }

  if (action === "minus") {
    cartItem.quantity -= 1;

    if (cartItem.quantity <= 0) {
      cart = cart.filter((item) => item.productId !== productId);
    }
  }

  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.productId !== productId);
  renderCart();
}

function renderProducts() {
  if (!productsSection) return;

  productsSection.innerHTML = "";

  if (!filteredProducts.length) {
    productsSection.innerHTML = `
      <div class="category-block">
        <h4 class="category-heading">Products</h4>
        <p>No products found.</p>
      </div>
    `;
    return;
  }

  const grouped = {};

  filteredProducts.forEach((product) => {
    const category = product.category || "Other";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(product);
  });

  Object.keys(grouped).forEach((category) => {
    const block = document.createElement("div");
    block.className = "category-block";

    const heading = document.createElement("h4");
    heading.className = "category-heading";
    heading.textContent = category;
    block.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "products-grid";

    grouped[category].forEach((product) => {
      const stock = Number(product.stock || 0);
      const lowStockLevel = Number(product.lowStockLevel || 0);

      const lowStockText =
        stock > 0 && stock <= lowStockLevel
          ? `<div class="stock-badge">Only ${stock} left</div>`
          : "";

      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <img class="product-image" src="${escapeHtml(product.image || "")}" alt="${escapeHtml(product.name || "Product")}" />
        <div class="product-name">${escapeHtml(product.name || "Unnamed Product")}</div>
        <div class="product-price">$${round2(product.price || 0)}</div>
        <div class="product-meta">
          Category: ${escapeHtml(product.category || "Other")}<br>
          In stock: ${stock}
        </div>
        ${lowStockText}
        <button class="add-btn" ${stock <= 0 ? "disabled" : ""} data-id="${product.id}">
          ${stock <= 0 ? "Out of Stock" : "Add to Cart"}
        </button>
      `;

      grid.appendChild(card);
    });

    block.appendChild(grid);
    productsSection.appendChild(block);
  });
}

function applyFilters() {
  const term = (searchInput?.value || "").trim().toLowerCase();

  filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      activeCategory === "all" ||
      String(product.category || "").toLowerCase() === activeCategory.toLowerCase();

    const matchesSearch =
      !term ||
      String(product.name || "").toLowerCase().includes(term) ||
      String(product.category || "").toLowerCase().includes(term);

    return matchesCategory && matchesSearch;
  });

  renderProducts();
}

async function loadProducts() {
  try {
    if (!productsSection) return;

    productsSection.innerHTML = `
      <div class="category-block">
        <h4 class="category-heading">Products</h4>
        <p>Loading products...</p>
      </div>
    `;

    const snapshot = await getDocs(productsRef);

    allProducts = [];

    snapshot.forEach((docSnap) => {
      allProducts.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    allProducts.sort((a, b) => {
      const catA = String(a.category || "").toLowerCase();
      const catB = String(b.category || "").toLowerCase();

      if (catA < catB) return -1;
      if (catA > catB) return 1;

      const nameA = String(a.name || "").toLowerCase();
      const nameB = String(b.name || "").toLowerCase();

      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;

      return 0;
    });

    applyFilters();
  } catch (error) {
    console.error("Could not load products:", error);

    if (productsSection) {
      productsSection.innerHTML = `
        <div class="category-block">
          <h4 class="category-heading">Products</h4>
          <p style="color:red;">Could not load products.</p>
        </div>
      `;
    }
  }
}

function validateOrderForm() {
  if (!cart.length) {
    alert("Your cart is empty.");
    return false;
  }

  if (!customerNameEl?.value.trim()) {
    alert("Please enter your full name.");
    return false;
  }

  if (!customerPhoneEl?.value.trim()) {
    alert("Please enter your phone number.");
    return false;
  }

  const method = deliveryMethodEl?.value || "pickup";

  if (method === "delivery" && !customerAddressEl?.value.trim()) {
    alert("Please enter your delivery address.");
    return false;
  }

  if (paymentMethodEl?.value !== "card_online") {
    alert("Please select Credit / Debit Card Online.");
    return false;
  }

  return true;
}

function buildOrderData() {
  const { subtotal, deliveryFee, total } = updateCartTotals();
  const method = deliveryMethodEl?.value || "pickup";

  return {
    customerName: customerNameEl?.value.trim() || "",
    phone: customerPhoneEl?.value.trim() || "",
    address: method === "delivery" ? (customerAddressEl?.value.trim() || "") : "",
    province: customerProvinceEl?.value.trim() || "Nova Scotia",
    method,
    paymentMethod: "card_online",
    notes: orderNotesEl?.value.trim() || "",
    items: cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      category: item.category || "",
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      image: item.image || ""
    })),
    subtotal,
    deliveryFee,
    total,
    paymentStatus: "awaiting_payment",
    orderStatus: "pending",
    status: "pending",
    createdAt: new Date().toISOString()
  };
}

async function placeCardOrder(orderData) {
  const orderRef = await addDoc(ordersRef, orderData);
  const orderId = orderRef.id;

  try {
    const response = await fetch(`${BACKEND_URL}/create-stripe-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderId,
        customerName: orderData.customerName,
        phone: orderData.phone,
        address: orderData.address,
        province: orderData.province,
        method: orderData.method,
        paymentMethod: orderData.paymentMethod,
        notes: orderData.notes,
        items: orderData.items,
        subtotal: orderData.subtotal,
        deliveryFee: orderData.deliveryFee,
        total: orderData.total
      })
    });

    const data = await response.json();

    if (!response.ok || !data.checkoutUrl) {
      throw new Error(data.error || "Could not start Stripe checkout");
    }

    window.location.href = data.checkoutUrl;
  } catch (error) {
    console.error(error);
    alert("Order was saved, but card checkout could not start.");
    setNotice("Order saved, but card checkout could not start.", "error");
  }
}

async function handlePlaceOrder() {
  if (!validateOrderForm()) return;

  if (!placeOrderBtn) return;

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = "Processing...";

  try {
    const orderData = buildOrderData();
    await placeCardOrder(orderData);
  } catch (error) {
    console.error(error);
    alert("Could not place order.");
    setNotice("Could not place order.", "error");
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = "Place Order";
  }
}

if (productsSection) {
  productsSection.addEventListener("click", (event) => {
    const btn = event.target.closest(".add-btn");
    if (!btn) return;

    const productId = btn.dataset.id;
    if (!productId) return;

    addToCart(productId);
  });
}

if (cartItemsEl) {
  cartItemsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const productId = btn.dataset.id;

    if (!action || !productId) return;

    if (action === "plus" || action === "minus") {
      changeCartQty(productId, action);
    }

    if (action === "remove") {
      removeFromCart(productId);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener("input", applyFilters);
}

if (categoryFilters) {
  categoryFilters.addEventListener("click", (event) => {
    const btn = event.target.closest(".category-btn");
    if (!btn) return;

    document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    activeCategory = btn.dataset.category || "all";
    applyFilters();
  });
}

if (deliveryMethodEl) {
  deliveryMethodEl.addEventListener("change", () => {
    updateCartTotals();
  });
}

if (cartToggleBtn && checkoutSection) {
  cartToggleBtn.addEventListener("click", () => {
    checkoutSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (placeOrderBtn) {
  placeOrderBtn.addEventListener("click", handlePlaceOrder);
}

renderCart();
loadProducts();
