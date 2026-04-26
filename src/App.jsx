import { useState, useEffect, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import SuttaReader from './components/SuttaReader';
import Settings from './components/Settings';
import UploadModal from './components/UploadModal';

function AppShell() {
  const { activeSutta, view, annotationMode, setAnnotationMode, settings, updateSetting, showSummary, setShowSummary } = useApp();
  const [showUpload, setShowUpload] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(300);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileRightSidebarOpen, setMobileRightSidebarOpen] = useState(false);

  const startResizingRight = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const doDrag = (e) => {
      setRightSidebarWidth(Math.max(200, Math.min(600, startWidth - (e.clientX - startX))));
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  }, [rightSidebarWidth]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut-annotate'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const annotationCount = activeSutta
    ? Object.keys(activeSutta.annotations || {}).length
    : 0;

  const handleExportHtml = () => {
    if (!activeSutta) return;

    const editor = document.querySelector('.full-editor');
    const contentHtml = editor ? editor.innerHTML : (activeSutta.htmlContent || '');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;

    const marks = tempDiv.querySelectorAll('mark.annotated');
    marks.forEach(mark => {
      const id = mark.dataset.annotationId;
      const annotation = activeSutta.annotations?.[id];
      if (annotation && annotation.note) {
        const noteSpan = document.createElement('span');
        noteSpan.className = 'export-note';
        noteSpan.innerText = ` [Chú giải: ${annotation.note}] `;
        mark.after(noteSpan);
      }
    });

    const fontMap = {
      'Lora': "'Lora', serif",
      'Times New Roman': "'Times New Roman', serif",
      'Google Sans': "'Google Sans', sans-serif",
    };
    const fontFamily = fontMap[settings.fontFamily] || fontMap['Lora'];

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${activeSutta.title}</title>
  <style>
    body {
      font-family: ${fontFamily};
      font-size: ${settings.fontSize}px;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1 { text-align: center; }
    .sutta-subtitle { text-align: center; color: #666; font-style: italic; margin-bottom: 30px; }
    mark.annotated {
      background-color: color-mix(in srgb, ${settings.annotationColor} 30%, transparent);
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
    .export-note {
      background-color: #f8f9fa;
      border: 1px solid #ddd;
      border-left: 3px solid ${settings.annotationColor};
      padding: 2px 8px;
      margin: 0 4px;
      border-radius: 4px;
      font-size: 0.9em;
      color: #444;
      display: inline-block;
    }
  </style>
</head>
<body>
  <h1>${activeSutta.title || 'Không có tiêu đề'}</h1>
  ${activeSutta.subtitle ? `<div class="sutta-subtitle">${activeSutta.subtitle}</div>` : ''}
  ${tempDiv.innerHTML}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSutta.title || 'kinh'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportMd = () => {
    if (!activeSutta) return;

    const editor = document.querySelector('.full-editor');
    const contentHtml = editor ? editor.innerHTML : (activeSutta.htmlContent || '');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;

    const marks = tempDiv.querySelectorAll('mark.annotated');
    marks.forEach(mark => {
      const id = mark.dataset.annotationId;
      const annotation = activeSutta.annotations?.[id];
      const text = mark.textContent;
      if (annotation && annotation.note) {
        mark.replaceWith(document.createTextNode(`**${text}** [Chú giải: ${annotation.note}]`));
      } else {
        mark.replaceWith(document.createTextNode(`**${text}**`));
      }
    });

    const h2s = tempDiv.querySelectorAll('h2');
    h2s.forEach(h2 => {
      h2.replaceWith(document.createTextNode(`\n## ${h2.textContent}\n\n`));
    });

    const ps = tempDiv.querySelectorAll('p');
    ps.forEach(p => {
      p.replaceWith(document.createTextNode(`\n${p.textContent}\n\n`));
    });

    const divs = tempDiv.querySelectorAll('div');
    divs.forEach(div => {
       div.replaceWith(document.createTextNode(`\n${div.textContent}\n`));
    });

    let mdText = tempDiv.textContent;

    let md = `# ${activeSutta.title || 'Không có tiêu đề'}\n\n`;
    if (activeSutta.subtitle) {
      md += `*${activeSutta.subtitle}*\n\n`;
    }
    
    // Clean up extra newlines
    mdText = mdText.replace(/\n{3,}/g, '\n\n');
    md += mdText.trim();

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSutta.title || 'kinh'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="app">
      <Sidebar onUpload={() => { setShowUpload(true); setMobileSidebarOpen(false); }} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

      <div className="main">
        {/* Top bar */}
        <div className="topbar">
          <button className="icon-btn mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} title="Menu">
            ☰
          </button>
          <div className="topbar-breadcrumb">
            {view === 'settings' ? 'CÀI ĐẶT' : activeSutta ? 'KINH ĐIỂN' : ''}
          </div>
          <div className="topbar-title">
            {view === 'settings' ? 'Cài đặt chung' : activeSutta?.title || ''}
          </div>

          {view === 'reader' && activeSutta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {annotationCount > 0 && (
                <span className="tag">{annotationCount} chú thích</span>
              )}
              {settings.annotationDisplay === 'sidebar' && annotationCount > 0 && (
                <button className="icon-btn mobile-right-menu-btn" onClick={() => setMobileRightSidebarOpen(true)} title="Xem chú thích">
                  📝
                </button>
              )}
            </div>
          )}
        </div>

        {/* Toolbar (only for reader with a sutta) */}
        {view === 'reader' && activeSutta && (
          <div className="toolbar">
            <button
              className={`btn btn-sm ${showSummary ? 'btn-primary' : ''}`}
              onClick={() => setShowSummary(!showSummary)}
              title={showSummary ? 'Quay lại Nội dung Kinh (ESC)' : 'Mở bản giải thích / tóm tắt'}
            >
              {showSummary ? '📖 Bản giải thích' : '📖 Bản giải thích'}
            </button>

            <div className="toolbar-sep" />

            <span className="toolbar-label">Font:</span>
            <select
              className="select-input"
              value={settings.fontFamily}
              onChange={e => updateSetting('fontFamily', e.target.value)}
              id="toolbar-font"
            >
              <option value="Lora">Lora</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Google Sans">Google Sans</option>
            </select>

            <div className="toolbar-sep" />

            <span className="toolbar-label">Cỡ chữ:</span>
            <button
              className="icon-btn"
              style={{ border: '1px solid var(--border)', borderRadius: 3 }}
              onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 1))}
            >−</button>
            <input
              type="number"
              className="number-input"
              value={settings.fontSize}
              min={12} max={28}
              onChange={e => updateSetting('fontSize', Math.max(12, Math.min(28, +e.target.value)))}
              id="toolbar-fontsize"
            />
            <button
              className="icon-btn"
              style={{ border: '1px solid var(--border)', borderRadius: 3 }}
              onClick={() => updateSetting('fontSize', Math.min(28, settings.fontSize + 1))}
            >+</button>

            <div className="toolbar-sep" />

            <span className="toolbar-label">Màu chú thích:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 22, height: 22,
                  background: settings.annotationColor,
                  border: '1.5px solid var(--border)',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('toolbar-color-input')?.click()}
                title="Chọn màu chú thích"
              />
              <input
                id="toolbar-color-input"
                type="color"
                value={settings.annotationColor}
                onChange={e => updateSetting('annotationColor', e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
            </div>

            <div className="toolbar-sep" />

            <div style={{ position: 'relative' }}>
              <button className="btn btn-sm" onClick={() => setShowExportMenu(!showExportMenu)} title="Xuất ra file văn bản có kèm chú thích">
                ⬇ Xuất file
              </button>
              {showExportMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowExportMenu(false)} />
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100,
                    display: 'flex', flexDirection: 'column', minWidth: 160,
                    padding: '4px 0'
                  }}>
                    <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderRadius: 0, padding: '8px 12px', borderBottom: 'none' }} onClick={handleExportHtml}>
                      📄 Định dạng HTML
                    </button>
                    <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderRadius: 0, padding: '8px 12px', borderBottom: 'none' }} onClick={handleExportMd}>
                      📝 Định dạng Markdown
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        {view === 'settings' ? (
          <Settings />
        ) : activeSutta ? (
          <SuttaReader sutta={activeSutta} />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">☸</div>
            <div className="empty-state-title">Chào mừng đến Sutta Annotator</div>
            <div className="empty-state-desc">
              Chọn một bài kinh từ menu bên trái, hoặc thêm bài kinh mới để bắt đầu đọc và chú thích.
            </div>
            <button className="btn" onClick={() => setShowUpload(true)}>
              + Thêm bài kinh đầu tiên
            </button>
          </div>
        )}
      </div>

      {view === 'reader' && activeSutta && settings.annotationDisplay === 'sidebar' && (
        <>
          <div
            className="resizer-right desktop-only"
            onMouseDown={startResizingRight}
            style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', zIndex: 10, flexShrink: 0 }}
          />
          {mobileRightSidebarOpen && <div className="sidebar-overlay right-sidebar-overlay" onClick={() => setMobileRightSidebarOpen(false)} />}
          <div className={`sidebar right-sidebar${mobileRightSidebarOpen ? ' mobile-open' : ''}`} style={{ width: rightSidebarWidth, minWidth: rightSidebarWidth, borderRight: 'none', borderLeft: 'none' }}>
            <div className="sidebar-header" style={{ justifyContent: 'center', position: 'relative' }}>
              <button className="icon-btn mobile-close-btn right-sidebar-close" onClick={() => setMobileRightSidebarOpen(false)} style={{ position: 'absolute', left: 10 }}>✕</button>
              <div className="sidebar-logo">DANH SÁCH CHÚ THÍCH</div>
            </div>
            <div className="sidebar-list" style={{ padding: 12 }}>
              {Object.entries(activeSutta.annotations || {}).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>Chưa có chú thích nào.</div>
              ) : (
                Object.entries(activeSutta.annotations).map(([id, anno]) => (
                  <div
                    key={id}
                    id={`sidebar-anno-${id}`}
                    style={{ marginBottom: 12, padding: '12px 40px 12px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--text)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                    onClick={() => {
                      const mark = document.querySelector(`mark[data-annotation-id="${id}"]`);
                      if (mark) {
                        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const originalBg = mark.style.background;
                        mark.style.background = 'color-mix(in srgb, var(--annotation-color) 25%, transparent)';
                        setTimeout(() => mark.style.background = originalBg, 1500);
                        if (window.innerWidth <= 768) {
                          setMobileRightSidebarOpen(false);
                        }
                      }
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{anno.note}</div>
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('edit-annotation', { detail: { annotationId: id, initialWord: anno.word } })); }} title="Sửa">✎</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
