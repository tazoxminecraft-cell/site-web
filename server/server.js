const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');
let stripe = null;
if (process.env.STRIPE_SECRET) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET);
    console.log('Stripe initialized');
  } catch (err) {
    console.error('Stripe initialization failed', err.message);
  }
}
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup uploads directory
if (!fs.existsSync(__dirname + '/uploads')) fs.mkdirSync(__dirname + '/uploads');
const upload = multer({ dest: __dirname + '/uploads' });

// JWT secret for admin tokens
const JWT_SECRET = process.env.JWT_SECRET || 'winter808steps_dev_jwt_secret';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'support@winter808steps.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'winter808steps.fr';

// In-memory stores for demo
const PRODUCTS = [
  { id: 'tshirt-plain', name: 'T-shirt coupe droite', price: 29, variants: [{id:'tshirt-plain-s', size:'S', color:'Blanc', stock:12},{id:'tshirt-plain-m', size:'M', color:'Blanc', stock:8}] },
  { id: 'veste-legere', name: 'Veste légère', price: 89, variants: [{id:'veste-38',size:'38',color:'Noir',stock:6}] },
  { id: 'robe-fluide', name: 'Robe fluide', price:49, variants:[{id:'robe-36',size:'36',color:'Beige',stock:3}] },
  { id: 'baskets-blanches', name: 'Baskets blanches', price:89, variants:[{id:'sneaker-40',size:'40',color:'Blanc',stock:10}] },
  { id: 'jean-slim', name: 'Jean slim', price:59, variants:[{id:'jean-32', size:'32', color:'Bleu', stock:12}] },
  { id: 'casquette', name: 'Casquette', price:19, variants:[{id:'cap-one',size:'One',color:'Noir',stock:21}] },
  { id: 'echarpe', name: 'Écharpe', price:24, variants:[{id:'echarpe-uni',size:'One',color:'Gris',stock:20}] },
  { id: 'sandales', name: 'Sandales', price:39, variants:[{id:'sandales-39', size:'39', color:'Marron', stock:5}] },
  // child-specific product removed per client request
];

// Orders store (persisted)
let ORDERS = {}; // order_id -> order data
const ORDERS_FILE = DATA_DIR + '/orders.json';
// load orders from file if present
try {
  if (fs.existsSync(ORDERS_FILE)) {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') ORDERS = obj;
  } else {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(ORDERS, null, 2));
  }
} catch (err) { console.error('Error reading orders file', err.message); }

function persistOrders() {
  try { fs.writeFileSync(ORDERS_FILE, JSON.stringify(ORDERS, null, 2)); } catch (err) { console.error('Failed to write orders file', err.message); }
}
const PAYMENTS = {}; // payment_id -> payment data

const SELLER_EMAIL = process.env.SELLER_EMAIL || 'support@winter808steps.com';

// create nodemailer transporter (use env vars or a fake provider like ethereal for testing)
async function createTransporter(){
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  // use ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
}

async function sendNotificationEmails(order) {
  const transporter = await createTransporter();
  // build items details
  const itemsText = order.items.map(it => {
    const prod = PRODUCTS.find(p => p.variants?.some(v=>v.id===it.id) || p.id === it.id);
    const variant = prod?.variants?.find(v=>v.id===it.id);
    return `${it.qty} x ${prod?.name || 'Produit inconnu'}${variant ? ` (taille: ${variant.size}, couleur: ${variant.color})` : ''} — ${prod?.price || 0} €`;
  }).join('\n');
  const placeholders = {
    order_number: order.order_number,
    order_date: order.created_at,
    customer_name: order.customer.name,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    street: order.address.line1 + (order.address.line2 ? '\n' + order.address.line2 : ''),
    postal_code: order.address.postal_code,
    city: order.address.city,
    country: order.address.country,
    items: itemsText,
    subtotal: order.subtotal,
    shipping: order.shipping_cost,
    taxes: order.taxes,
    total: order.total,
    payment_method: order.payment_method || 'unknown'
  };
  const sellerTemplate = fs.readFileSync(__dirname + '/email_templates/seller_notification.html', 'utf-8');
  const clientTemplate = fs.readFileSync(__dirname + '/email_templates/client_confirmation.html', 'utf-8');
  const fill = (tpl, data) => {
    let out = tpl;
    Object.keys(data).forEach(k => { out = out.replace(new RegExp('{{' + k + '}}','g'), data[k]); });
    return out;
  };
  const sellerHtml = fill(sellerTemplate, placeholders);
  const clientHtml = fill(clientTemplate, placeholders);
  const sellerMail = {
    from: 'no-reply@winter808steps.com',
    to: SELLER_EMAIL,
    subject: `Nouvelle commande reçue — Commande #${order.order_number}`,
    html: sellerHtml,
    text: `Nouvelle commande: ${order.order_number} — Total: ${order.total} €` 
  };
  const clientMail = {
    from: 'no-reply@winter808steps.com',
    to: order.customer.email,
    subject: `Merci ! Votre commande #${order.order_number} a bien été reçue`,
    html: clientHtml,
    text: `Bonjour ${order.customer.name},\n\nMerci pour votre commande #${order.order_number}. Total: ${order.total} €.\nNous vous recontacterons quand la commande sera expédiée.`
  };
  const [sellerInfo, clientInfo] = await Promise.all([transporter.sendMail(sellerMail), transporter.sendMail(clientMail)]);
  return {sellerInfo, clientInfo};
}

// Products endpoints
// load products from data file if exists
const DATA_DIR = __dirname + '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const ADMINS_FILE = DATA_DIR + '/admins.json';
const PRODUCTS_FILE = DATA_DIR + '/products.json';
try {
  if (fs.existsSync(PRODUCTS_FILE)) {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) PRODUCTS.splice(0, PRODUCTS.length, ...arr);
  } else {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(PRODUCTS, null, 2));
  }
} catch (err) { console.error('Error reading products file', err.message); }

// Admin accounts persistence
let ADMINS = [];
function hashPassword(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }
try {
  if (fs.existsSync(ADMINS_FILE)) {
    const raw = fs.readFileSync(ADMINS_FILE, 'utf-8');
    ADMINS = JSON.parse(raw);
  } else {
    // initialize with default admin if env vars provided
    const defaultAdminEmail = ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'support@winter808steps.com';
    const defaultAdminPass = ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'winter808steps.fr';
    ADMINS = [{email: defaultAdminEmail, passwordHash: hashPassword(defaultAdminPass)}];
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(ADMINS, null, 2));
  }
} catch (err) { console.error('Error reading admins file', err.message); }

app.get('/api/products', (req,res) => {
  res.json(PRODUCTS);
});

app.get('/api/products/:id', (req,res) => {
  const id = req.params.id;
  const p = PRODUCTS.find(x => x.id === id || x.variants.find(v=>v.id===id));
  if (!p) return res.status(404).json({message:'Produit non trouvé'});
  res.json(p);
});

// create order (draft)
app.post('/api/checkout/create-order', (req,res) => {
  const {address, shipping, payment_method, cart} = req.body;
  // simple validation
  if (!address || !cart || !Array.isArray(cart) || cart.length === 0) return res.status(400).json({message:'Données manquantes'});
  const order_id = crypto.randomBytes(8).toString('hex');
  const order_number = new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + order_id.slice(0,6);
  const subtotal = cart.reduce((s,ci) => {
    const prod = PRODUCTS.find(p => p.variants?.some(v=>v.id===ci.id) || p.id === ci.id);
    if (!prod) return s;
    const price = prod.price || 0;
    return s + price * ci.qty;
  },0);
  const shipping_cost = shipping === 'express' ? 12 : 5;
  const taxes = +(subtotal*0.2).toFixed(2);
  const total = +(subtotal + shipping_cost + taxes).toFixed(2);
  const order = {order_id, order_number, status: 'draft', customer: {name: address.first_name + ' ' + address.last_name, email: address.email || '', phone: address.phone}, address, shipping, payment_method, subtotal, shipping_cost, taxes, total, items: cart, created_at: new Date().toISOString() };
  ORDERS[order_id] = order;
  persistOrders();
  // for PayPal, return a fake paypal URL that the frontend would redirect to in a real implementation
  const paypalUrl = `/api/checkout/pay?order_id=${order_id}&method=paypal`;
  res.json({order_id, order_number, subtotal, total, paypal_url: paypalUrl});
});

// Auth endpoints (simple JWT-based)
app.post('/api/auth/login', (req, res) => {
  const {email, password} = req.body || {};
  if (!email || !password) return res.status(400).json({message:'Missing credentials'});
  // find admin account
  let match = null;
  // Check ADMINS file
  if (ADMINS && ADMINS.length) {
    const h = hashPassword(password);
    match = ADMINS.find(a => a.email === email && a.passwordHash === h);
  }
  // fallback to environment variables
  if (!match && email === ADMIN_EMAIL && password === ADMIN_PASSWORD) match = {email};
  if (!match) return res.status(401).json({message:'Invalid credentials'});
  const token = jwt.sign({email}, JWT_SECRET, {expiresIn: '8h'});
  return res.json({ok:true, token, email});
});

// register admin account
app.post('/api/auth/register', (req, res) => {
  const {email, password} = req.body || {};
  if (!email || !password) return res.status(400).json({message:'Missing credentials'});
  // For demo: allow registering additional admin accounts
  if (ADMINS.find(a => a.email === email)) return res.status(400).json({message:'Account already exists'});
  const passwordHash = hashPassword(password);
  const acct = {email, passwordHash};
  ADMINS.push(acct);
  try { fs.writeFileSync(ADMINS_FILE, JSON.stringify(ADMINS, null, 2)); } catch (err) { console.error('Failed to save admin', err.message); }
  const token = jwt.sign({email}, JWT_SECRET, {expiresIn: '8h'});
  return res.json({ok:true, token, email});
});

// Simulated Google OAuth endpoint (DEMO)
app.post('/api/auth/google', (req, res) => {
  // DEPRECATED: In production use Google OAuth2 token verification. For demo we accept a body {email}.
  const {email} = req.body || {};
  if (!email) return res.status(400).json({message:'Missing email'});
  // check if email exists in admin list
  let admin = ADMINS.find(a => a.email === email);
  if (!admin) {
    // optionally auto-create admin or deny
    // In this demo, we auto-create account
    const passwordHash = hashPassword(crypto.randomBytes(8).toString('hex'));
    admin = {email, passwordHash};
    ADMINS.push(admin);
    try { fs.writeFileSync(ADMINS_FILE, JSON.stringify(ADMINS, null, 2)); } catch (err) { console.error('Failed to save admin', err.message); }
  }
  const token = jwt.sign({email}, JWT_SECRET, {expiresIn:'8h'});
  return res.json({ok:true, token, email});
});

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/Bearer\s+(.+)/);
  if (!match) return res.status(401).json({message:'Missing token'});
  const token = match[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; next();
  } catch(err) { return res.status(401).json({message:'Invalid token'}); }
}

// Upload endpoint for admin to publish images
app.post('/api/admin/upload', verifyToken, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({message:'No file uploaded'});
  // Keep the filename and return URL to client
  const filename = path.basename(req.file.path);
  const url = `/uploads/${filename}`;
  res.json({ok:true, url});
});

// Admin: create product
app.post('/api/admin/products', verifyToken, (req, res) => {
  const {id, name, price, images, description, variants} = req.body || {};
  if (!id || !name) return res.status(400).json({message:'Missing id or name'});
  const product = {id, name, price: Number(price) || 0, images: images || [], description: description || '', variants: variants || []};
  // ensure unique id
  const idx = PRODUCTS.findIndex(p => p.id === id);
  if (idx >= 0) { PRODUCTS[idx] = product; } else { PRODUCTS.push(product); }
  // persist to file
  try { fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(PRODUCTS, null,2)); } catch(err) { console.error('Failed to write products file', err); }
  res.json({ok:true, product});
});

// Admin get config / set config
const CONFIG_FILE = DATA_DIR + '/config.json';
let CONFIG = {theme:'default'};
try { if (fs.existsSync(CONFIG_FILE)) CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE,'utf-8')); else fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null,2)); } catch(e){console.error('Config file read/write issue', e.message)};
app.get('/api/config', (req,res) => res.json(CONFIG));
app.post('/api/admin/config', verifyToken, (req,res) => { CONFIG = Object.assign(CONFIG, req.body || {}); fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG,null,2)); res.json({ok:true, config:CONFIG}); });

// initiate payment (simulate PSP response) - card or paypal
app.post('/api/checkout/pay', async (req,res) => {
  const {order_id, method} = req.body;
  const order = ORDERS[order_id];
  if (!order) return res.status(404).json({message: 'Commande non trouvée'});
  // simulate payment intent
  const payment_id = crypto.randomBytes(10).toString('hex');
  PAYMENTS[payment_id] = {payment_id, order_id, method, status:'pending', amount: order.total};
  // If Stripe is configured we will create a PaymentIntent and return the client_secret to the frontend.
  if (method === 'card') {
    if (stripe) {
      try {
        const amountCents = Math.round(order.total * 100);
        const intent = await stripe.paymentIntents.create({ amount: amountCents, currency: 'eur', metadata: { order_id } });
        PAYMENTS[payment_id].status = 'processing';
        PAYMENTS[payment_id].provider_payment_id = intent.id;
        return res.json({ok:true, payment_id, order_id, client_secret: intent.client_secret });
      } catch (err) {
        console.error('Stripe create PaymentIntent failed', err.message);
        return res.status(500).json({message:'Erreur lors de la création du paiement'});
      }
    }
    // Fallback simulation if Stripe not set
    PAYMENTS[payment_id].status = 'succeeded';
    order.status = 'paid';
    persistOrders();
    persistOrders();
    await sendNotificationEmails(order);
    return res.json({ok:true, payment_id, order_id:order_id, order_number:order.order_number});
  }
  res.json({ok:true, payment_id, order_id:order_id});
});

// Simulated PayPal return flow (GET) - in production, PayPal calls webhooks itself
app.get('/api/checkout/pay', async (req,res) => {
  const order_id = req.query.order_id;
  const method = req.query.method || 'paypal';
  const order = ORDERS[order_id];
  if (!order) return res.status(404).send('Commande introuvable');
  // simulate capture
  const payment_id = crypto.randomBytes(10).toString('hex');
  PAYMENTS[payment_id] = {payment_id, order_id, method, status:'succeeded', amount: order.total};
  order.status = 'paid';
  persistOrders();
  try {
    await sendNotificationEmails(order);
    // In a real pay flow, the PSP would redirect back to the site
    return res.redirect(`/merci.html?order_id=${order_id}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Erreur lors de l envoi des emails');
  }
});

// This is the webhook endpoint that PSPS (PayPal/Stripe) would call; for demo we expect a JSON payload with "payment_id" and "signature"
app.post('/api/webhooks/payment', async (req,res) => {
  const payload = req.body;
  const signature = req.headers['x-tpc-signature'] || '';
  // For simplicity, we verify by checking a shared secret env var; in prod, use PSPs signature verification
  const secret = process.env.WEBHOOK_SECRET || 'test_shared_secret';
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  if (signature !== expected) return res.status(400).json({message:'Signature invalide'});
  // find payment & order
  const payment = PAYMENTS[payload.payment_id];
  if (!payment) return res.status(404).json({message:'Paiement inconnu'});
  payment.status = 'succeeded';
  const order = ORDERS[payment.order_id];
  if (!order) return res.status(404).json({message:'Commande non trouvée pour ce paiement'});
  order.status = 'paid';
  persistOrders();
  // send emails to seller and client
  try {
    const info = await sendNotificationEmails(order);
    console.log('Emails envoyés', info);
    return res.json({ok:true});
  } catch (err) {
    console.error('Erreur lors de l envoi du mail', err);
    return res.status(500).json({message:'Erreur lors de l envoi du mail'});
  }
});

// Stripe webhook handling if STRIPE_SECRET set
app.post('/api/webhooks/stripe', bodyParser.raw({type: 'application/json'}), async (req,res) => {
  if (!stripe) return res.status(400).json({message:'Stripe not configured'});
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err.message);
    return res.status(400).json({message:'Signature invalide'});
  }
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const orderId = intent.metadata.order_id;
    const order = ORDERS[orderId];
    if (!order) return res.status(404).json({message:'Order not found'});
    order.status = 'paid';
    // record payment
    const paymentId = crypto.randomBytes(8).toString('hex');
    PAYMENTS[paymentId] = {payment_id: paymentId, order_id: orderId, status: 'succeeded', provider:'stripe', provider_payment_id: intent.id, amount: intent.amount/100 };
    // send emails
    try { await sendNotificationEmails(order); } catch (err) { console.error(err); }
  }
  return res.json({ok:true});
});

// Admin endpoint
app.get('/api/admin/orders', verifyToken, (req,res) => {
  // admin listing
  res.json(Object.values(ORDERS));
});

app.get('/api/orders/:order_id', (req,res) => {
  const id = req.params.order_id;
  const order = ORDERS[id];
  if (!order) return res.status(404).json({message:'Commande introuvable'});
  res.json(order);
});

// mark shipped (simple admin action, no auth here)
app.post('/api/admin/ship', verifyToken, async (req,res) => {
  const {order_id, carrier, tracking} = req.body;
  const order = ORDERS[order_id];
  if (!order) return res.status(404).json({message: 'Commande introuvable'});
  order.status = 'shipped';
  order.shipments = order.shipments || [];
  order.shipments.push({carrier, tracking, shipped_at: new Date().toISOString()});
  // send a simple shipment email to client
  const transporter = await createTransporter();
  const clientMail = {
    from: 'no-reply@winter808steps.com',
    to: order.customer.email,
    subject: `Votre commande ${order.order_number} a été expédiée`,
    text: `Bonjour ${order.customer.name},\n\nVotre commande ${order.order_number} a été expédiée. Suivi: ${tracking} (${carrier}).`,
  };
  try {
    await transporter.sendMail(clientMail);
    persistOrders();
    return res.json({ok:true});
  } catch(err){
    console.error('Erreur envoi mail expédition', err);
    return res.status(500).json({message:'Erreur envoi mail'});
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
