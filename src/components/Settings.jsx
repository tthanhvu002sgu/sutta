import { useState } from 'react';
import { useApp } from '../context/AppContext';

const FONTS = ['Lora', 'Times New Roman', 'Google Sans'];
const FONT_SIZES = [13, 14, 15, 16, 17, 18, 19, 20, 22, 24];

export default function Settings() {
  const { suttas, settings, updateSetting, restoreData, syncToGist, syncFromGist } = useApp();
  const [syncStatus, setSyncStatus] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const colorRef = { current: null };

  const handleExportData = () => {
    const dataStr = JSON.stringify(suttas, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sutta-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (Array.isArray(imported)) {
            if (window.confirm('Cảnh báo: Dữ liệu hiện tại sẽ bị ghi đè hoàn toàn bởi bản sao lưu này. Bạn có chắc chắn muốn tiếp tục?')) {
              restoreData(imported);
              alert('Khôi phục dữ liệu thành công!');
            }
          } else {
            alert('File sao lưu không đúng định dạng!');
          }
        } catch (err) {
          alert('Lỗi khi đọc file sao lưu: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSyncToGist = async () => {
    setSyncStatus('Đang đồng bộ lên Gist...');
    try {
      await syncToGist();
      setSyncStatus('Đồng bộ lên Gist thành công!');
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (err) {
      setSyncStatus(`Lỗi: ${err.message}`);
    }
  };

  const handleSyncFromGist = async () => {
    if (!window.confirm('Cảnh báo: Dữ liệu hiện tại sẽ bị ghi đè hoàn toàn bởi dữ liệu từ Gist. Bạn có chắc chắn muốn tiếp tục?')) return;
    setSyncStatus('Đang tải từ Gist...');
    try {
      await syncFromGist();
      setSyncStatus('Tải từ Gist thành công!');
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (err) {
      setSyncStatus(`Lỗi: ${err.message}`);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-inner">
        <h1 className="sutta-title" style={{ fontSize: '1.5em', marginBottom: 28 }}>⚙ Cài đặt</h1>

        {/* Typography */}
        <div className="settings-section">
          <div className="settings-section-title">Kiểu chữ</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Font chữ</div>
              <div className="settings-row-desc">Chọn font hiển thị cho nội dung kinh</div>
            </div>
            <select
              className="select-input"
              value={settings.fontFamily}
              onChange={e => updateSetting('fontFamily', e.target.value)}
              id="setting-font-family"
            >
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Cỡ chữ</div>
              <div className="settings-row-desc">Kích thước chữ cơ bản (px)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="icon-btn"
                style={{ border: '1.5px solid var(--border)', borderRadius: 3, width: 28, height: 28 }}
                onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 1))}
              >−</button>
              <input
                type="number"
                className="number-input"
                value={settings.fontSize}
                min={12} max={28}
                onChange={e => updateSetting('fontSize', Math.max(12, Math.min(28, +e.target.value)))}
                id="setting-font-size"
              />
              <button
                className="icon-btn"
                style={{ border: '1.5px solid var(--border)', borderRadius: 3, width: 28, height: 28 }}
                onClick={() => updateSetting('fontSize', Math.min(28, settings.fontSize + 1))}
              >+</button>
            </div>
          </div>
        </div>

        {/* Giao diện & Bố cục */}
        <div className="settings-section">
          <div className="settings-section-title">Giao diện & Bố cục</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Chế độ đọc</div>
              <div className="settings-row-desc">Chọn màu nền và chữ tối ưu giảm mỏi mắt</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn btn-sm ${settings.theme === 'light' || !settings.theme ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateSetting('theme', 'light')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                ☀️ Sáng
              </button>
              <button
                className={`btn btn-sm ${settings.theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateSetting('theme', 'dark')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🌙 Tối
              </button>
              <button
                className={`btn btn-sm ${settings.theme === 'sepia' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateSetting('theme', 'sepia')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                📖 Sepia
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Khoảng cách dòng</div>
              <div className="settings-row-desc">Chiều cao giữa các dòng (Tỷ lệ vàng: 1.5x - 1.6x)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="1.2"
                max="2.0"
                step="0.1"
                value={settings.lineHeight !== undefined ? settings.lineHeight : 1.5}
                onChange={e => updateSetting('lineHeight', parseFloat(e.target.value))}
                style={{ width: 120, accentColor: 'var(--text)' }}
                id="setting-line-height"
              />
              <span style={{ fontSize: 13, minWidth: 40, textAlign: 'right', fontWeight: 600 }}>
                {settings.lineHeight !== undefined ? settings.lineHeight : 1.5}x
              </span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Khoảng cách chữ</div>
              <div className="settings-row-desc">Tăng nhẹ khoảng cách chữ giúp đọc lướt (skimming) dễ hơn</div>
            </div>
            <select
              className="select-input"
              value={settings.letterSpacing !== undefined ? settings.letterSpacing : 0.01}
              onChange={e => updateSetting('letterSpacing', parseFloat(e.target.value))}
              id="setting-letter-spacing"
            >
              <option value="0">Bình thường (0em)</option>
              <option value="0.01">Rộng nhẹ (+0.01em - Khuyên dùng)</option>
              <option value="0.02">Rộng vừa (+0.02em)</option>
              <option value="0.03">Rộng nhiều (+0.03em)</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Độ rộng lề (Whitespace)</div>
              <div className="settings-row-desc">Lề hai bên văn bản (Khuyên dùng: 10% - 15%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="5"
                max="25"
                step="1"
                value={settings.paddingX !== undefined ? settings.paddingX : 15}
                onChange={e => updateSetting('paddingX', parseInt(e.target.value))}
                style={{ width: 120, accentColor: 'var(--text)' }}
                id="setting-padding-x"
              />
              <span style={{ fontSize: 13, minWidth: 40, textAlign: 'right', fontWeight: 600 }}>
                {settings.paddingX !== undefined ? settings.paddingX : 15}%
              </span>
            </div>
          </div>
        </div>

        {/* Annotations */}
        <div className="settings-section">
          <div className="settings-section-title">Chú thích</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Màu chú thích</div>
              <div className="settings-row-desc">Màu hiển thị của từ có chú thích</div>
            </div>
            <ColorPicker
              value={settings.annotationColor}
              onChange={v => updateSetting('annotationColor', v)}
              id="setting-annotation-color"
            />
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Kiểu hiển thị</div>
              <div className="settings-row-desc">Cách xem nội dung chú thích khi đọc</div>
            </div>
            <select
              className="select-input"
              value={settings.annotationDisplay || 'popup'}
              onChange={e => updateSetting('annotationDisplay', e.target.value)}
            >
              <option value="popup">Nổi lên trên chữ (Popup)</option>
              <option value="sidebar">Tab bên phải (Sidebar)</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        <div className="settings-section">
          <div className="settings-section-title">Xem trước</div>
          <div style={{
            border: '1.5px solid var(--border)',
            borderRadius: 6,
            padding: '24px 32px',
            background: 'var(--bg)',
            color: 'var(--text)',
            lineHeight: settings.lineHeight !== undefined ? settings.lineHeight : 1.5,
            letterSpacing: `${settings.letterSpacing !== undefined ? settings.letterSpacing : 0.01}em`,
            transition: 'all 0.25s ease',
          }}>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              VÍ DỤ NỘI DUNG
            </div>
            <p style={{ fontFamily: getFontCSS(settings.fontFamily), fontSize: settings.fontSize, textAlign: 'justify', margin: 0 }}>
              Tâm dẫn đầu các pháp, tâm làm chủ,{' '}
              <span style={{ color: settings.annotationColor, borderBottom: `1.5px dotted ${settings.annotationColor}`, cursor: 'pointer' }}>
                tâm tạo tác
              </span>
              . Nếu nói hoặc làm với{' '}
              <span style={{ color: settings.annotationColor, borderBottom: `1.5px dotted ${settings.annotationColor}`, cursor: 'pointer' }}>
                tâm trong sạch
              </span>
              , an lạc sẽ theo sau.
            </p>
          </div>
        </div>



        {/* Data */}
        <div className="settings-section">
          <div className="settings-section-title">Dữ liệu & Đồng bộ</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">GitHub Token</div>
              <div className="settings-row-desc">Personal Access Token (có quyền gist)</div>
            </div>
            <input
              type="password"
              className="text-input"
              value={settings.githubToken || ''}
              onChange={e => updateSetting('githubToken', e.target.value)}
              placeholder="ghp_..."
              style={{ width: '200px' }}
            />
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Gist ID</div>
              <div className="settings-row-desc">ID của Gist lưu trữ dữ liệu</div>
            </div>
            <input
              type="text"
              className="text-input"
              value={settings.gistId || ''}
              onChange={e => updateSetting('gistId', e.target.value)}
              placeholder="e.g. 1a2b3c..."
              style={{ width: '200px' }}
            />
          </div>

          {syncStatus && (
            <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 4, marginBottom: 16, fontSize: 13, color: 'var(--text)' }}>
              {syncStatus}
            </div>
          )}

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Đồng bộ Gist</div>
              <div className="settings-row-desc">Đồng bộ dữ liệu qua GitHub Gist</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={handleSyncToGist}>
                ⬆ Lưu lên Gist
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleSyncFromGist}>
                ⬇ Tải từ Gist
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Sao lưu & Khôi phục (Local)</div>
              <div className="settings-row-desc">Tải dữ liệu về máy hoặc khôi phục từ file có sẵn</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={handleExportData}>
                ⬇ Sao lưu file
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleImportData}>
                ⬆ Khôi phục từ file
              </button>
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="settings-section">
          <div className="settings-section-title">Đặt lại</div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Đặt lại tất cả cài đặt về mặc định?')) {
                updateSetting('annotationColor', '#c0392b');
                updateSetting('fontFamily', 'Lora');
                updateSetting('fontSize', 17);
                updateSetting('theme', 'light');
                updateSetting('lineHeight', 1.5);
                updateSetting('letterSpacing', 0.01);
                updateSetting('paddingX', 15);
              }
            }}
          >
            Đặt lại mặc định
          </button>
        </div>
      </div>
    </div>
  );
}

function getFontCSS(name) {
  const map = {
    'Lora': "'Lora', serif",
    'Times New Roman': "'Times New Roman', serif",
    'Google Sans': "'Google Sans', sans-serif",
  };
  return map[name] || "'Lora', serif";
}

function ColorPicker({ value, onChange, id }) {
  const inputRef = { current: null };
  return (
    <div className="color-picker-wrap">
      <div
        className="color-swatch"
        style={{ background: value }}
        onClick={() => document.getElementById(id + '-input')?.click()}
        title="Chọn màu"
      />
      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{value}</span>
      <input
        id={id + '-input'}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <button
        className="btn btn-sm"
        onClick={() => document.getElementById(id + '-input')?.click()}
      >Chọn</button>
    </div>
  );
}
