import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Sidebar({ onUpload, mobileOpen, onCloseMobile }) {
  const { suttas, activeSuttaId, setActiveSuttaId, deleteSutta, setView, view } = useApp();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const filtered = suttas.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.subtitle?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onCloseMobile} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          ☸ Sutta
          <span>Annotator</span>
        </div>
        <button className="icon-btn mobile-close-btn" onClick={onCloseMobile} title="Đóng menu">
          ✕
        </button>
        <button className="icon-btn desktop-collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Thu gọn sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Tìm kinh..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-sm" style={{ flex: 1 }} onClick={onUpload} id="btn-new-sutta">
          + Thêm kinh
        </button>
      </div>

      <nav className="sidebar-list">
        {filtered.length === 0 && (
          <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            Không tìm thấy kinh nào
          </div>
        )}
        {filtered.map(sutta => (
          <div
            key={sutta.id}
            className={`sidebar-item${activeSuttaId === sutta.id && view === 'reader' ? ' active' : ''}`}
            onClick={() => { setActiveSuttaId(sutta.id); setView('reader'); if(onCloseMobile) onCloseMobile(); }}
            id={`sidebar-item-${sutta.id}`}
          >
            <span className="sidebar-item-icon">☸</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-item-title">{sutta.title}</div>
              <div className="sidebar-item-meta">{sutta.subtitle}</div>
            </div>
            <div className="sidebar-item-actions">
              <button
                className="icon-btn"
                title="Xóa"
                onClick={e => { e.stopPropagation(); if (window.confirm('Xóa kinh này?')) deleteSutta(sutta.id); }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className={`btn btn-sm btn-ghost${view === 'settings' ? ' btn-primary' : ''}`}
          style={{ width: '100%' }}
          onClick={() => { setView(view === 'settings' ? 'reader' : 'settings'); if(onCloseMobile) onCloseMobile(); }}
          id="btn-settings"
        >
          ⚙ Cài đặt
        </button>
      </div>
    </aside>
    </>
  );
}
