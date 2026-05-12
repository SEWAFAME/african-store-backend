import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// REPLACE THIS WITH YOUR REAL FIREBASE CONFIG
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
const storage = getStorage(app);

const customersRef = collection(db, "customers");
const productsRef = collection(db, "products");
const ordersRef = collection(db, "orders");

const POINTS_PER_DOLLAR = 1;
const REWARD_POINTS = 100;
const REWARD_VALUE = 5;
const ADMIN_PIN = "1234";

let isAdminMode = false;
let selectedProductForSale = null;
let onlineOrderFilter = "all";

window.showLogin = function () {
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("adminPinInput").value = "";
};

window.hideLogin = function () {
  document.getElementById("loginModal").classList.add("hidden");
};

window.loginAdmin = function () {
  const pin = document.getElementById("adminPinInput").value.trim();

  if (pin === ADMIN_PIN) {
    isAdminMode = true;
    updateRoleUI();
    hideLogin();
    loadCustomers();
    loadProducts();
    loadOrders();
    alert("Admin mode enabled.");
  } else {
    alert("Wrong PIN.");
  }
};

window.logoutAdmin = function () {
  isAdminMode = false;
  updateRoleUI();
  loadCustomers();
  loadProducts();
  loadOrders();
};

function updateRoleUI() {
  const roleBadge = document.getElementById("roleBadge");
  const backupSection = document.getElementById("backupSection");
  const productFormSection = document.getElementById("productFormSection");

  if (isAdminMode) {
    if (roleBadge) roleBadge.textContent = "Mode: Admin";
    if (backupSection) backupSection.classList.remove("hidden-admin");
    if (productFormSection) productFormSection.classList.remove("hidden-admin");
  } else {
    if (roleBadge) roleBadge.textContent = "Mode: Staff";
    if (backupSection) backupSection.classList.add("hidden-admin");
    if (productFormSection) productFormSection.classList.add("hidden-admin");
  }
}

async function uploadImage(file) {
  if (!file) return "";

  const fileName = `products/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, fileName);

  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

function round2(value) {
  return Number(value).toFixed(2);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeTemplate(str) {
  return String(str).replaceAll("`", "\\`");
}

function escapeJsString(str) {
  return String(str).replaceAll("'", "\\'");
}
window.addCustomer = async function () {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const points = parseFloat(document.getElementById("points").value) || 0;

  if (!name || !phone) {
    alert("Please enter customer name and phone number.");
    return;
  }

  await addDoc(customersRef, {
    name,
    phone,
    points,
    totalSpent: 0,
    totalProfit: 0,
    history: [],
    createdAt: new Date().toISOString()
  });

  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("points").value = "";

  await loadCustomers();
  await loadDashboard();
};

window.addProduct = async function (event) {
  if (!isAdminMode) {
    alert("Only admin can add products.");
    return;
  }

  const addButton = event?.target;
  if (addButton) addButton.disabled = true;

  try {
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value.trim();
    const price = parseFloat(document.getElementById("productPrice").value);
    const cost = parseFloat(document.getElementById("productCost").value);
    const stock = parseInt(document.getElementById("productStock").value);
    const lowStockLevel = parseInt(document.getElementById("productLowStock").value);
    const imageFile = document.getElementById("productImage").files[0];

    if (!name || !category || isNaN(price) || isNaN(cost) || isNaN(stock) || isNaN(lowStockLevel)) {
      alert("Please fill all product fields correctly.");
      return;
    }

    let image = "";
    if (imageFile) {
      image = await uploadImage(imageFile);
    }

    await addDoc(productsRef, {
      name,
      category,
      price,
      cost,
      stock,
      lowStockLevel,
      image,
      createdAt: new Date().toISOString()
    });

    document.getElementById("productName").value = "";
    document.getElementById("productCategory").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productCost").value = "";
    document.getElementById("productStock").value = "";
    document.getElementById("productLowStock").value = "";
    document.getElementById("productImage").value = "";

    await loadProducts();
    await loadDashboard();

    alert("Product added successfully.");
  } catch (error) {
    console.error(error);
    alert("Could not add product.");
  } finally {
    if (addButton) addButton.disabled = false;
  }
};

async function loadCustomers() {
  const snapshot = await getDocs(customersRef);
  const customerList = document.getElementById("customerList");
  if (!customerList) return;

  customerList.innerHTML = "";

  if (snapshot.empty) {
    customerList.innerHTML = `<p class="empty-state">No customers yet.</p>`;
    return;
  }

  snapshot.forEach((docSnap) => {
    const customer = docSnap.data();
    const id = docSnap.id;

    const history = customer.history || [];
    let calculatedSpent = 0;

    history.forEach((purchase) => {
      calculatedSpent += Number(purchase.amount || purchase.purchaseAmount || 0);
    });

    const totalSpent = Number(customer.totalSpent || 0) > 0
      ? Number(customer.totalSpent || 0)
      : calculatedSpent;

    const rewardCount = Math.floor(Number(customer.points || 0) / REWARD_POINTS);
    const rewardText =
      rewardCount > 0
        ? `Eligible reward: ${rewardCount} x $${REWARD_VALUE} off`
        : `${REWARD_POINTS - Number(customer.points || 0)} more pts to earn $${REWARD_VALUE} off`;

    const deleteButton = isAdminMode
      ? `<button onclick="deleteCustomer('${id}')">Delete</button>`
      : "";

    const redeemButton = Number(customer.points || 0) >= REWARD_POINTS
      ? `<button onclick="redeemReward('${id}')">Redeem $${REWARD_VALUE}</button>`
      : "";

    const card = document.createElement("div");
    card.className = "customer-card";

    card.innerHTML = `
      <div class="customer-name">${escapeHtml(customer.name)}</div>
      <div class="customer-info">${escapeHtml(customer.phone)}</div>
      <div class="customer-info customer-spent">Total Spent: $${round2(totalSpent)}</div>
      <div class="reward-status">${rewardText}</div>
      <div class="points-badge">${round2(customer.points || 0)} pts</div>

      <div class="customer-actions">
        <button onclick="addPoints('${id}', ${customer.points || 0})">+10</button>
        <button onclick="addPurchase('${id}')">Add Purchase</button>
        <button onclick="viewHistory('${id}')">History</button>
        <button onclick="editCustomer('${id}', \`${escapeTemplate(customer.name)}\`, \`${escapeTemplate(customer.phone)}\`)">Edit</button>
        ${redeemButton}
        ${deleteButton}
        <button onclick="sendWhatsApp('${escapeJsString(customer.phone)}', '${escapeJsString(customer.name)}', ${customer.points || 0}, 'points')">WhatsApp</button>
        <button onclick="sendWhatsApp('${escapeJsString(customer.phone)}', '${escapeJsString(customer.name)}', ${customer.points || 0}, 'promo')">Promo</button>
      </div>
    `;

    customerList.appendChild(card);
  });
}

async function loadProducts() {
  const snapshot = await getDocs(productsRef);
  const productList = document.getElementById("productList");
  const lowStockList = document.getElementById("lowStockList");

  if (!productList || !lowStockList) return;

  productList.innerHTML = "";
  lowStockList.innerHTML = "";

  let lowStockFound = false;

  if (snapshot.empty) {
    productList.innerHTML = `<p class="empty-state">No products yet.</p>`;
    lowStockList.innerHTML = `<p>No low stock items.</p>`;
    return;
  }

  snapshot.forEach((docSnap) => {
    const product = docSnap.data();
    const id = docSnap.id;
    const isLowStock = Number(product.stock || 0) <= Number(product.lowStockLevel || 0);

    const deleteButton = isAdminMode
      ? `<button onclick="deleteProduct('${id}')">Delete</button>`
      : "";

    const productCard = document.createElement("div");
    productCard.className = `product-card ${isLowStock ? "low-stock" : ""}`;

    productCard.innerHTML = `
      ${product.image ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-image">` : ""}
      <div class="product-name">${escapeHtml(product.name)}</div>
      <div class="product-info">Category: ${escapeHtml(product.category || "")}</div>
      <div class="product-info">Selling Price: $${round2(product.price || 0)}</div>
      <div class="product-info">Cost Price: $${round2(product.cost || 0)}</div>
      <div class="product-info">Stock: ${product.stock || 0}</div>
      <div class="product-info">Low Stock Level: ${product.lowStockLevel || 0}</div>

      <div class="product-actions">
        <button onclick="openSellProductModal('${id}')">Sell Product</button>
        <button onclick="restockProduct('${id}', ${product.stock || 0})">Restock</button>
        <button onclick="editProduct('${id}')">Edit</button>
        ${deleteButton}
      </div>
    `;

    productList.appendChild(productCard);

    if (isLowStock) {
      lowStockFound = true;

      const lowStockItem = document.createElement("div");
      lowStockItem.className = "sale-item";
      lowStockItem.innerHTML = `
        <div class="sale-main">${escapeHtml(product.name)}</div>
        <div class="sale-sub">Stock: ${product.stock || 0} | Low-stock level: ${product.lowStockLevel || 0}</div>
      `;
      lowStockList.appendChild(lowStockItem);
    }
  });

  if (!lowStockFound) {
    lowStockList.innerHTML = `<p>No low stock items.</p>`;
  }
}

window.openSellProductModal = async function (productId) {
  const productSnap = await getDoc(doc(db, "products", productId));
  if (!productSnap.exists()) {
    alert("Product not found.");
    return;
  }

  const product = productSnap.data();
  selectedProductForSale = {
    id: productId,
    ...product
  };

  if (Number(product.stock || 0) <= 0) {
    alert("This product is out of stock.");
    return;
  }

  document.getElementById("sellProductName").textContent =
    `${product.name} - $${round2(product.price || 0)} each - Stock: ${product.stock || 0}`;

  const select = document.getElementById("sellCustomerSelect");
  select.innerHTML = `<option value="">Select Customer</option>`;

  const customerSnapshot = await getDocs(customersRef);
  customerSnapshot.forEach((docSnap) => {
    const customer = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = `${customer.name} (${customer.phone})`;
    select.appendChild(option);
  });

  document.getElementById("sellQuantityInput").value = "";
  document.getElementById("sellProductModal").classList.remove("hidden");
};

window.hideSellProductModal = function () {
  selectedProductForSale = null;
  document.getElementById("sellProductModal").classList.add("hidden");
};

window.confirmSellProduct = async function () {
  if (!selectedProductForSale) {
    alert("No product selected.");
    return;
  }

  const customerId = document.getElementById("sellCustomerSelect").value;
  const quantity = parseInt(document.getElementById("sellQuantityInput").value);

  if (!customerId) {
    alert("Please select a customer.");
    return;
  }

  if (isNaN(quantity) || quantity <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }

  if (quantity > Number(selectedProductForSale.stock || 0)) {
    alert("Not enough stock available.");
    return;
  }

  const customerRefDoc = doc(db, "customers", customerId);
  const productRefDoc = doc(db, "products", selectedProductForSale.id);

  const customerSnap = await getDoc(customerRefDoc);
  if (!customerSnap.exists()) {
    alert("Customer not found.");
    return;
  }

  const customer = customerSnap.data();

  const saleAmount = Number(selectedProductForSale.price || 0) * quantity;
  const totalCost = Number(selectedProductForSale.cost || 0) * quantity;
  const profit = saleAmount - totalCost;
  const pointsEarned = saleAmount * POINTS_PER_DOLLAR;

  const history = customer.history || [];
  history.push({
    amount: saleAmount,
    originalAmount: saleAmount,
    rewardUsed: 0,
    cost: totalCost,
    profit,
    pointsEarned,
    date: new Date().toISOString(),
    productName: selectedProductForSale.name,
    productImage: selectedProductForSale.image || "",
    quantity
  });

  await updateDoc(customerRefDoc, {
    points: Number(customer.points || 0) + pointsEarned,
    totalSpent: Number(customer.totalSpent || 0) + saleAmount,
    totalProfit: Number(customer.totalProfit || 0) + profit,
    history
  });

  await updateDoc(productRefDoc, {
    stock: Number(selectedProductForSale.stock || 0) - quantity
  });

  hideSellProductModal();
  await loadCustomers();
  await loadProducts();
  await loadDashboard();

  alert(
    `Sale completed.\n` +
    `Product: ${selectedProductForSale.name}\n` +
    `Quantity: ${quantity}\n` +
    `Sale: $${round2(saleAmount)}\n` +
    `Profit: $${round2(profit)}\n` +
    `Points earned: ${round2(pointsEarned)}`
  );
};

window.addPoints = async function (id, currentPoints) {
  await updateDoc(doc(db, "customers", id), {
    points: Number(currentPoints || 0) + 10
  });

  await loadCustomers();
  await loadDashboard();
};

window.addPurchase = async function (id) {
  const amountInput = prompt("Enter purchase amount in dollars:");
  if (!amountInput) return;

  const amount = parseFloat(amountInput);
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid purchase amount.");
    return;
  }

  const costInput = prompt("Enter cost price in dollars (for profit tracking):", "0");
  if (costInput === null) return;

  const cost = parseFloat(costInput);
  if (isNaN(cost) || cost < 0) {
    alert("Please enter a valid cost price.");
    return;
  }

  const useReward = confirm("Does customer want to redeem $5 reward if eligible?");
  const customerDocRef = doc(db, "customers", id);
  const customerSnap = await getDoc(customerDocRef);

  if (!customerSnap.exists()) {
    alert("Customer not found.");
    return;
  }

  const customer = customerSnap.data();
  let currentPoints = Number(customer.points || 0);
  const currentTotalSpent = Number(customer.totalSpent || 0);
  const currentTotalProfit = Number(customer.totalProfit || 0);
  const history = customer.history || [];

  let finalAmount = amount;
  let rewardUsed = 0;

  if (useReward && currentPoints >= REWARD_POINTS) {
    finalAmount = Math.max(amount - REWARD_VALUE, 0);
    rewardUsed = REWARD_VALUE;
    currentPoints -= REWARD_POINTS;
  }

  const profit = finalAmount - cost;
  const pointsEarned = finalAmount * POINTS_PER_DOLLAR;

  const purchaseRecord = {
    amount: finalAmount,
    originalAmount: amount,
    rewardUsed,
    cost,
    profit,
    pointsEarned,
    date: new Date().toISOString()
  };

  history.push(purchaseRecord);

  await updateDoc(customerDocRef, {
    points: currentPoints + pointsEarned,
    totalSpent: currentTotalSpent + finalAmount,
    totalProfit: currentTotalProfit + profit,
    history
  });

  await loadCustomers();
  await loadDashboard();

  alert(
    `Purchase added.\n` +
    `Original sale: $${round2(amount)}\n` +
    `Reward used: $${round2(rewardUsed)}\n` +
    `Final sale: $${round2(finalAmount)}\n` +
    `Cost: $${round2(cost)}\n` +
    `Profit: $${round2(profit)}\n` +
    `Points earned: ${round2(pointsEarned)}`
  );
};

window.redeemReward = async function (id) {
  const customerDocRef = doc(db, "customers", id);
  const customerSnap = await getDoc(customerDocRef);

  if (!customerSnap.exists()) {
    alert("Customer not found.");
    return;
  }

  const customer = customerSnap.data();
  const currentPoints = Number(customer.points || 0);

  if (currentPoints < REWARD_POINTS) {
    alert("Customer does not have enough points.");
    return;
  }

  const confirmed = confirm(`Redeem ${REWARD_POINTS} points for $${REWARD_VALUE} off?`);
  if (!confirmed) return;

  await updateDoc(customerDocRef, {
    points: currentPoints - REWARD_POINTS
  });

  await loadCustomers();
  await loadDashboard();

  alert(`Reward redeemed. $${REWARD_VALUE} discount is now available for the customer.`);
};

window.viewHistory = async function (id) {
  const customerSnap = await getDoc(doc(db, "customers", id));

  if (!customerSnap.exists()) {
    alert("Customer not found.");
    return;
  }

  const customer = customerSnap.data();
  const history = customer.history || [];

  if (history.length === 0) {
    alert("No purchase history for this customer.");
    return;
  }

  let message = `${customer.name} Purchase History\n\n`;

  history
    .slice()
    .reverse()
    .forEach((item, index) => {
      const amount = Number(item.amount || item.purchaseAmount || 0);
      const pointsEarned = Number(item.pointsEarned || item.points || amount || 0);
      const profit = Number(item.profit || 0);
      const rewardUsed = Number(item.rewardUsed || 0);
      const quantityText = item.quantity ? ` | Qty ${item.quantity}` : "";
      const productText = item.productName ? ` | ${item.productName}` : "";
      const rawDate = item.date || item.createdAt || item.time || null;
      const dateText =
        rawDate && !isNaN(new Date(rawDate))
          ? new Date(rawDate).toLocaleString()
          : "Older record";

      message += `${index + 1}. $${round2(amount)}${productText}${quantityText} | Profit $${round2(profit)} | Reward $${round2(rewardUsed)} | ${round2(pointsEarned)} pts | ${dateText}\n`;
    });

  alert(message);
};

window.editCustomer = async function (id, oldName, oldPhone) {
  const newName = prompt("Edit customer name:", oldName);
  if (newName === null) return;

  const newPhone = prompt("Edit phone number:", oldPhone);
  if (newPhone === null) return;

  if (!newName.trim() || !newPhone.trim()) {
    alert("Name and phone cannot be empty.");
    return;
  }

  await updateDoc(doc(db, "customers", id), {
    name: newName.trim(),
    phone: newPhone.trim()
  });

  await loadCustomers();
  await loadDashboard();
};

window.deleteCustomer = async function (id) {
  if (!isAdminMode) {
    alert("Delete is admin only.");
    return;
  }

  const confirmed = confirm("Are you sure you want to delete this customer?");
  if (!confirmed) return;

  await deleteDoc(doc(db, "customers", id));

  await loadCustomers();
  await loadDashboard();
};

window.sendWhatsApp = function (phone, name, points, type = "points") {
  const cleanPhone = phone.replace(/[^\d]/g, "");
  let message = "";

  const rewardCount = Math.floor(Number(points || 0) / REWARD_POINTS);

  if (type === "promo") {
    message =
      `Hello ${name}, welcome to Sewa African Store. Visit us today for fresh African groceries and special deals. We look forward to serving you!`;
  } else {
    message =
      `Hello ${name}, thank you for shopping with Sewa African Store. You currently have ${round2(points)} loyalty points. ` +
      (rewardCount > 0
        ? `You can redeem ${rewardCount} reward(s) worth $${REWARD_VALUE} each.`
        : `Earn ${round2(REWARD_POINTS - Number(points || 0))} more points to get $${REWARD_VALUE} off.`);
  }

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};

window.restockProduct = async function (id, currentStock) {
  if (!isAdminMode) {
    alert("Only admin can restock products.");
    return;
  }

  const addQtyInput = prompt("Enter quantity to add to stock:");
  if (!addQtyInput) return;

  const addQty = parseInt(addQtyInput);
  if (isNaN(addQty) || addQty <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }

  await updateDoc(doc(db, "products", id), {
    stock: Number(currentStock || 0) + addQty
  });

  await loadProducts();
  await loadDashboard();
};

window.editProduct = async function (id) {
  if (!isAdminMode) {
    alert("Only admin can edit products.");
    return;
  }

  const productSnap = await getDoc(doc(db, "products", id));
  if (!productSnap.exists()) {
    alert("Product not found.");
    return;
  }

  const product = productSnap.data();

  const name = prompt("Edit product name:", product.name || "");
  if (name === null) return;

  const category = prompt("Edit category:", product.category || "");
  if (category === null) return;

  const priceInput = prompt("Edit selling price:", product.price || 0);
  if (priceInput === null) return;

  const costInput = prompt("Edit cost price:", product.cost || 0);
  if (costInput === null) return;

  const stockInput = prompt("Edit stock quantity:", product.stock || 0);
  if (stockInput === null) return;

  const lowStockInput = prompt("Edit low stock level:", product.lowStockLevel || 0);
  if (lowStockInput === null) return;

  const price = parseFloat(priceInput);
  const cost = parseFloat(costInput);
  const stock = parseInt(stockInput);
  const lowStockLevel = parseInt(lowStockInput);

  if (!name.trim() || !category.trim() || isNaN(price) || isNaN(cost) || isNaN(stock) || isNaN(lowStockLevel)) {
    alert("Invalid product values.");
    return;
  }

  await updateDoc(doc(db, "products", id), {
    name: name.trim(),
    category: category.trim(),
    price,
    cost,
    stock,
    lowStockLevel
  });

  await loadProducts();
  await loadDashboard();
};

window.deleteProduct = async function (id) {
  if (!isAdminMode) {
    alert("Delete is admin only.");
    return;
  }

  const confirmed = confirm("Are you sure you want to delete this product?");
  if (!confirmed) return;

  await deleteDoc(doc(db, "products", id));

  await loadProducts();
  await loadDashboard();
};

function getOrderPaymentStatus(order) {
  return String(order.paymentStatus || "").toLowerCase();
}

function getOrderStatus(order) {
  return String(order.orderStatus || order.status || "pending").toLowerCase();
}

function getOrderBadge(order) {
  const paymentStatus = getOrderPaymentStatus(order);
  const orderStatus = getOrderStatus(order);
  const paymentMethod = String(order.paymentMethod || "").toLowerCase();

  if (orderStatus === "completed") {
    return { text: "Completed", className: "completed" };
  }

  if (orderStatus === "cancelled") {
    return { text: "Cancelled", className: "cancelled" };
  }

  if (paymentMethod === "card_online" && paymentStatus === "paid") {
    return { text: "Paid", className: "paid" };
  }

  if (
    paymentMethod === "card_online" &&
    (paymentStatus === "pending" || orderStatus === "awaiting_payment")
  ) {
    return { text: "Awaiting Payment", className: "awaiting" };
  }

  if (orderStatus === "confirmed") {
    return { text: "Confirmed", className: "confirmed" };
  }

  return { text: "Pending", className: "pending" };
}

function matchesOnlineOrderFilter(order) {
  const paymentStatus = getOrderPaymentStatus(order);
  const orderStatus = getOrderStatus(order);
  const paymentMethod = String(order.paymentMethod || "").toLowerCase();

  if (onlineOrderFilter === "all") return true;
  if (onlineOrderFilter === "paid") return paymentStatus === "paid";
  if (onlineOrderFilter === "unpaid") return paymentStatus !== "paid";
  if (onlineOrderFilter === "awaiting_payment") return orderStatus === "awaiting_payment";
  if (onlineOrderFilter === "confirmed") return orderStatus === "confirmed";
  if (onlineOrderFilter === "completed") return orderStatus === "completed";
  if (onlineOrderFilter === "cancelled") return orderStatus === "cancelled";
  if (onlineOrderFilter === "card_online") return paymentMethod === "card_online";

  return true;
}

function getOrderDisplayAddress(order) {
  if (String(order.method || "").toLowerCase() === "delivery") {
    const address = order.address || "";
    const province = order.province || "";
    return [address, province].filter(Boolean).join(", ") || "N/A";
  }

  return "Pickup";
}

function getOrderPlacedText(order) {
  if (order.createdAt && !isNaN(new Date(order.createdAt))) {
    return new Date(order.createdAt).toLocaleString();
  }

  return "Unknown date";
}

function getOrderItemsHtml(order) {
  const items = order.items || [];

  if (!items.length) {
    return `<div class="order-item-row">No items</div>`;
  }

  return items
    .map((item) => {
      return `
        <div class="order-item-row">
          ${escapeHtml(item.name || "Item")} — Qty: ${item.quantity || 0} — $${round2(item.price || 0)}
        </div>
      `;
    })
    .join("");
}

window.setOnlineOrderFilter = async function (filterValue) {
  onlineOrderFilter = filterValue;
  await loadOrders();
};

window.refreshOrders = async function () {
  await loadOrders();
};

async function loadOrders() {
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;

  ordersList.innerHTML = `<p class="empty-state">Loading orders...</p>`;

  try {
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      ordersList.innerHTML = `<p class="empty-state">No orders yet.</p>`;
      return;
    }

    const orders = [];

    snapshot.forEach((docSnap) => {
      orders.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    const filteredOrders = orders.filter(matchesOnlineOrderFilter);

    if (!filteredOrders.length) {
      ordersList.innerHTML = `<p class="empty-state">No matching orders.</p>`;
      return;
    }

    ordersList.innerHTML = "";

    filteredOrders.forEach((order) => {
      const paymentStatus = getOrderPaymentStatus(order);
      const orderStatus = getOrderStatus(order);
      const badge = getOrderBadge(order);
      const createdAtText = getOrderPlacedText(order);
      const itemsHtml = getOrderItemsHtml(order);

      let actionButtons = "";

      if (orderStatus === "awaiting_payment") {
        actionButtons = `
          <span class="order-status awaiting">Waiting for customer payment</span>
        `;
      } else if (orderStatus === "pending") {
        actionButtons = `
          <button class="primary-btn" onclick="updateOrderStatus('${order.id}', 'confirmed')">Confirm</button>
          <button class="primary-btn" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
        `;
      } else if (orderStatus === "confirmed") {
        actionButtons = `
          <button class="primary-btn" onclick="completeOrder('${order.id}')">Complete</button>
          <button class="primary-btn" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
        `;
      } else if (orderStatus === "completed") {
        actionButtons = `<span class="order-status completed">Completed</span>`;
      } else if (orderStatus === "cancelled") {
        actionButtons = `<span class="order-status cancelled">Cancelled</span>`;
      }

      const card = document.createElement("div");
      card.className = `order-card ${badge.className}`;

      card.innerHTML = `
        <div class="order-top">
          <div>
            <div class="order-title">${escapeHtml(order.customerName || "Customer")}</div>
            <div class="order-status ${badge.className}">${escapeHtml(badge.text)}</div>
          </div>
          <div class="order-total">$${round2(order.total || 0)}</div>
        </div>

        <div class="order-meta">
          <div><strong>Phone:</strong> ${escapeHtml(order.phone || "")}</div>
          <div><strong>Method:</strong> ${escapeHtml(order.method || "pickup")}</div>
          <div><strong>Payment:</strong> ${escapeHtml(order.paymentMethod || "N/A")}</div>
          <div><strong>Payment Status:</strong> ${escapeHtml(paymentStatus || "unpaid")}</div>
          <div><strong>Order Status:</strong> ${escapeHtml(orderStatus)}</div>
          <div><strong>Address:</strong> ${escapeHtml(getOrderDisplayAddress(order))}</div>
          <div><strong>Delivery Fee:</strong> $${round2(order.deliveryFee || 0)}</div>
          <div><strong>Notes:</strong> ${escapeHtml(order.notes || "None")}</div>
          <div><strong>Placed:</strong> ${createdAtText}</div>
        </div>

        <div class="order-items">
          <div class="order-items-title">Items</div>
          ${itemsHtml}
        </div>

        <div class="order-actions">
          ${actionButtons}
        </div>
      `;

      ordersList.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    ordersList.innerHTML = `<p class="empty-state">Could not load orders.</p>`;
  }
}

window.updateOrderStatus = async function (orderId, newStatus) {
  try {
    const orderRefDoc = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRefDoc);

    if (!orderSnap.exists()) {
      alert("Order not found.");
      return;
    }

    const order = orderSnap.data();
    const currentOrderStatus = getOrderStatus(order);
    const paymentStatus = getOrderPaymentStatus(order);
    const paymentMethod = String(order.paymentMethod || "").toLowerCase();

    if (currentOrderStatus === "completed") {
      alert("Completed orders cannot be changed.");
      return;
    }

    if (currentOrderStatus === "cancelled") {
      alert("Cancelled orders cannot be changed.");
      return;
    }

    if (newStatus === "confirmed") {
      if (paymentMethod === "card_online" && paymentStatus !== "paid") {
        alert("This online card order has not been paid yet.");
        return;
      }

      await updateDoc(orderRefDoc, {
        orderStatus: "confirmed",
        status: "confirmed",
        confirmedAt: new Date().toISOString()
      });
    } else if (newStatus === "cancelled") {
      await updateDoc(orderRefDoc, {
        orderStatus: "cancelled",
        status: "cancelled",
        cancelledAt: new Date().toISOString()
      });
    } else {
      await updateDoc(orderRefDoc, {
        orderStatus: newStatus,
        status: newStatus
      });
    }

    await loadOrders();
    alert(`Order marked as ${newStatus}.`);
  } catch (error) {
    console.error(error);
    alert("Could not update order status.");
  }
};

window.completeOrder = async function (orderId) {
  try {
    const orderRefDoc = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRefDoc);

    if (!orderSnap.exists()) {
      alert("Order not found.");
      return;
    }

    const order = orderSnap.data();
    const currentOrderStatus = getOrderStatus(order);

    if (currentOrderStatus === "completed") {
      alert("Order is already completed.");
      return;
    }

    if (currentOrderStatus === "cancelled") {
      alert("Cancelled order cannot be completed.");
      return;
    }

    if (currentOrderStatus !== "confirmed") {
      alert("Please confirm the order first before completing it.");
      return;
    }

    const confirmed = confirm("Complete this order and reduce stock now?");
    if (!confirmed) return;

    const items = order.items || [];

    for (const item of items) {
      if (!item.productId) continue;

      const productRefDoc = doc(db, "products", item.productId);
      const productSnap = await getDoc(productRefDoc);

      if (!productSnap.exists()) continue;

      const product = productSnap.data();
      const currentStock = Number(product.stock || 0);
      const qty = Number(item.quantity || 0);

      await updateDoc(productRefDoc, {
        stock: Math.max(currentStock - qty, 0)
      });
    }

    await updateDoc(orderRefDoc, {
      orderStatus: "completed",
      status: "completed",
      completedAt: new Date().toISOString()
    });

    await loadOrders();
    await loadProducts();
    await loadDashboard();

    alert("Order completed and stock reduced.");
  } catch (error) {
    console.error(error);
    alert("Could not complete order.");
  }
};

function createLast7DaysMap() {
  const map = {};
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    map[formatDateKey(d)] = 0;
  }

  return map;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDateLabel(dateKey) {
  const date = new Date(dateKey + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

window.loadDashboard = async function () {
  const customerSnapshot = await getDocs(customersRef);
  const productSnapshot = await getDocs(productsRef);

  let totalSales = 0;
  let todaySales = 0;
  let totalTransactions = 0;
  let totalProfit = 0;
  let todayProfit = 0;
  let topCustomer = "None";
  let topSpent = 0;
  let customerCount = 0;
  let repeatCustomers = 0;
  let productCount = 0;
  let lowStockCount = 0;

  const today = new Date();
  const todayDateString = today.toDateString();

  const recentSales = [];
  const dailySalesMap = createLast7DaysMap();
  const topCustomers = [];

  customerSnapshot.forEach((docSnap) => {
    customerCount += 1;
    const customer = docSnap.data();
    const history = customer.history || [];
    let customerSpent = 0;

    if (history.length > 1) {
      repeatCustomers += 1;
    }

    history.forEach((purchase) => {
      const amount = Number(purchase.amount || purchase.purchaseAmount || 0);
      const pointsEarned = Number(purchase.pointsEarned || purchase.points || amount || 0);
      const profit = Number(purchase.profit || 0);
      const rawDate = purchase.date || purchase.createdAt || purchase.time || null;
      const purchaseDate = rawDate ? new Date(rawDate) : null;

      customerSpent += amount;
      totalTransactions += 1;
      totalProfit += profit;

      if (purchaseDate && !isNaN(purchaseDate)) {
        if (purchaseDate.toDateString() === todayDateString) {
          todaySales += amount;
          todayProfit += profit;
        }

        const key = formatDateKey(purchaseDate);
        if (dailySalesMap[key] !== undefined) {
          dailySalesMap[key] += amount;
        }

        recentSales.push({
          customerName: customer.name,
          amount,
          profit,
          pointsEarned,
          date: purchaseDate.toISOString()
        });
      } else {
        recentSales.push({
          customerName: customer.name,
          amount,
          profit,
          pointsEarned,
          date: null
        });
      }
    });

    totalSales += customerSpent;
    topCustomers.push({
      name: customer.name,
      spent: customerSpent
    });

    if (customerSpent > topSpent) {
      topSpent = customerSpent;
      topCustomer = customer.name;
    }
  });

  productSnapshot.forEach((docSnap) => {
    productCount += 1;
    const product = docSnap.data();

    if (Number(product.stock || 0) <= Number(product.lowStockLevel || 0)) {
      lowStockCount += 1;
    }
  });

  const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;
  const bestSalesDayEntry = Object.entries(dailySalesMap).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    ["None", 0]
  );

  const el = (id) => document.getElementById(id);

  if (el("totalSales")) el("totalSales").textContent = `$${round2(totalSales)}`;
  if (el("todaySales")) el("todaySales").textContent = `$${round2(todaySales)}`;
  if (el("totalTransactions")) el("totalTransactions").textContent = totalTransactions;
  if (el("totalProfit")) el("totalProfit").textContent = `$${round2(totalProfit)}`;
  if (el("todayProfit")) el("todayProfit").textContent = `$${round2(todayProfit)}`;
  if (el("averageSale")) el("averageSale").textContent = `$${round2(averageSale)}`;
  if (el("topCustomer")) el("topCustomer").textContent = topCustomer;
  if (el("topCustomerSpend")) el("topCustomerSpend").textContent = `$${round2(topSpent)}`;
  if (el("customerCount")) el("customerCount").textContent = customerCount;
  if (el("bestSalesDay")) {
    el("bestSalesDay").textContent =
      bestSalesDayEntry[0] === "None" ? "None" : shortDateLabel(bestSalesDayEntry[0]);
  }
  if (el("bestSalesDayAmount")) el("bestSalesDayAmount").textContent = `$${round2(bestSalesDayEntry[1])}`;
  if (el("repeatCustomers")) el("repeatCustomers").textContent = repeatCustomers;
  if (el("productCount")) el("productCount").textContent = productCount;
  if (el("lowStockCount")) el("lowStockCount").textContent = lowStockCount;

  renderSalesChart(dailySalesMap);
  renderRecentSales(recentSales);
  renderTopCustomers(topCustomers);
};

updateRoleUI();
await loadCustomers();
await loadProducts();
await loadOrders();
await loadDashboard();




