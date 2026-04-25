import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Parse plain text into sutta content structure
function parseText(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const sections = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      if (current) sections.push(current);
      current = {
        id: 'section-' + generateId(),
        type: 'section',
        heading: trimmed.replace(/^#+\s*/, ''),
        blocks: []
      };
    } else {
      if (!current) {
        current = { id: 'section-' + generateId(), type: 'section', heading: '', blocks: [] };
      }
      current.blocks.push({
        id: 'block-' + generateId(),
        type: 'paragraph',
        text: trimmed
      });
    }
  }
  if (current && current.blocks.length > 0) sections.push(current);
  return sections;
}

export default function UploadModal({ onClose }) {
  const { addSutta } = useApp();
  const [step, setStep] = useState('form'); // 'form' | 'preview'
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      setText(e.target.result);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleSubmit() {
    if (!title.trim() || !text.trim()) return;
    const content = parseText(text);
    if (content.length === 0) {
      alert('Nội dung kinh không hợp lệ. Vui lòng nhập văn bản.');
      return;
    }
    addSutta({
      id: 'sutta-' + generateId(),
      title: title.trim(),
      subtitle: subtitle.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      content,
      annotations: {}
    });
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">📜 Thêm bài kinh mới</div>

        <div className="form-group">
          <label className="form-label">Tên bài kinh *</label>
          <input
            className="form-input"
            placeholder="Ví dụ: Kinh Pháp Cú - Phẩm Song Yếu"
            value={title}
            onChange={e => setTitle(e.target.value)}
            id="upload-title"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phụ đề / Tên Pali</label>
          <input
            className="form-input"
            placeholder="Ví dụ: Dhammapada - Yamaka Vagga"
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            id="upload-subtitle"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Nội dung kinh</label>
          <div
            className={`upload-zone${dragOver ? ' drag-over' : ''}`}
            style={{ marginBottom: 10 }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="upload-zone-icon">📄</div>
            <div className="upload-zone-text">
              <strong>Kéo thả file .txt</strong> vào đây hoặc click để chọn file
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
          <textarea
            className="form-textarea"
            placeholder={`Hoặc nhập trực tiếp nội dung kinh...\n\n# Dùng dấu # để tạo tiêu đề section\n\nMỗi đoạn văn là một dòng riêng biệt.`}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ minHeight: 180 }}
            id="upload-text"
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.6 }}>
          💡 <strong>Định dạng:</strong> Dùng <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: 2 }}># Tên section</code> để tạo tiêu đề. Mỗi đoạn văn là một dòng.
        </div>

        <div className="modal-actions">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Hủy</button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || !text.trim()}
            id="upload-submit"
          >
            Thêm bài kinh
          </button>
        </div>
      </div>
    </div>
  );
}
