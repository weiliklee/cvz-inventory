import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Package, ArrowLeftRight, Truck, Plus, Search,
  Pencil, Trash2, X, AlertTriangle, TrendingUp, TrendingDown,
  CheckCircle2, Circle, ChevronDown, Sofa, Download, Upload, LogOut, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { COLORS } from './theme.js';
import { useAuth } from './useAuth.js';
import { useTextSize } from './useTextSize.js';
import { SUPPORTED_LANGUAGES, persistLanguage } from './i18n/index.js';
import { LoginForm, SetPasswordForm } from './Auth.jsx';

// Canonical English values — these are what's stored in the database and
// what the reason/category dropdowns emit. Display labels are translated
// via t(`categories.${value}`) / t(`reasons.${value}`); the stored value
// never changes with the UI language.
const CATEGORIES = ['Sofa', 'Dining', 'Bedroom', 'Office', 'Storage', 'Outdoor', 'Decor', 'Other'];
const REASONS_IN = ['Restock', 'Purchase order', 'Customer return', 'Stock correction'];
const REASONS_OUT = ['Sale', 'Invoice', 'Damaged / write-off', 'Showroom display', 'Stock correction'];

const fmtMYR = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
const genId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const categoryLabel = (t, category) => t(`categories.${category}`, category);
const reasonLabel = (t, reason) => t(`reasons.${reason}`, reason);
const statusLabel = (t, status) => t(`status.${status}`, status);

const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
    .font-display { font-family: 'Fraunces', serif; }
    .font-body { font-family: 'IBM Plex Sans', sans-serif; }
    .font-mono { font-family: 'IBM Plex Mono', monospace; }
  `}</style>
);

import { supabase } from './supabaseClient.js';

// DB rows use snake_case; the app uses camelCase.
const productFromRow = (r) => ({
  id: r.id, name: r.name, sku: r.sku || '', category: r.category || CATEGORIES[0],
  material: r.material || '', color: r.color || '', dimensions: r.dimensions || '',
  costPrice: Number(r.cost_price) || 0, sellPrice: Number(r.sell_price) || 0,
  stock: Number(r.stock) || 0, reorderLevel: Number(r.reorder_level) || 0, supplier: r.supplier || '',
});
const productToRow = (p) => ({
  id: p.id, name: p.name, sku: p.sku || null, category: p.category, material: p.material || null,
  color: p.color || null, dimensions: p.dimensions || null, cost_price: p.costPrice, sell_price: p.sellPrice,
  stock: p.stock, reorder_level: p.reorderLevel, supplier: p.supplier || null,
});
const movementFromRow = (r) => ({
  id: r.id, productId: r.product_id, productName: r.product_name, sku: r.sku,
  type: r.type, qty: r.qty, reason: r.reason, reference: r.reference, notes: r.notes, date: r.date,
});
const movementToRow = (m) => ({
  id: m.id, product_id: m.productId, product_name: m.productName, sku: m.sku || null,
  type: m.type, qty: m.qty, reason: m.reason || null, reference: m.reference || null, notes: m.notes || null, date: m.date,
});
const poFromRow = (r) => ({
  id: r.id, poNumber: r.po_number, supplier: r.supplier, status: r.status, items: r.items, date: r.date, receivedDate: r.received_date,
});
const poToRow = (o) => ({
  id: o.id, po_number: o.poNumber, supplier: o.supplier, status: o.status, items: o.items, date: o.date, received_date: o.receivedDate || null,
});

function useSupabaseStore() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pos, setPos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = async () => {
    try {
      const [p, m, o] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('movements').select('*').order('date', { ascending: false }),
        supabase.from('purchase_orders').select('*').order('date', { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (m.error) throw m.error;
      if (o.error) throw o.error;
      setProducts((p.data || []).map(productFromRow));
      setMovements((m.data || []).map(movementFromRow));
      setPos((o.data || []).map(poFromRow));
      setError(null);
    } catch (e) {
      console.error('[inventory-app] Supabase load failed:', e);
      setError(t('errors.loadFailed', { message: e.message }));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { loadAll(); }, []);

  async function insertProduct(product) {
    try {
      const { data, error } = await supabase.from('products').insert(productToRow(product)).select();
      if (error) throw error;
      setProducts(prev => [...prev, productFromRow(data[0])]);
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.saveProductFailed', { message: e.message })); }
  }

  async function editProduct(product) {
    try {
      const { id, ...rest } = productToRow(product);
      const { error } = await supabase.from('products').update(rest).eq('id', product.id);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.updateProductFailed', { message: e.message })); }
  }

  async function removeProduct(id) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.deleteProductFailed', { message: e.message })); }
  }

  async function addMovement(movement) {
    try {
      const { data, error } = await supabase.rpc('record_stock_movement', {
        p_movement_id: movement.id,
        p_product_id: movement.productId,
        p_type: movement.type,
        p_qty: movement.qty,
        p_reason: movement.reason || null,
        p_reference: movement.reference || null,
        p_notes: movement.notes || null,
        p_date: movement.date,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      setMovements(prev => [{ ...movement, productName: result.productName, sku: result.sku }, ...prev]);
      setProducts(prev => prev.map(p => p.id === movement.productId ? { ...p, stock: Number(result.newStock) } : p));
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.logMovementFailed', { message: e.message })); }
  }

  async function addPO(po) {
    try {
      const { data, error } = await supabase.from('purchase_orders').insert(poToRow(po)).select();
      if (error) throw error;
      setPos(prev => [poFromRow(data[0]), ...prev]);
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.createPOFailed', { message: e.message })); }
  }

  async function receivePOAction(po) {
    try {
      const { data, error } = await supabase.rpc('receive_purchase_order', { p_po_id: po.id });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const receivedDate = result.receivedDate;
      const stockUpdates = result.stockUpdates || [];
      const newMovements = result.movements || [];
      setPos(prev => prev.map(o => o.id === po.id ? { ...o, status: 'received', receivedDate } : o));
      setProducts(prev => prev.map(p => { const u = stockUpdates.find(x => x.id === p.id); return u ? { ...p, stock: Number(u.stock) } : p; }));
      setMovements(prev => [...newMovements, ...prev]);
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.receivePOFailed', { message: e.message })); }
  }

  async function cancelPOAction(id) {
    try {
      const { error } = await supabase.from('purchase_orders').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      setPos(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
      setError(null);
    } catch (e) { console.error(e); setError(t('errors.cancelPOFailed', { message: e.message })); }
  }

  async function replaceAll(newProducts, newMovements, newPos) {
    try {
      await supabase.from('movements').delete().not('id', 'is', null);
      await supabase.from('purchase_orders').delete().not('id', 'is', null);
      await supabase.from('products').delete().not('id', 'is', null);
      if (newProducts.length) { const { error } = await supabase.from('products').insert(newProducts.map(productToRow)); if (error) throw error; }
      if (newMovements.length) { const { error } = await supabase.from('movements').insert(newMovements.map(movementToRow)); if (error) throw error; }
      if (newPos.length) { const { error } = await supabase.from('purchase_orders').insert(newPos.map(poToRow)); if (error) throw error; }
      await loadAll();
    } catch (e) { console.error(e); setError(t('errors.importBackupFailed', { message: e.message })); }
  }

  return { products, movements, pos, loaded, error, setError, insertProduct, editProduct, removeProduct, addMovement, addPO, receivePOAction, cancelPOAction, replaceAll };
}


// ---------- Small UI atoms ----------
function Button({ children, onClick, variant = 'primary', icon: Icon, type = 'button', className = '' }) {
  const styles = {
    primary: { backgroundColor: COLORS.walnut, color: '#fff', border: `1px solid ${COLORS.walnut}` },
    ghost: { backgroundColor: 'transparent', color: COLORS.ink, border: `1px solid ${COLORS.border}` },
    danger: { backgroundColor: 'transparent', color: COLORS.rust, border: `1px solid ${COLORS.rustBg}` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-sm font-medium font-body transition-opacity hover:opacity-80 ${className}`}
      style={styles[variant]}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: COLORS.borderSoft, fg: COLORS.inkSoft },
    good: { bg: COLORS.sageBg, fg: COLORS.sage },
    warn: { bg: COLORS.goldBg, fg: COLORS.gold },
    bad: { bg: COLORS.rustBg, fg: COLORS.rust },
  };
  const t = tones[tone];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-body"
      style={{ backgroundColor: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(42,36,32,0.45)' }}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-lg shadow-xl overflow-y-auto my-8`}
        style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ backgroundColor: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-display text-lg" style={{ color: COLORS.ink }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ color: COLORS.inkSoft }}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: `1px solid ${COLORS.border}`,
  backgroundColor: COLORS.bg,
  color: COLORS.ink,
  fontSize: '0.875rem',
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
};

// ---------- Language + text size (sidebar controls) ----------
function LanguageSelector({ compact }) {
  const { i18n } = useTranslation();
  return (
    <select
      value={SUPPORTED_LANGUAGES.some(l => l.code === i18n.language) ? i18n.language : 'en'}
      onChange={(e) => { i18n.changeLanguage(e.target.value); persistLanguage(e.target.value); }}
      className={`rounded font-body text-xs outline-none ${compact ? 'px-2 py-1 shrink-0' : 'w-full px-2 py-1.5'}`}
      style={{ backgroundColor: 'rgba(245,238,221,0.08)', color: '#F5EEDD', border: '1px solid rgba(245,238,221,0.2)' }}
    >
      {SUPPORTED_LANGUAGES.map(l => (
        <option key={l.code} value={l.code} style={{ color: COLORS.ink }}>{l.label}</option>
      ))}
    </select>
  );
}

function TextSizeControl({ textSize }) {
  const { t } = useTranslation();
  const { decrease, increase, reset, canDecrease, canIncrease } = textSize;
  const btnStyle = (enabled) => ({
    color: enabled ? '#F5EEDD' : 'rgba(245,238,221,0.35)',
    border: '1px solid rgba(245,238,221,0.2)',
    backgroundColor: 'rgba(245,238,221,0.08)',
  });
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={decrease} disabled={!canDecrease} title={t('textSize.decrease')} aria-label={t('textSize.decrease')}
        className="w-7 h-7 rounded font-mono text-xs flex items-center justify-center" style={btnStyle(canDecrease)}>A−</button>
      <button type="button" onClick={reset} title={t('textSize.reset')} aria-label={t('textSize.reset')}
        className="w-7 h-7 rounded font-mono text-xs flex items-center justify-center" style={btnStyle(true)}>A</button>
      <button type="button" onClick={increase} disabled={!canIncrease} title={t('textSize.increase')} aria-label={t('textSize.increase')}
        className="w-7 h-7 rounded font-mono text-xs flex items-center justify-center" style={btnStyle(canIncrease)}>A+</button>
    </div>
  );
}

// ---------- Root (auth gate) ----------
export default function Root() {
  const { t } = useTranslation();
  const { loading, session, profile, signOut } = useAuth();
  const textSize = useTextSize();

  const inviteFlow = typeof window !== 'undefined' &&
    (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery'));
  const [settingPassword, setSettingPassword] = useState(inviteFlow);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <div className="font-body text-sm" style={{ color: COLORS.inkSoft }}>{t('common.loading')}</div>
      </div>
    );
  }

  if (!session) return <LoginForm />;

  if (settingPassword) {
    return (
      <SetPasswordForm onDone={() => {
        setSettingPassword(false);
        window.history.replaceState(null, '', window.location.pathname);
      }} />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <div className="font-body text-sm" style={{ color: COLORS.inkSoft }}>{t('common.settingUpAccount')}</div>
      </div>
    );
  }

  return <InventoryApp profile={profile} onLogout={signOut} textSize={textSize} />;
}

// ---------- App ----------
function InventoryApp({ profile, onLogout, textSize }) {
  const { t } = useTranslation();
  const canEdit = profile.role === 'editor';
  const { products, movements, pos, loaded, error, setError, insertProduct, editProduct, removeProduct, addMovement, addPO, receivePOAction, cancelPOAction, replaceAll } = useSupabaseStore();
  const [view, setView] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [productModal, setProductModal] = useState(null); // null | 'new' | product obj
  const [movementModal, setMovementModal] = useState(null); // null | product obj (preset)
  const [poModal, setPoModal] = useState(false);

  const stockValue = useMemo(() => products.reduce((s, p) => s + p.stock * p.costPrice, 0), [products]);
  const lowStock = useMemo(() => products.filter(p => p.stock <= p.reorderLevel), [products]);
  const pendingPOs = useMemo(() => pos.filter(o => o.status === 'ordered'), [pos]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !search || [p.name, p.sku, p.material, p.color].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, search, categoryFilter]);

  function saveProduct(data) {
    if (data.id) {
      editProduct(data);
    } else {
      insertProduct({ ...data, id: genId('prod'), stock: Number(data.stock) || 0 });
    }
    setProductModal(null);
  }

  function deleteProduct(id) {
    removeProduct(id);
  }

  function recordMovement({ productId, type, qty, reason, reference, notes }) {
    qty = Number(qty);
    if (!productId || !qty || qty <= 0) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const movement = { id: genId('mov'), productId, productName: product.name, sku: product.sku, type, qty, reason, reference, notes, date: new Date().toISOString() };
    addMovement(movement);
    setMovementModal(null);
  }

  function createPO(data) {
    addPO({ ...data, id: genId('po'), status: 'ordered', date: new Date().toISOString() });
    setPoModal(false);
  }

  function receivePO(po) {
    receivePOAction(po);
  }

  function cancelPO(id) {
    cancelPOAction(id);
  }

  const fileInputRef = useRef(null);

  function exportData() {
    const payload = { products, movements, pos, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cvz-inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const productRows = products.map(p => ({
      SKU: p.sku, Name: p.name, Category: p.category, Material: p.material, Color: p.color,
      Dimensions: p.dimensions, Supplier: p.supplier, 'Cost Price (RM)': p.costPrice,
      'Sell Price (RM)': p.sellPrice, Stock: p.stock, 'Reorder Level': p.reorderLevel,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products');

    const movementRows = movements.map(m => ({
      Date: fmtDate(m.date), Product: m.productName, SKU: m.sku,
      Type: m.type === 'in' ? 'Stock in' : 'Stock out', Qty: m.qty,
      Reason: m.reason, Reference: m.reference, Notes: m.notes,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movementRows), 'Stock Log');

    const poRows = pos.map(o => ({
      'PO Number': o.poNumber, Supplier: o.supplier, Status: o.status,
      Date: fmtDate(o.date), 'Received Date': o.receivedDate ? fmtDate(o.receivedDate) : '',
      'Total (RM)': o.items.reduce((s, i) => s + i.qty * i.cost, 0),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(poRows), 'Purchase Orders');

    const poItemRows = pos.flatMap(o => o.items.map(it => ({
      'PO Number': o.poNumber, Supplier: o.supplier, Product: it.productName,
      Qty: it.qty, 'Cost/Unit (RM)': it.cost, 'Line Total (RM)': it.qty * it.cost,
    })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(poItemRows), 'PO Line Items');

    XLSX.writeFile(wb, `cvz-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Not a valid backup file');
        const ok = confirm(t('common.confirmImportBackup'));
        if (!ok) return;
        replaceAll(
          Array.isArray(parsed.products) ? parsed.products : [],
          Array.isArray(parsed.movements) ? parsed.movements : [],
          Array.isArray(parsed.pos) ? parsed.pos : []
        );
      } catch (err) {
        setError(t('common.invalidBackupFile'));
      }
    };
    reader.readAsText(file);
  }

  const nav = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'products', label: t('nav.products'), icon: Package },
    { id: 'movements', label: t('nav.stockLog'), icon: ArrowLeftRight },
    { id: 'pos', label: t('nav.purchaseOrders'), icon: Truck },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <FontImport />
        <div className="font-body text-sm" style={{ color: COLORS.inkSoft }}>{t('common.connectingToSupabase')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: COLORS.bg }}>
      <FontImport />

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col py-6 px-4" style={{ backgroundColor: COLORS.walnutDark, borderRight: `1px solid ${COLORS.walnutDark}` }}>
        <div className="flex items-center gap-2 px-2 mb-8">
          <Sofa size={20} color="#F5EEDD" />
          <div>
            <div className="font-display text-base leading-none" style={{ color: '#FAF6F0' }}>CVZ Stock</div>
            <div className="font-mono tracking-wide mt-0.5" style={{ color: '#B08A45', fontSize: '0.625rem' }}>{t('app.tagline').toUpperCase()}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm font-body font-medium transition-colors"
              style={{
                backgroundColor: view === n.id ? 'rgba(245,238,221,0.12)' : 'transparent',
                color: view === n.id ? '#F5EEDD' : '#C9BEA8',
              }}
            >
              <n.icon size={16} className="shrink-0" />
              <span className="flex-1 text-left">{n.label}</span>
              {n.id === 'pos' && pendingPOs.length > 0 && (
                <span className="font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: COLORS.gold, color: '#2A2420', fontSize: '0.625rem' }}>
                  {pendingPOs.length}
                </span>
              )}
              {n.id === 'dashboard' && lowStock.length > 0 && (
                <span className="font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: COLORS.rust, color: '#fff', fontSize: '0.625rem' }}>
                  {lowStock.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(245,238,221,0.12)' }}>
          <button type="button" onClick={exportExcel} className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ color: '#C9BEA8' }}>
            <FileSpreadsheet size={14} className="shrink-0" /> {t('sidebar.exportExcel')}
          </button>
          <button type="button" onClick={exportData} className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ color: '#C9BEA8' }}>
            <Download size={14} className="shrink-0" /> {t('sidebar.exportBackup')}
          </button>
          {canEdit && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ color: '#C9BEA8' }}>
              <Upload size={14} className="shrink-0" /> {t('sidebar.importBackup')}
            </button>
          )}

          <div className="mt-2 pt-3 flex flex-col gap-2.5" style={{ borderTop: '1px solid rgba(245,238,221,0.12)' }}>
            <div>
              <span className="block font-mono uppercase tracking-wide mb-1" style={{ color: '#B08A45', fontSize: '0.625rem' }}>{t('sidebar.language')}</span>
              <LanguageSelector />
            </div>
            <div>
              <span className="block font-mono uppercase tracking-wide mb-1" style={{ color: '#B08A45', fontSize: '0.625rem' }}>{t('sidebar.textSize')}</span>
              <TextSizeControl textSize={textSize} />
            </div>
          </div>

          <div className="mt-2 pt-2 flex items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(245,238,221,0.12)' }}>
            <div className="min-w-0">
              <div className="font-body text-xs truncate" style={{ color: '#F5EEDD' }}>{profile.email}</div>
              <div className="font-mono uppercase tracking-wide" style={{ color: '#B08A45', fontSize: '0.625rem' }}>{profile.role === 'editor' ? t('common.roleEditor') : t('common.roleViewer')}</div>
            </div>
            <button type="button" onClick={onLogout} title={t('sidebar.signOut')} className="shrink-0 p-1.5 rounded" style={{ color: '#C9BEA8' }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) importData(e.target.files[0]); e.target.value = ''; }}
      />

      {/* Top bar + nav (mobile) */}
      <div className="md:hidden sticky top-0 z-40" style={{ backgroundColor: COLORS.walnutDark }}>
        <div className="flex items-center gap-2 px-4 py-3">
          <Sofa size={18} color="#F5EEDD" />
          <div className="font-display text-base leading-none" style={{ color: '#FAF6F0' }}>CVZ Stock</div>
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={exportExcel} title={t('sidebar.exportExcel')} style={{ color: '#C9BEA8' }}><FileSpreadsheet size={16} /></button>
            <button type="button" onClick={exportData} title={t('sidebar.exportBackup')} style={{ color: '#C9BEA8' }}><Download size={16} /></button>
            {canEdit && (
              <button type="button" onClick={() => fileInputRef.current?.click()} title={t('sidebar.importBackup')} style={{ color: '#C9BEA8' }}><Upload size={16} /></button>
            )}
            <button type="button" onClick={onLogout} title={t('sidebar.signOut')} style={{ color: '#C9BEA8' }}><LogOut size={16} /></button>
          </div>
        </div>
        <nav className="flex overflow-x-auto gap-1 px-2 pb-2 -mt-1">
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-body font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: view === n.id ? 'rgba(245,238,221,0.12)' : 'transparent',
                color: view === n.id ? '#F5EEDD' : '#C9BEA8',
              }}
            >
              <n.icon size={14} />
              {n.label}
              {n.id === 'pos' && pendingPOs.length > 0 && (
                <span className="font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: COLORS.gold, color: '#2A2420', fontSize: '0.5625rem' }}>
                  {pendingPOs.length}
                </span>
              )}
              {n.id === 'dashboard' && lowStock.length > 0 && (
                <span className="font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: COLORS.rust, color: '#fff', fontSize: '0.5625rem' }}>
                  {lowStock.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 px-2 pb-2.5 overflow-x-auto">
          <LanguageSelector compact />
          <TextSizeControl textSize={textSize} />
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full min-w-0 overflow-x-hidden">
        {error && (
          <div className="mb-4 px-4 py-2.5 rounded text-sm font-body flex items-center justify-between gap-3" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0"><X size={14} /></button>
          </div>
        )}

        {view === 'dashboard' && (
          <Dashboard
            products={products}
            movements={movements}
            pos={pos}
            stockValue={stockValue}
            lowStock={lowStock}
            pendingPOs={pendingPOs}
            canEdit={canEdit}
            onRestock={(p) => setMovementModal(p)}
            onNavigate={(v) => setView(v)}
            onNewMovement={() => setMovementModal({})}
            onNewPO={() => setPoModal(true)}
          />
        )}

        {view === 'products' && (
          <ProductsView
            products={filteredProducts}
            total={products.length}
            search={search} setSearch={setSearch}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            canEdit={canEdit}
            onNew={() => setProductModal('new')}
            onEdit={(p) => setProductModal(p)}
            onDelete={deleteProduct}
            onMove={(p) => setMovementModal(p)}
          />
        )}

        {view === 'movements' && <MovementsView movements={movements} products={products} canEdit={canEdit} onNew={() => setMovementModal({})} />}

        {view === 'pos' && <PurchaseOrdersView pos={pos} canEdit={canEdit} onNew={() => setPoModal(true)} onReceive={receivePO} onCancel={cancelPO} />}
      </main>

      {productModal && canEdit && (
        <ProductModal
          initial={productModal === 'new' ? null : productModal}
          onClose={() => setProductModal(null)}
          onSave={saveProduct}
        />
      )}

      {movementModal && canEdit && (
        <MovementModal
          products={products}
          preset={movementModal.id ? movementModal : null}
          onClose={() => setMovementModal(null)}
          onSave={recordMovement}
        />
      )}

      {poModal && canEdit && (
        <POModal products={products} onClose={() => setPoModal(false)} onSave={createPO} />
      )}
    </div>
  );
}

// ---------- Dashboard ----------
const LOW_STOCK_DISPLAY_LIMIT = 6;
const PENDING_PO_DISPLAY_LIMIT = 4;
const RECENT_ACTIVITY_LIMIT = 6;

function Dashboard({ products, movements, pos, stockValue, lowStock, pendingPOs, canEdit, onRestock, onNavigate, onNewMovement, onNewPO }) {
  const { t } = useTranslation();
  const recent = movements.slice(0, RECENT_ACTIVITY_LIMIT);

  const visibleLowStock = useMemo(
    () => [...lowStock].sort((a, b) => (a.stock - a.reorderLevel) - (b.stock - b.reorderLevel)).slice(0, LOW_STOCK_DISPLAY_LIMIT),
    [lowStock]
  );

  const visiblePendingPOs = useMemo(
    () => [...pendingPOs].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, PENDING_PO_DISPLAY_LIMIT),
    [pendingPOs]
  );

  // Stock value by category — reuses the same numbers as the "Stock on hand
  // value" KPI above, just broken down. Skipped entirely if there's nothing
  // meaningful to show rather than rendering a degenerate one-bar chart.
  const categoryBreakdown = useMemo(() => {
    if (!products.length || stockValue <= 0) return [];
    const totals = {};
    products.forEach(p => { totals[p.category] = (totals[p.category] || 0) + p.stock * p.costPrice; });
    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value]) => ({ category, pct: Math.round((value / stockValue) * 100) }));
  }, [products, stockValue]);

  return (
    <div>
      <header className="mb-7">
        <h1 className="font-display text-2xl" style={{ color: COLORS.ink }}>{t('dashboard.title')}</h1>
        <p className="font-body text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{t('dashboard.subtitle')}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard label={t('dashboard.kpi.productsTracked')} value={products.length} icon={Package} />
        <StatCard label={t('dashboard.kpi.stockOnHandValue')} value={fmtMYR(stockValue)} icon={TrendingUp} />
        <StatCard label={t('dashboard.kpi.lowStockItems')} value={lowStock.length} icon={AlertTriangle} tone={lowStock.length ? 'bad' : 'good'} />
        <StatCard label={t('dashboard.kpi.posAwaitingReceipt')} value={pendingPOs.length} icon={Truck} tone={pendingPOs.length ? 'warn' : 'good'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DashboardPanel title={t('dashboard.panels.lowStock')} badge={lowStock.length}>
          {lowStock.length === 0 ? (
            products.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t('dashboard.emptyNoProductsTitle')}
                subtitle={t('dashboard.emptyNoProductsSubtitle')}
                actionLabel={canEdit ? t('dashboard.addProductAction') : null}
                onAction={() => onNavigate('products')}
              />
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={t('dashboard.emptyNoLowStockTitle')}
                subtitle={t('dashboard.emptyNoLowStockSubtitle')}
              />
            )
          ) : (
            <>
              {visibleLowStock.map(p => (
                <LowStockRow key={p.id} product={p} canEdit={canEdit} onRestock={onRestock} />
              ))}
              {lowStock.length > visibleLowStock.length && (
                <PanelFooterLink label={t('dashboard.viewAllInProducts', { count: lowStock.length })} onClick={() => onNavigate('products')} />
              )}
            </>
          )}
        </DashboardPanel>

        <DashboardPanel title={t('dashboard.panels.pendingReceipts')} badge={pendingPOs.length}>
          {pendingPOs.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={t('dashboard.emptyNoPOsTitle')}
              subtitle={t('dashboard.emptyNoPOsSubtitle')}
              actionLabel={canEdit ? t('dashboard.createPOAction') : null}
              onAction={onNewPO}
            />
          ) : (
            <>
              {visiblePendingPOs.map(po => (
                <PendingPORow key={po.id} po={po} onReview={() => onNavigate('pos')} />
              ))}
              {pendingPOs.length > visiblePendingPOs.length && (
                <PanelFooterLink label={t('dashboard.viewAllInPOs', { count: pendingPOs.length })} onClick={() => onNavigate('pos')} />
              )}
            </>
          )}
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardPanel
          title={t('dashboard.panels.recentActivity')}
          className={categoryBreakdown.length === 0 ? 'lg:col-span-2' : ''}
          viewAllLabel={movements.length > 0 ? t('dashboard.viewAll') : null}
          onViewAll={() => onNavigate('movements')}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={t('dashboard.emptyNoMovementsTitle')}
              subtitle={t('dashboard.emptyNoMovementsSubtitle')}
              actionLabel={canEdit && products.length > 0 ? t('dashboard.logMovementAction') : null}
              onAction={onNewMovement}
            />
          ) : (
            recent.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                {m.type === 'in' ? <TrendingUp size={15} color={COLORS.sage} /> : <TrendingDown size={15} color={COLORS.rust} />}
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm truncate" style={{ color: COLORS.ink }}>{m.productName}</div>
                  <div className="font-body text-xs" style={{ color: COLORS.inkFaint }}>{reasonLabel(t, m.reason)} · {fmtDate(m.date)}</div>
                </div>
                <div className="font-mono text-sm font-medium" style={{ color: m.type === 'in' ? COLORS.sage : COLORS.rust }}>
                  {m.type === 'in' ? '+' : '−'}{m.qty}
                </div>
              </div>
            ))
          )}
        </DashboardPanel>

        {categoryBreakdown.length > 0 && (
          <DashboardPanel title={t('dashboard.panels.categoryBreakdown')}>
            {categoryBreakdown.map(c => (
              <CategoryBar key={c.category} label={categoryLabel(t, c.category)} pct={c.pct} />
            ))}
          </DashboardPanel>
        )}
      </div>
    </div>
  );
}

// A bordered card with a title bar, shared by every dashboard panel so they
// read as one consistent operational grid rather than mismatched sections.
function DashboardPanel({ title, badge, viewAllLabel, onViewAll, className = '', children }) {
  return (
    <section className={`rounded-lg overflow-hidden ${className}`} style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-display text-base truncate" style={{ color: COLORS.ink }}>{title}</h2>
          {!!badge && (
            <span className="font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust, fontSize: '0.625rem' }}>{badge}</span>
          )}
        </div>
        {viewAllLabel && (
          <button onClick={onViewAll} className="font-body text-xs font-medium underline shrink-0" style={{ color: COLORS.walnut }}>{viewAllLabel}</button>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

function PanelFooterLink({ label, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2.5 font-body text-xs font-medium underline" style={{ color: COLORS.walnut }}>
      {label}
    </button>
  );
}

// An actionable empty state — replaces passive italic notes on the dashboard
// so an empty panel reads as "nothing to do" rather than "missing content".
function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-8">
      {Icon && <Icon size={20} color={COLORS.inkFaint} className="mb-2" />}
      <div className="font-body text-sm font-medium" style={{ color: COLORS.ink }}>{title}</div>
      {subtitle && <div className="font-body text-xs mt-1 max-w-[220px]" style={{ color: COLORS.inkFaint }}>{subtitle}</div>}
      {actionLabel && (
        <button onClick={onAction} className="font-body text-xs font-medium underline mt-3" style={{ color: COLORS.walnut }}>{actionLabel}</button>
      )}
    </div>
  );
}

function LowStockRow({ product, canEdit, onRestock }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <AlertTriangle size={15} color={COLORS.rust} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-body text-sm truncate" style={{ color: COLORS.ink }}>{product.name}</div>
        <div className="font-mono text-xs" style={{ color: COLORS.inkFaint }}>{product.sku || '—'}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-body text-xs" style={{ color: COLORS.inkSoft }}>
          <span className="font-mono font-medium" style={{ color: COLORS.rust }}>{t('dashboard.stockLeft', { count: product.stock })}</span> · {t('dashboard.reorderAt', { level: product.reorderLevel })}
        </div>
        {canEdit && (
          <button onClick={() => onRestock(product)} className="font-body text-xs font-medium underline" style={{ color: COLORS.walnut }}>
            {t('dashboard.logRestock')}
          </button>
        )}
      </div>
    </div>
  );
}

function PendingPORow({ po, onReview }) {
  const { t } = useTranslation();
  const itemCount = po.items.length;
  const total = po.items.reduce((s, i) => s + i.qty * i.cost, 0);
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium" style={{ color: COLORS.ink }}>{po.poNumber}</span>
          <Badge tone="warn">{statusLabel(t, po.status)}</Badge>
        </div>
        <div className="font-body text-xs mt-0.5 truncate" style={{ color: COLORS.inkFaint }}>
          {t('dashboard.poSummary', { supplier: po.supplier, count: itemCount })}{total > 0 ? ` · ${fmtMYR(total)}` : ''}
        </div>
      </div>
      <button onClick={onReview} className="font-body text-xs font-medium underline shrink-0" style={{ color: COLORS.walnut }}>
        {t('dashboard.reviewReceive')}
      </button>
    </div>
  );
}

function CategoryBar({ label, pct }) {
  return (
    <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-body text-xs" style={{ color: COLORS.ink }}>{label}</span>
        <span className="font-mono text-xs" style={{ color: COLORS.inkFaint }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.borderSoft }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS.walnut }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'neutral' }) {
  const toneColor = { neutral: COLORS.walnut, good: COLORS.sage, warn: COLORS.gold, bad: COLORS.rust }[tone];
  return (
    <div className="rounded-lg p-3 md:p-4 min-w-0" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-body text-xs leading-tight" style={{ color: COLORS.inkSoft }}>{label}</span>
        <Icon size={15} color={toneColor} className="shrink-0" />
      </div>
      <div className="font-display text-xl md:text-2xl break-words" style={{ color: COLORS.ink }}>{value}</div>
    </div>
  );
}

function EmptyNote({ text }) {
  return <p className="font-body text-sm italic" style={{ color: COLORS.inkFaint }}>{text}</p>;
}

// ---------- Products ----------
function ProductsView({ products, total, search, setSearch, categoryFilter, setCategoryFilter, canEdit, onNew, onEdit, onDelete, onMove }) {
  const { t } = useTranslation();
  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: COLORS.ink }}>{t('products.title')}</h1>
          <p className="font-body text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{t('products.subtitle', { count: total })}</p>
        </div>
        {canEdit && <Button icon={Plus} onClick={onNew}>{t('products.addProduct')}</Button>}
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded flex-1 max-w-xs" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, minWidth: '160px' }}>
          <Search size={14} color={COLORS.inkFaint} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('products.searchPlaceholder')}
            className="flex-1 bg-transparent outline-none font-body text-sm" style={{ color: COLORS.ink }} />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded font-body text-sm outline-none" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
          <option value="All">{t('common.all')}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
        </select>
      </div>

      <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface }}>
        <table className="w-full font-body text-sm" style={{ minWidth: '640px' }}>
          <thead>
            <tr style={{ backgroundColor: COLORS.bg, borderBottom: `1px solid ${COLORS.border}` }}>
              {[t('products.table.sku'), t('products.table.product'), t('products.table.category'), t('products.table.stock'), t('products.table.cost'), t('products.table.sellPrice'), ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><EmptyNote text={t('products.emptyNoMatch')} /></td></tr>
            ) : products.map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: COLORS.inkFaint }}>{p.sku || '—'}</td>
                <td className="px-4 py-3">
                  <div style={{ color: COLORS.ink }}>{p.name}</div>
                  <div className="text-xs" style={{ color: COLORS.inkFaint }}>{[p.material, p.color, p.dimensions].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="px-4 py-3" style={{ color: COLORS.inkSoft }}>{categoryLabel(t, p.category)}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.stock <= p.reorderLevel ? 'bad' : p.stock <= p.reorderLevel * 2 ? 'warn' : 'good'}>{t('products.inStock', { count: p.stock })}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: COLORS.inkSoft }}>{fmtMYR(p.costPrice)}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: COLORS.ink }}>{fmtMYR(p.sellPrice)}</td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn onClick={() => onMove(p)} title={t('products.logStockMovement')}><ArrowLeftRight size={14} /></IconBtn>
                      <IconBtn onClick={() => onEdit(p)} title={t('common.edit')}><Pencil size={14} /></IconBtn>
                      <IconBtn onClick={() => { if (confirm(t('products.confirmDelete', { name: p.name }))) onDelete(p.id); }} title={t('common.delete')} danger><Trash2 size={14} /></IconBtn>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 rounded hover:opacity-70" style={{ color: danger ? COLORS.rust : COLORS.inkSoft }}>
      {children}
    </button>
  );
}

function ProductModal({ initial, onClose, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial || {
    name: '', sku: '', category: CATEGORIES[0], material: '', color: '', dimensions: '',
    costPrice: '', sellPrice: '', stock: 0, reorderLevel: 3, supplier: '',
  });
  const [formError, setFormError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) { setFormError(t('products.modal.errors.nameRequired')); return; }
    if (form.costPrice === '' || form.costPrice === null || isNaN(Number(form.costPrice))) { setFormError(t('products.modal.errors.costRequired')); return; }
    if (form.sellPrice === '' || form.sellPrice === null || isNaN(Number(form.sellPrice))) { setFormError(t('products.modal.errors.sellRequired')); return; }
    setFormError('');
    onSave({ ...form, costPrice: Number(form.costPrice) || 0, sellPrice: Number(form.sellPrice) || 0, stock: Number(form.stock) || 0, reorderLevel: Number(form.reorderLevel) || 0 });
  };

  return (
    <Modal title={initial ? t('products.modal.editTitle') : t('products.modal.addTitle')} onClose={onClose} wide>
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('products.modal.name')}><input style={inputStyle} value={form.name} onChange={set('name')} placeholder={t('products.modal.namePlaceholder')} /></Field>
          <Field label={t('products.modal.sku')}><input style={inputStyle} value={form.sku} onChange={set('sku')} placeholder={t('products.modal.skuPlaceholder')} /></Field>
          <Field label={t('products.modal.category')}>
            <select style={inputStyle} value={form.category} onChange={set('category')}>
              {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
            </select>
          </Field>
          <Field label={t('products.modal.supplier')}><input style={inputStyle} value={form.supplier} onChange={set('supplier')} placeholder={t('products.modal.supplierPlaceholder')} /></Field>
          <Field label={t('products.modal.material')}><input style={inputStyle} value={form.material} onChange={set('material')} placeholder={t('products.modal.materialPlaceholder')} /></Field>
          <Field label={t('products.modal.color')}><input style={inputStyle} value={form.color} onChange={set('color')} placeholder={t('products.modal.colorPlaceholder')} /></Field>
          <Field label={t('products.modal.dimensions')}><input style={inputStyle} value={form.dimensions} onChange={set('dimensions')} placeholder={t('products.modal.dimensionsPlaceholder')} /></Field>
          <div />
          <Field label={t('products.modal.costPrice')}><input type="number" step="0.01" style={inputStyle} value={form.costPrice} onChange={set('costPrice')} /></Field>
          <Field label={t('products.modal.sellPrice')}><input type="number" step="0.01" style={inputStyle} value={form.sellPrice} onChange={set('sellPrice')} /></Field>
          <Field label={initial ? t('products.modal.currentStock') : t('products.modal.startingStock')}>
            <input type="number" style={inputStyle} value={form.stock} onChange={set('stock')} disabled={!!initial} />
          </Field>
          <Field label={t('products.modal.reorderLevel')}><input type="number" style={inputStyle} value={form.reorderLevel} onChange={set('reorderLevel')} /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit">{initial ? t('products.modal.saveChanges') : t('products.modal.addProduct')}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Movements ----------
function MovementsView({ movements, products, canEdit, onNew }) {
  const { t } = useTranslation();
  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: COLORS.ink }}>{t('movements.title')}</h1>
          <p className="font-body text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{t('movements.subtitle')}</p>
        </div>
        {canEdit && <Button icon={Plus} onClick={onNew} disabled={products.length === 0}>{t('movements.logMovement')}</Button>}
      </header>

      <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface }}>
        <table className="w-full font-body text-sm" style={{ minWidth: '720px' }}>
          <thead>
            <tr style={{ backgroundColor: COLORS.bg, borderBottom: `1px solid ${COLORS.border}` }}>
              {[t('movements.table.date'), t('movements.table.product'), t('movements.table.type'), t('movements.table.qty'), t('movements.table.reason'), t('movements.table.reference'), t('movements.table.notes')].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><EmptyNote text={t('movements.emptyNone')} /></td></tr>
            ) : movements.map(m => (
              <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: COLORS.inkFaint }}>{fmtDate(m.date)}</td>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{m.productName} <span className="font-mono text-xs" style={{ color: COLORS.inkFaint }}>({m.sku || '—'})</span></td>
                <td className="px-4 py-3"><Badge tone={m.type === 'in' ? 'good' : 'bad'}>{m.type === 'in' ? t('movements.typeIn') : t('movements.typeOut')}</Badge></td>
                <td className="px-4 py-3 font-mono" style={{ color: m.type === 'in' ? COLORS.sage : COLORS.rust }}>{m.type === 'in' ? '+' : '−'}{m.qty}</td>
                <td className="px-4 py-3" style={{ color: COLORS.inkSoft }}>{reasonLabel(t, m.reason)}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: COLORS.inkFaint }}>{m.reference || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: COLORS.inkFaint }}>{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementModal({ products, preset, onClose, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    productId: preset?.id || '', type: 'out', qty: 1,
    reason: preset ? 'Restock' : 'Sale', reference: '', notes: '',
  });
  const selected = products.find(p => p.id === form.productId);
  const [formError, setFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.productId) { setFormError(t('movements.modal.errors.chooseProduct')); return; }
    if (!form.qty || Number(form.qty) <= 0) { setFormError(t('movements.modal.errors.qtyGreaterThanZero')); return; }
    setFormError('');
    onSave(form);
  };

  return (
    <Modal title={t('movements.modal.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {formError}
          </div>
        )}
        <Field label={t('movements.modal.product')}>
          <select style={inputStyle} value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}>
            <option value="">{t('movements.modal.selectProduct')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku || t('movements.modal.noSku')}) — {t('products.inStock', { count: p.stock })}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('movements.modal.direction')}>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: 'in', reason: REASONS_IN[0] })}
                className="flex-1 py-2 rounded text-sm font-medium font-body flex items-center justify-center gap-1"
                style={{ backgroundColor: form.type === 'in' ? COLORS.sageBg : COLORS.bg, color: form.type === 'in' ? COLORS.sage : COLORS.inkSoft, border: `1px solid ${form.type === 'in' ? COLORS.sage : COLORS.border}` }}>
                <TrendingUp size={14} /> {t('movements.modal.in')}
              </button>
              <button type="button" onClick={() => setForm({ ...form, type: 'out', reason: REASONS_OUT[0] })}
                className="flex-1 py-2 rounded text-sm font-medium font-body flex items-center justify-center gap-1"
                style={{ backgroundColor: form.type === 'out' ? COLORS.rustBg : COLORS.bg, color: form.type === 'out' ? COLORS.rust : COLORS.inkSoft, border: `1px solid ${form.type === 'out' ? COLORS.rust : COLORS.border}` }}>
                <TrendingDown size={14} /> {t('movements.modal.out')}
              </button>
            </div>
          </Field>
          <Field label={t('movements.modal.quantity')}><input type="number" min="1" style={inputStyle} value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></Field>
        </div>
        <Field label={t('movements.modal.reason')}>
          <select style={inputStyle} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
            {(form.type === 'in' ? REASONS_IN : REASONS_OUT).map(r => <option key={r} value={r}>{reasonLabel(t, r)}</option>)}
          </select>
        </Field>
        <Field label={t('movements.modal.reference')}><input style={inputStyle} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></Field>
        <Field label={t('movements.modal.notes')}><input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        {selected && (
          <p className="font-body text-xs mb-3" style={{ color: COLORS.inkFaint }}>
            {t('movements.modal.newStockAfter')} <span className="font-mono font-medium" style={{ color: COLORS.ink }}>
              {Math.max(0, selected.stock + (form.type === 'in' ? Number(form.qty || 0) : -Number(form.qty || 0)))}
            </span> {t('movements.modal.currently', { stock: selected.stock })}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit">{t('movements.modal.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Purchase Orders ----------
function PurchaseOrdersView({ pos, canEdit, onNew, onReceive, onCancel }) {
  const { t } = useTranslation();
  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: COLORS.ink }}>{t('purchaseOrders.title')}</h1>
          <p className="font-body text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{t('purchaseOrders.subtitle')}</p>
        </div>
        {canEdit && <Button icon={Plus} onClick={onNew}>{t('purchaseOrders.newPO')}</Button>}
      </header>

      {pos.length === 0 ? (
        <div className="rounded-lg p-8 text-center" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface }}>
          <EmptyNote text={t('purchaseOrders.emptyNone')} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pos.map(po => {
            const total = po.items.reduce((s, i) => s + i.qty * i.cost, 0);
            return (
              <div key={po.id} className="rounded-lg p-4" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium" style={{ color: COLORS.ink }}>{po.poNumber}</span>
                    <Badge tone={po.status === 'received' ? 'good' : po.status === 'cancelled' ? 'bad' : 'warn'}>
                      {statusLabel(t, po.status)}
                    </Badge>
                  </div>
                  <span className="font-body text-xs" style={{ color: COLORS.inkFaint }}>{fmtDate(po.date)}</span>
                </div>
                <div className="font-body text-sm mb-2" style={{ color: COLORS.inkSoft }}>{t('purchaseOrders.supplierLine', { name: po.supplier })}</div>
                <ul className="mb-3">
                  {po.items.map((it, idx) => (
                    <li key={idx} className="font-body text-xs flex justify-between py-1" style={{ color: COLORS.ink, borderBottom: idx < po.items.length - 1 ? `1px solid ${COLORS.borderSoft}` : 'none' }}>
                      <span>{it.productName} × {it.qty}</span>
                      <span className="font-mono" style={{ color: COLORS.inkFaint }}>{fmtMYR(it.qty * it.cost)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium" style={{ color: COLORS.ink }}>{t('purchaseOrders.total', { amount: fmtMYR(total) })}</span>
                  {canEdit && po.status === 'ordered' && (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => onCancel(po.id)}>{t('purchaseOrders.cancel')}</Button>
                      <Button icon={CheckCircle2} onClick={() => onReceive(po)}>{t('purchaseOrders.markReceived')}</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function POModal({ products, onClose, onSave }) {
  const { t } = useTranslation();
  const [supplier, setSupplier] = useState('');
  const [poNumber, setPoNumber] = useState(`PO-${Date.now().toString().slice(-6)}`);
  const [items, setItems] = useState([{ productId: '', qty: 1, cost: '' }]);
  const [formError, setFormError] = useState('');

  const addRow = () => setItems([...items, { productId: '', qty: 1, cost: '' }]);
  const updateRow = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  const submit = (e) => {
    e.preventDefault();
    if (!poNumber.trim()) { setFormError(t('purchaseOrders.modal.errors.poNumberRequired')); return; }
    if (!supplier.trim()) { setFormError(t('purchaseOrders.modal.errors.supplierRequired')); return; }
    const built = items.filter(it => it.productId && it.qty > 0).map(it => {
      const p = products.find(p => p.id === it.productId);
      return { productId: it.productId, productName: p?.name || '', qty: Number(it.qty), cost: Number(it.cost) || 0 };
    });
    if (built.length === 0) { setFormError(t('purchaseOrders.modal.errors.addLineItem')); return; }
    setFormError('');
    onSave({ poNumber, supplier, items: built });
  };

  return (
    <Modal title={t('purchaseOrders.modal.title')} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        {formError && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('purchaseOrders.modal.poNumber')}><input style={inputStyle} value={poNumber} onChange={e => setPoNumber(e.target.value)} /></Field>
          <Field label={t('purchaseOrders.modal.supplier')}><input style={inputStyle} value={supplier} onChange={e => setSupplier(e.target.value)} placeholder={t('purchaseOrders.modal.supplierPlaceholder')} /></Field>
        </div>
        <div className="mb-2 mt-1">
          <span className="block text-xs font-medium font-body mb-2" style={{ color: COLORS.inkSoft }}>{t('purchaseOrders.modal.items')}</span>
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
              <select style={{ ...inputStyle, flex: '1 1 100%' }} value={it.productId} onChange={e => updateRow(i, { productId: e.target.value })}>
                <option value="">{t('purchaseOrders.modal.selectProduct')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" placeholder={t('purchaseOrders.modal.qtyPlaceholder')} style={{ ...inputStyle, flex: 1, minWidth: '70px' }} value={it.qty} onChange={e => updateRow(i, { qty: e.target.value })} />
              <input type="number" step="0.01" placeholder={t('purchaseOrders.modal.costPlaceholder')} style={{ ...inputStyle, flex: 1, minWidth: '90px' }} value={it.cost} onChange={e => updateRow(i, { cost: e.target.value })} />
              <button type="button" onClick={() => removeRow(i)} style={{ color: COLORS.rust }} className="shrink-0"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={addRow} className="font-body text-xs font-medium underline" style={{ color: COLORS.walnut }}>{t('purchaseOrders.modal.addLineItem')}</button>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit">{t('purchaseOrders.modal.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}
