// ══════════════════════════════════════════════
//  RO NEWS — Backend Server
//  Node.js + Express + lowdb + JWT
// ══════════════════════════════════════════════

require('dotenv').config();
if (!process.env.JWT_SECRET || !process.env.ADMIN_PASS) {
  console.error("❌ ENV belum di set!");
  process.exit(1);
}
const express  = require('express');
const low      = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const cors     = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
             && allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Hanya file gambar yang diizinkan!'));
  }
});

// ══════════════════════════════════════════════
//  DATABASE
// ══════════════════════════════════════════════
const adapter = new FileSync('database.json');
const db = low(adapter);

function nextId(collection) {
  const items = db.get(collection).value();
  if (items.length === 0) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
}

function now() {
  return new Date().toLocaleString('sv-SE');
}

db.defaults({ users: [], articles: [] }).write();

// Seed admin default
const adminExists = db.get('users').find({ username: 'admin' }).value();
if (!adminExists) {
const hashed = bcrypt.hashSync(process.env.ADMIN_PASS, 10);
  db.get('users').push({
    id: 1, username: 'admin', password: hashed, role: 'admin',
    full_name: 'Administrator', bio: '', avatar_url: null
  }).write();
  console.log('✅ Admin default dibuat: admin / admin123');
}

// Seed artikel contoh
const articleCount = db.get('articles').value().length;
if (articleCount === 0) {
  db.get('articles').push({
    id: 1,
    title: 'Penjual Es Buah Diserbu Pembeli Saat Menjelang Berbuka',
    subtitle: 'Fenomena Ramadan yang Selalu Berulang',
    category: 'Kuliner',
    content: 'Menjelang waktu berbuka puasa, suasana di sekitar alun-alun kota tampak semakin ramai dan semarak.\n\nPak Hendra (48), salah seorang penjual es buah di kawasan tersebut, mengaku sudah berjualan di tempat yang sama selama lebih dari dua belas tahun.',
    quote: 'Setiap Ramadan, rezeki saya bisa dua sampai tiga kali lipat. Alhamdulillah.',
    image_url: null, author: 'Reporter RO NEWS', author_id: 1,
    price_info: 'Rp 8.000 – Rp 15.000 per porsi',
    published: 1, created_at: now(), updated_at: now()
  }).write();
  console.log('✅ Artikel contoh ditambahkan');
}

// ══════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  next();
}

// ══════════════════════════════════════════════
//  ROUTES: AUTH
// ══════════════════════════════════════════════

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const user = db.get('users').find({ username }).value();
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Username atau password salah' });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET, { expiresIn: '24h' }
  );
  res.json({ token, username: user.username, role: user.role });
});

app.post('/api/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!bcrypt.compareSync(oldPassword, user.password))
    return res.status(400).json({ error: 'Password lama salah' });
  const hashed = bcrypt.hashSync(newPassword, 10);
  db.get('users').find({ id: req.user.id }).assign({ password: hashed }).write();
  res.json({ message: 'Password berhasil diubah' });
});

// ══════════════════════════════════════════════
//  ROUTES: PROFIL
// ══════════════════════════════════════════════

// GET profil sendiri
app.get('/api/profile', authMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

// PUT update profil (nama, bio)
app.put('/api/profile', authMiddleware, (req, res) => {
  const { full_name, bio } = req.body;
  db.get('users').find({ id: req.user.id }).assign({
    full_name: full_name || '',
    bio: bio || ''
  }).write();
  res.json({ message: 'Profil berhasil diperbarui' });
});

// POST upload avatar
app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tidak ada file' });
  const user = db.get('users').find({ id: req.user.id }).value();
  // hapus avatar lama
  if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
    const old = '.' + user.avatar_url;
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  const avatar_url = `/uploads/${req.file.filename}`;
  db.get('users').find({ id: req.user.id }).assign({ avatar_url }).write();
  res.json({ avatar_url });
});

// GET profil publik berdasarkan user id (untuk card berita)
app.get('/api/users/:id/profile', (req, res) => {
  const user = db.get('users').find({ id: Number(req.params.id) }).value();
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ id: user.id, username: user.username, full_name: user.full_name || '', bio: user.bio || '', avatar_url: user.avatar_url || null });
});

// ══════════════════════════════════════════════
//  ROUTES: USER MANAGEMENT (admin only)
// ══════════════════════════════════════════════

// GET semua user
app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.get('users').value().map(({ password: _, ...u }) => u);
  res.json(users);
});

// POST buat akun baru
app.post('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const exists = db.get('users').find({ username }).value();
  if (exists) return res.status(400).json({ error: 'Username sudah dipakai' });
  const hashed = bcrypt.hashSync(password, 10);
  const user = {
    id: nextId('users'), username, password: hashed,
    role: role || 'admin', full_name: full_name || '',
    bio: '', avatar_url: null, created_at: now()
  };
  db.get('users').push(user).write();
  const { password: _, ...safe } = user;
  res.status(201).json(safe);
});

// DELETE akun (tidak bisa hapus diri sendiri)
app.delete('/api/admin/users/:id', authMiddleware, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
  const user = db.get('users').find({ id }).value();
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  db.get('users').remove({ id }).write();
  res.json({ message: 'Akun berhasil dihapus' });
});

// ══════════════════════════════════════════════
//  ROUTES: ARTICLES (PUBLIC)
// ══════════════════════════════════════════════

app.get('/api/articles', (req, res) => {
  const { category, limit = 20, offset = 0 } = req.query;
  let items = db.get('articles').filter({ published: 1 }).value();
  if (category) items = items.filter(a => a.category === category);
  items = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  items = items.slice(Number(offset), Number(offset) + Number(limit));

  // Attach avatar dari user
  const users = db.get('users').value();
  items = items.map(a => {
    const u = users.find(u => u.id === a.author_id);
    return { ...a, author_avatar: u?.avatar_url || null, author_display: u?.full_name || a.author };
  });

  res.json(items);
});

app.get('/api/articles/:id', (req, res) => {
  const article = db.get('articles').find({ id: Number(req.params.id), published: 1 }).value();
  if (!article) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
  const u = db.get('users').find({ id: article.author_id }).value();
  res.json({ ...article, author_avatar: u?.avatar_url || null, author_display: u?.full_name || article.author });
});

app.get('/api/categories', (req, res) => {
  const articles = db.get('articles').filter({ published: 1 }).value();
  const cats = [...new Set(articles.map(a => a.category))];
  res.json(cats);
});

// ══════════════════════════════════════════════
//  ROUTES: ARTICLES (ADMIN)
// ══════════════════════════════════════════════

app.get('/api/admin/articles', authMiddleware, (req, res) => {
  const items = db.get('articles').value()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(items);
});

app.post('/api/admin/articles', authMiddleware, upload.single('image'), (req, res) => {
  const { title, subtitle, category, content, quote, author, price_info, published } = req.body;
  if (!title || !content)
    return res.status(400).json({ error: 'Judul dan isi wajib diisi' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
  const article = {
    id: nextId('articles'), title,
    subtitle: subtitle || '', category: category || 'Umum',
    content, quote: quote || '', image_url,
    author: author || req.user.username,
    author_id: req.user.id,
    price_info: price_info || '',
    published: published === '1' ? 1 : 0,
    created_at: now(), updated_at: now()
  };
  db.get('articles').push(article).write();
  res.status(201).json({ id: article.id, message: 'Artikel berhasil ditambahkan' });
});

app.put('/api/admin/articles/:id', authMiddleware, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.get('articles').find({ id }).value();
  if (!existing) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
  const { title, subtitle, category, content, quote, author, price_info, published } = req.body;
  let image_url = existing.image_url;
  if (req.file) {
    if (existing.image_url && existing.image_url.startsWith('/uploads/')) {
      const oldPath = '.' + existing.image_url;
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image_url = `/uploads/${req.file.filename}`;
  } else if (req.body.image_url !== undefined) {
    image_url = req.body.image_url;
  }
  const updates = {
    title: title || existing.title,
    subtitle: subtitle ?? existing.subtitle,
    category: category || existing.category,
    content: content || existing.content,
    quote: quote ?? existing.quote,
    image_url,
    author: author || existing.author,
    price_info: price_info ?? existing.price_info,
    published: published !== undefined ? (published === '1' ? 1 : 0) : existing.published,
    updated_at: now()
  };
  db.get('articles').find({ id }).assign(updates).write();
  res.json({ message: 'Artikel berhasil diperbarui' });
});

app.delete('/api/admin/articles/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.get('articles').find({ id }).value();
  if (!existing) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
  if (existing.image_url && existing.image_url.startsWith('/uploads/')) {
    const imgPath = '.' + existing.image_url;
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  db.get('articles').remove({ id }).write();
  res.json({ message: 'Artikel berhasil dihapus' });
});

app.patch('/api/admin/articles/:id/toggle', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const article = db.get('articles').find({ id }).value();
  if (!article) return res.status(404).json({ error: 'Tidak ditemukan' });
  const newStatus = article.published ? 0 : 1;
  db.get('articles').find({ id }).assign({ published: newStatus }).write();
  res.json({ published: !!newStatus });
});

module.exports = app;