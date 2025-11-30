// Products are fetched from the backend
let PRODUCTS = [];

// Toast helper
function ensureToastRoot(){
  if (document.getElementById('site-toasts')) return document.getElementById('site-toasts');
  const root = document.createElement('div'); root.id = 'site-toasts'; root.style.position = 'fixed'; root.style.right = '12px'; root.style.top = '12px'; root.style.zIndex = 9999; document.body.appendChild(root); return root;
}
function showToast(message, type='info', duration=3500){
  const root = ensureToastRoot();
  const el = document.createElement('div'); el.className = 'toast ' + (type || 'info'); el.innerText = message; el.style.marginTop='6px'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)'; el.style.background = type === 'success' ? 'linear-gradient(90deg,#1b5e7a,#094e68)' : (type==='error' ? 'linear-gradient(90deg,#8a1f1f,#c44545)' : '#111'); el.style.color = '#fff'; el.style.fontWeight='600'; root.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity 300ms ease'; el.style.opacity = 0; setTimeout(()=>el.remove(), 400); }, duration);
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (Array.isArray(data)) PRODUCTS = data;
  } catch (err) {
    console.warn('Failed fetching products from server, falling back to local data if any');
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    window.APP_CONFIG = cfg || {};
    // Respect a local preference if present; otherwise follow server config
    const localTheme = localStorage.getItem('808steps_theme');
    const themeToApply = localTheme || cfg.theme;
    if (themeToApply === 'winter') document.body.classList.add('theme-winter');
    else document.body.classList.remove('theme-winter');
    // theme on header (respect local preference if present)
    const header = document.querySelector('.site-header');
    if (header) header.dataset.theme = themeToApply || cfg.theme || 'default';
  } catch (err) { /* ignore */ }
}

function renderFeatured() {
  const featuredRoot = document.querySelector('.featured');
  const cfg = window.APP_CONFIG || {};
  if (!featuredRoot) return;
  let items = PRODUCTS.slice(0, 3);
  if (cfg.featured && Array.isArray(cfg.featured) && cfg.featured.length) {
    // map configured featured ids to products in specified order
    items = cfg.featured.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  }
  featuredRoot.innerHTML = items.map(p => `
    <div class="featured-item">
      <div class="${p.featured ? 'halo' : ''}"><img src="${p.images && p.images[0] ? p.images[0] : 'images/table.svg'}" alt="${p.name}"/></div>
      <div class="feat-body">
        <h3>${p.name}</h3>
        <p class="product-price">€${p.price}</p>
        <div style="margin-block-start:8px"><button class="primary" data-add-product="${p.id}">Ajouter</button></div>
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-add-product]').forEach(btn => {
    btn.addEventListener('click', (e) => { addToCart(e.target.getAttribute('data-add-product')); showToast('Produit ajouté au panier', 'success'); });
  });
}

function renderBestSellers() {
  const root = document.getElementById('best-sellers-grid');
  if (!root) return;
  const items = PRODUCTS.slice(0, 4);
  root.innerHTML = items.map(p => `
    <article class="product-card">
      <a href="product.html?id=${p.id}" class="product-link">
        <img src="${p.images && p.images[0] ? p.images[0] : 'images/table.svg'}" alt="${p.name}"/>
        <div class="product-body"><h3>${p.name}</h3><div class="product-price">€${p.price}</div></div>
      </a>
    </article>
  `).join('');
}

function renderAccessories() {
  const root = document.getElementById('accessories-grid');
  if (!root) return;
  const items = PRODUCTS.filter(p => /casquette|echarpe|sandales|baskets|accessoire|cap/i.test(p.id)).slice(0,6);
  root.innerHTML = items.map(p => `
    <article class="product-card">
      <a href="product.html?id=${p.id}" class="product-link">
        <img src="${p.images && p.images[0] ? p.images[0] : 'images/table.svg'}" alt="${p.name}"/>
        <div class="product-body"><h3>${p.name}</h3><div class="product-price">€${p.price}</div></div>
      </a>
    </article>
  `).join('');
}

async function renderProductById(id, productDetailRoot) {
  try {
    // Try to find locally first
    let entry = findProductAndVariant(id);
    let p;
    if (entry && entry.product) {
      p = entry.product;
    } else {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) return productDetailRoot.innerHTML = '<p>Produit introuvable.</p>';
      p = await res.json();
      entry = { product: p, variant: null };
    }
    let selectedVariant = entry.variant || (p.variants && p.variants[0]);
    const imagesHtml = (p.images||[]).map((src, idx) => `<img src="${src}" class="thumb" data-idx="${idx}" alt="${p.name} image"/>`).join('');
    const variantOptions = (p.variants||[]).map(v=>`<option value="${v.id}">${v.size} / ${v.color} ${v.stock?` - ${v.stock} en stock` : ''}</option>`).join('');
    productDetailRoot.innerHTML = `<div class="product-detail">
      <div class="product-images">
        <img src="${p.images && p.images[0] ? p.images[0] : 'images/table.svg'}" id="product-main-image" alt="${p.name}"/>
        <div class="thumbs">${imagesHtml}</div>
      </div>
      <div class="product-info">
        <h2>${p.name}</h2>
        <p class="product-price">€<span id="price-value">${p.price}</span></p>
        <label for="variant-select">Choix (taille/couleur):</label>
        <select id="variant-select">${variantOptions}</select>
        <p class="product-desc">${p.description || ''}</p>
        <p class="product-dim">${p.dimensions ? 'Dimensions: ' + p.dimensions : ''}</p>
        <button id="add-to-cart" class="primary">Ajouter au panier</button>
      </div>
    </div>`;
          const prev = document.getElementById('prod-preview'); if (prev) { prev.src = p.images[0]; prev.style.display = 'block'; }
    // attach events
    const addBtn = document.getElementById('add-to-cart');
    document.getElementById('variant-select')?.addEventListener('change', (e)=>{
      const variantId = e.target.value;
      const found = findProductAndVariant(variantId);
      if (found && found.product) document.getElementById('price-value').innerText = found.product.price;
      selectedVariant = found && found.variant ? found.variant : null;
    });
    addBtn.addEventListener('click', () => { const idToAdd = selectedVariant ? selectedVariant.id : p.id; addToCart(idToAdd); showToast('Produit ajouté au panier', 'success'); });
    document.querySelectorAll('.thumb').forEach(t => { t.addEventListener('click', (e) => { const idx = e.target.getAttribute('data-idx'); const main = document.getElementById('product-main-image'); main.src = p.images[idx]; }); });
  } catch (err) {
    productDetailRoot.innerHTML = '<p>Produit introuvable (erreur).</p>';
  }
}

function getCart() {
  const raw = localStorage.getItem('808steps_cart');
  return raw ? JSON.parse(raw) : [];
}

function saveCart(cart) {
  localStorage.setItem('808steps_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const count = getCart().reduce((sum, item) => sum + (item.qty || 0), 0);
  const badge = document.getElementById('cart-count');
  if (badge) badge.innerText = count;
}

function findProductAndVariant(id){
  // find either a product with this id or a variant
  let p = PRODUCTS.find(x => x.id === id);
  if (p) return {product:p, variant:null};
  for (const key in PRODUCTS){
    const prod = PRODUCTS[key];
    if (prod.variants) {
      const v = prod.variants.find(x => x.id === id);
      if (v) return {product:prod, variant:v};
    }
  }
  return null;
}

function addToCart(productId, qty = 1) {
  const entry = findProductAndVariant(productId);
  if (!entry) { showToast('Produit introuvable', 'error'); return; }
  // use variant id if present
  const id = entry.variant ? entry.variant.id : entry.product.id;
  const cart = getCart();
  const existing = cart.find(item => item.id === id);
  if (existing) existing.qty += qty; else cart.push({id, qty});
  saveCart(cart);
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(i => i.id !== productId);
  saveCart(cart);
  renderCart();
}

function updateQty(productId, qty) {
  const cart = getCart();
  const it = cart.find(i => i.id === productId);
  if (it) it.qty = qty;
  saveCart(cart);
  renderCart();
}

// render cart on cart.html
function renderCart() {
  const root = document.getElementById('cart-root');
  if (!root) return;
  const cart = getCart();
  if (cart.length === 0) {
    root.innerHTML = '<p>Votre panier est vide.</p>';
    updateCartBadge();
    return;
  }
  let subtotal = 0;
  const itemsHtml = cart.map(item => {
    const entry = findProductAndVariant(item.id);
    const p = entry.product;
    const v = entry.variant;
    const unitPrice = p.price || 0;
    const line = unitPrice * item.qty;
    subtotal += line;
    const displayTitle = v ? `${p.name || p.title} — ${v.size}/${v.color}` : (p.name || p.title);
    const displayId = item.id; // variant or product id
    return `<div class="cart-item">
      <img src="${p.images[0]}" alt="${p.name || p.title}"/>
      <div class="cart-item-body">
        <h4>${displayTitle}</h4>
        <p class="cart-price">€${unitPrice} x <input type="number" min="1" value="${item.qty}" data-id="${displayId}" class="qty-input"> = €${line}</p>
        <button class="remove-btn" data-id="${displayId}">Retirer</button>
      </div>
    </div>`;
  }).join('');

  const estimatedDelivery = subtotal >= 100 ? 'Livraison gratuite (2-4 jours)' : 'Livraison estimée: 5-8 jours (5€)';
  const shipping = subtotal >= 100 ? 0 : 5;
  const total = subtotal + shipping;

  root.innerHTML = `<div class="cart-items">${itemsHtml}</div>
    <div class="cart-summary">
      <p>Sous-total: €${subtotal.toFixed(2)}</p>
      <p>${estimatedDelivery}</p>
      <p><strong>Total: €${total.toFixed(2)}</strong></p>
      <button id="checkout" class="primary">Valider la commande</button>
    </div>`;

  // attach events
  root.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const value = parseInt(e.target.value) || 1;
      updateQty(id, value);
    })
  });

  root.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      removeFromCart(id);
    })
  });

  updateCartBadge();
  const checkoutBtn = document.getElementById('checkout');
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => { window.location.href='checkout.html'; });
}

// page init: update badge, product page render, cart render
function init() {
  updateCartBadge();
  // load products from backend
  Promise.all([loadProducts(), loadConfig()]).then(()=>{
    renderFeatured();
    // re-render product view if on product page
    const productDetailRoot = document.getElementById('product-root');
    if (productDetailRoot) {
      // re-init product render flow
      const id = getParam('id');
      if (!id) { productDetailRoot.innerHTML = '<p>Produit introuvable.</p>'; return; }
      renderProductById(id, productDetailRoot);
    }
    // render best-sellers / accessories
    renderBestSellers();
    renderAccessories();
  });
  // Initialize settings gear and menu visibility
  try { initSettingsPanel(); } catch (e) { console.warn('initSettingsPanel error', e); }
  try {
    const token = localStorage.getItem('808steps_admin_token');
    const menuAdmin = document.getElementById('menu-admin');
    const menuLogout = document.getElementById('menu-logout');
    if (menuAdmin) menuAdmin.style.display = token ? 'block' : 'none';
    if (menuLogout) menuLogout.style.display = token ? 'block' : 'none';
  } catch (e) { console.warn('admin menu toggle error', e); }
  const cartRoot = document.getElementById('cart-root');
  if (cartRoot) renderCart();
  btn.addEventListener('click', (e) => { const id = e.target.getAttribute('data-id'); addToCart(id); showToast('Produit ajouté au panier', 'success'); initSettingsPanel(); })
  addBtn.addEventListener('click', () => { const idToAdd = selectedVariant ? selectedVariant.id : p.id; addToCart(idToAdd); showToast('Produit ajouté au panier', 'success'); });

  const productDetailRoot = document.getElementById('product-root');
  if (productDetailRoot) {
    const id = getParam('id');
    if (!id) { productDetailRoot.innerHTML = '<p>Produit introuvable.</p>'; return; }
    // productDetail rendering is handled by renderProductById
    renderProductById(id, productDetailRoot);
  }

  // featured add to cart buttons (on index hero)
  document.querySelectorAll('[data-add-product]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-add-product');
      addToCart(id);
      showToast('Produit ajouté au panier', 'success');
      initSettingsPanel();
    })
  });

  // CART: proceed to checkout link
  const proceed = document.getElementById('proceed-to-checkout');
  if (proceed) proceed.addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });

  // checkout script: steps
  const toShipping = document.getElementById('to-shipping');
  if (toShipping) {
    toShipping.addEventListener('click', () => {
      document.getElementById('step-address').style.display = 'none';
      document.getElementById('step-shipping').style.display = 'block';
    });
  }
  const toPayment = document.getElementById('to-payment');
  if (toPayment) {
    toPayment.addEventListener('click', () => {
      document.getElementById('step-shipping').style.display = 'none';
      document.getElementById('step-payment').style.display = 'block';
      // show/hide card form depending on payment method
      document.querySelectorAll('input[name=payment_method]').forEach(i=>i.addEventListener('change', (e) => {
        document.getElementById('card-form').style.display = e.target.value === 'card' ? 'block' : 'none';
      }));
    });
  }

  const payNow = document.getElementById('pay-now');
  if (payNow) {
    payNow.addEventListener('click', async () => {
      // collect address and shipping
      const payload = {
        address: {
          first_name: document.getElementById('first_name').value,
          last_name: document.getElementById('last_name').value,
          phone: document.getElementById('phone').value,
          line1: document.getElementById('line1').value,
          line2: document.getElementById('line2').value,
          postal_code: document.getElementById('postal_code').value,
          city: document.getElementById('city').value,
            country: document.getElementById('country').value,
            email: document.getElementById('email') ? document.getElementById('email').value : ''
        },
        shipping: document.querySelector('input[name=shipping]:checked').value,
        payment_method: document.querySelector('input[name=payment_method]:checked').value,
        cart: getCart()
      };

      // create order draft on backend and initiate payment
      try {
        const res = await fetch('/api/checkout/create-order', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Impossible de créer la commande');

        if (payload.payment_method === 'paypal') {
          // simulate: backend returns URL for PayPal checkout
          window.location.href = data.paypal_url || '/merci.html';
        } else if (payload.payment_method === 'card') {
          // Card payment: create PaymentIntent or fallback simulate
          const payRes = await fetch('/api/checkout/pay', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({order_id:data.order_id, method:'card'}) });
          const payData = await payRes.json();
          if (!payRes.ok) throw new Error(payData.message || 'Paiement refusé');
          if (payData.client_secret && window.STRIPE_PUBLISHABLE_KEY) {
            // Use Stripe.js confirm card payment flow (frontend). This requires integration and a card element or PaymentElement.
            const stripe = Stripe(window.STRIPE_PUBLISHABLE_KEY);
            // For demo without collecting card details, we just confirm the payment using saved test method 'pm_card_visa' (test usage only)
            const cardMethod = 'pm_card_visa';
            const confirmRes = await stripe.confirmCardPayment(payData.client_secret, { payment_method: cardMethod });
            if (confirmRes.error) throw new Error(confirmRes.error.message || 'Erreur paiement');
            // Payment succeeded
            document.getElementById('step-payment').style.display = 'none';
            document.getElementById('step-confirmation').style.display = 'block';
            document.getElementById('confirmation-text').innerText = `Commande ${data.order_number || data.order_id} payée.`;
          } else {
            // fallback: simulated success returned by backend
            document.getElementById('step-payment').style.display = 'none';
            document.getElementById('step-confirmation').style.display = 'block';
            document.getElementById('confirmation-text').innerText = `Commande ${payData.order_number || payData.order_id} payée (simulation).`;
          }
        }
      } catch (err) {
        showToast(err.message || 'Erreur', 'error');
      }
    });
  }
}

// Settings gear and admin badge + panel
function initSettingsPanel() {
  let header = document.querySelector('.site-header .container');
  if (!header) header = document.querySelector('.site-header');
  if (!header) return;
  // create gear only once
  if (document.getElementById('settings-gear')) return;
  const gear = document.createElement('button');
  gear.id = 'settings-gear';
  gear.className = 'settings-gear';
  gear.setAttribute('aria-label','Paramètres');
  gear.innerText = '⚙️';
  header.appendChild(gear);
  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <a href="#" id="menu-my-account">Mon compte</a>
    <a href="#" id="menu-login">Se connecter / S'inscrire</a>
    <a href="admin.html" id="menu-admin" style="display:none">Admin</a>
    <a href="#" id="menu-logout" style="display:none">Déconnexion</a>
    <label style="display:block; margin-block-start:8px; font-size:13px; color:var(--deep)"><input id="settings-theme-toggle" type="checkbox"/> Thème hiver</label>
  `;
  header.appendChild(panel);
  gear.addEventListener('click', ()=>{ panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
  // click outside to close
  document.addEventListener('click', (e)=>{ if (!panel.contains(e.target) && e.target !== gear) panel.style.display = 'none'; });
  // bind menu links
  document.getElementById('menu-login').addEventListener('click', (e)=>{ e.preventDefault(); window.location.href = 'admin-login.html'; });
  document.getElementById('menu-my-account').addEventListener('click', (e)=>{ e.preventDefault(); window.location.href = 'cart.html'; });
  document.getElementById('menu-logout').addEventListener('click', (e)=>{ e.preventDefault(); localStorage.removeItem('808steps_admin_token'); window.location.reload(); });
  // show admin edition link when logged in
  const token = localStorage.getItem('808steps_admin_token');
  if (token) { document.getElementById('menu-admin').style.display = 'block'; document.getElementById('menu-logout').style.display = 'block'; }
  // admin badge
  const existingBadge = document.querySelector('.admin-badge');
  if (token && !existingBadge) {
    const badge = document.createElement('div');
    badge.className = 'admin-badge';
    badge.innerText = 'Mode Administrateur activé';
    document.body.appendChild(badge);
  } else if (!token && existingBadge) { existingBadge.remove(); }
  // theme toggle behavior in the settings panel
  try {
    const themeToggle = document.getElementById('settings-theme-toggle');
    if (themeToggle) {
      // initialize based on current applied theme
      themeToggle.checked = document.body.classList.contains('theme-winter');
      themeToggle.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        document.body.classList.toggle('theme-winter', checked);
        // Persist: if admin, post to server config; otherwise store locally
        const token = localStorage.getItem('808steps_admin_token');
        if (token) {
          const headers = {'Content-Type':'application/json'}; headers.Authorization = 'Bearer ' + token;
          try { await fetch('/api/admin/config', { method:'POST', headers, body: JSON.stringify({theme: checked ? 'winter' : 'default'}) }); } catch (err) { console.warn('Failed to persist theme on server', err); }
        } else {
          localStorage.setItem('808steps_theme', checked ? 'winter' : 'default');
        }
      });
    }
  } catch (err) { console.warn('settings-theme-toggle error', err); }
}

// expose admin functions to window for admin.html inline script to call
window.initAdminProductList = initAdminProductList;
window.initAdminFeaturedList = initAdminFeaturedList;
window.initSettingsPanel = initSettingsPanel;

// Admin functions: load product list for admin and set featured
async function initAdminProductList() {
  const adminListRoot = document.getElementById('admin-products-list');
  const featuredRoot = document.getElementById('admin-featured');
  if (!adminListRoot || !featuredRoot) return;
  // fetch products
  const res = await fetch('/api/products');
  const products = await res.json();
  // render admin cards
  adminListRoot.innerHTML = products.map(p => `
    <div class="admin-card" data-id="${p.id}">
      <div style="display:flex; gap:8px; align-items:center"><img src="${p.images && p.images[0] ? p.images[0] : 'images/table.svg' }" alt="" style="inline-size:56px; block-size:56px; object-fit:contain; border-radius:8px;"/>
      <div style="flex:1"><h4>${p.name}</h4><div style="font-size:13px; color:#666">${p.price} €</div></div></div>
      <p style="font-size:13px">${p.description || ''}</p>
      <div class="admin-actions"><button class="secondary admin-edit" data-id="${p.id}">Modifier</button><button class="secondary admin-feature" data-id="${p.id}">${p.featured? 'Désactiver mise en avant' : 'Mettre en avant'}</button></div>
    </div>`).join('');
  // attach actions
  adminListRoot.querySelectorAll('.admin-feature').forEach(btn => btn.addEventListener('click', async (e)=>{
    const id = e.target.getAttribute('data-id');
    const prod = products.find(x=>x.id===id);
    prod.featured = !prod.featured;
    // save via admin endpoint
    const token = localStorage.getItem('808steps_admin_token');
    const headers = {'Content-Type':'application/json'};
    if (token) headers.Authorization = 'Bearer ' + token;
    await fetch('/api/admin/products', { method:'POST', headers, body: JSON.stringify(prod) });
    showToast(prod.featured ? 'Produit mis en avant' : 'Produit retiré de la mise en avant', 'success');
    initAdminProductList();
    initAdminFeaturedList();
  }));
  adminListRoot.querySelectorAll('.admin-edit').forEach(btn => btn.addEventListener('click', async (e)=>{
  const id = e.target.getAttribute('data-id');
    const prod = products.find(x=>x.id===id);
    if (!prod) { showToast('Produit introuvable', 'error'); return; }
    // fill in form
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-price').value = prod.price;
    document.getElementById('prod-desc').value = prod.description;
    document.getElementById('prod-vars').value = JSON.stringify(prod.variants || []);
    // If the product has images, set a Preview
    if (prod.images && prod.images.length) {
      const preview = document.getElementById('prod-preview');
      if (preview) { preview.src = prod.images[0]; preview.style.display = 'block'; }
    }
  }));
  // featured area initialization
  initAdminFeaturedList();
  // refresh button
  const refreshBtn = document.getElementById('refresh-products');
  if (refreshBtn) refreshBtn.addEventListener('click', () => initAdminProductList());
}

async function initAdminFeaturedList(){
  const featuredRoot = document.getElementById('admin-featured');
  if (!featuredRoot) return;
  const res = await fetch('/api/products');
  const products = await res.json();
  const featured = products.filter(p => p.featured).slice(0,8);
  featuredRoot.innerHTML = featured.map(p => `<div class="admin-featured-item" draggable="true" data-id="${p.id}">${p.name}<span style="float:inline-end; color:var(--silver)">★★</span></div>`).join('');
  // drag & drop reordering
  let dragEl = null;
  featuredRoot.querySelectorAll('.admin-featured-item').forEach(el => {
    el.addEventListener('dragstart', (e)=>{ dragEl = el; el.style.opacity = '0.4'; });
    el.addEventListener('dragend', () => { dragEl=null; el.style.opacity=''; });
    el.addEventListener('dragover', (e) => { e.preventDefault(); });
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const target = e.target.closest('.admin-featured-item');
      if (!target || target === dragEl) return;
      featuredRoot.insertBefore(dragEl, target.nextSibling);
      // persist new ordering in config
      const ids = Array.from(featuredRoot.querySelectorAll('.admin-featured-item')).map(x => x.getAttribute('data-id'));
      const token = localStorage.getItem('808steps_admin_token');
      const headers = {'Content-Type':'application/json'}; if (token) headers.Authorization = 'Bearer ' + token;
      const cfgRes = await fetch('/api/admin/config', { method:'POST', headers, body: JSON.stringify({featured: ids}) });
      if (cfgRes.ok) {
        await loadConfig();
        renderFeatured();
      }
      showToast('Ordre des produits mis à jour', 'success');
    });
  });
  // ensure any live changes are reflected
  await loadConfig();
  renderFeatured();
}

// thank you page: fetch order and show details
async function renderMerci() {
  const el = document.getElementById('merci-details');
  if (!el) return;
  const orderId = getParam('order_id');
  if (!orderId) {
    el.innerText = 'Numéro de commande manquant.'; return;
  }
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Commande introuvable');
    el.innerHTML = `<div class="order-details">
      <p><strong>Commande :</strong> ${data.order_number}</p>
      <p><strong>Statut :</strong> ${data.status}</p>
      <p><strong>Total :</strong> ${data.total} €</p>
      <p><strong>Adresse :</strong> ${data.address.line1}, ${data.address.postal_code} ${data.address.city} (${data.address.country})</p>
    </div>`;
  } catch (err) { el.innerText = err.message; }
}

// call renderMerci if needed
if (document.getElementById('merci-details')) renderMerci();

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

window.addEventListener('DOMContentLoaded', init);
