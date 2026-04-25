import { useApp } from '../context/AppContext';

const FONTS = ['Lora', 'Times New Roman', 'Google Sans'];
const FONT_SIZES = [13, 14, 15, 16, 17, 18, 19, 20, 22, 24];

export default function Settings() {
  const { suttas, settings, updateSetting, restoreData } = useApp();
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
            padding: '20px 24px',
            background: 'var(--bg2)',
            lineHeight: 1.9,
          }}>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              VÍ DỤ NỘI DUNG
            </div>
            <p style={{ fontFamily: getFontCSS(settings.fontFamily), fontSize: settings.fontSize }}>
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
          <div className="settings-section-title">Dữ liệu</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Sao lưu & Khôi phục</div>
              <div className="settings-row-desc">Tải dữ liệu về máy hoặc khôi phục từ file có sẵn</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={handleExportData}>
                ⬇ Sao lưu
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleImportData}>
                ⬆ Khôi phục
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
