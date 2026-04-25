import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

function migrateText(text, annotations, blockId) {
  if (!text) return '';
  if (text.includes('<mark')) return text;

  const tokens = [];
  const re = /(\S+)/g;
  let lastIndex = 0;
  let m;
  let wordIdx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      tokens.push(text.slice(lastIndex, m.index));
    }
    const tokenKey = `${blockId}-${wordIdx}`;
    if (annotations && annotations[tokenKey]) {
      tokens.push(`<mark data-annotation-id="${tokenKey}" class="annotated">${m[0]}</mark>`);
    } else {
      tokens.push(m[0]);
    }
    wordIdx++;
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens.join('');
}

function migrateSuttaToHtml(sutta) {
  if (sutta.htmlContent) return sutta.htmlContent;
  let html = '';
  sutta.content?.forEach(section => {
    if (section.heading) html += `<h2>${section.heading}</h2>`;
    section.blocks?.forEach(block => {
      const pText = migrateText(block.text, sutta.annotations, block.id);
      html += `<p class="sutta-paragraph">${pText}</p>`;
    });
  });
  return html || '<p class="sutta-paragraph"><br/></p>';
}

function AnnotationPopup({ annotationId, initialWord, suttaId, onClose, onRemoveMark }) {
  const { addAnnotation, removeAnnotation, activeSutta } = useApp();
  const existing = activeSutta?.annotations?.[annotationId];
  const [note, setNote] = useState(existing?.note || '');
  const ref = useRef();

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function handleSave() {
    if (!note.trim()) return;
    addAnnotation(suttaId, annotationId, initialWord, note.trim());
    onClose();
  }

  function handleDelete() {
    removeAnnotation(suttaId, annotationId);
    if (onRemoveMark) onRemoveMark(annotationId);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { if(!existing && onRemoveMark) onRemoveMark(annotationId); onClose(); } }}>
      <div className="modal" style={{ width: 420 }}>
        <div className="form-group">
          <label className="form-label">Nội dung chú thích</label>
          <textarea
            ref={ref}
            className="form-textarea"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Nhập chú thích..."
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSave(); }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ctrl+Enter để lưu</div>
        </div>
        <div className="modal-actions">
          {existing && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Xóa chú thích</button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => { if(!existing && onRemoveMark) onRemoveMark(annotationId); onClose(); }}>Hủy</button>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={!note.trim()}>
            {existing ? 'Cập nhật' : 'Lưu chú thích'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnnotationTooltip({ annotation, x, y, pinned, onClose, onEdit, annotationId, suttaId, onRemoveMark }) {
  const { removeAnnotation } = useApp();
  const ref = useRef();

  const style = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 340),
    top: y,
    zIndex: 1000,
  };

  useEffect(() => {
    if (!pinned) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pinned, onClose]);

  return (
    <div ref={ref} className="annotation-tooltip visible" style={style}>
      <div>{annotation.note}</div>
      {pinned && (
        <div className="annotation-tooltip-actions">
          <button className="tooltip-btn" onClick={onEdit}>✎ Sửa</button>
          <button className="tooltip-btn danger" onClick={() => { removeAnnotation(suttaId, annotationId); if(onRemoveMark) onRemoveMark(annotationId); onClose(); }}>✕ Xóa</button>
          <button className="tooltip-btn" onClick={onClose}>Đóng</button>
        </div>
      )}
    </div>
  );
}

function FullEditor({ sutta, annotationMode, onShowPopup, onShowTooltip, updateSuttaContent }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && ref.current.dataset.suttaId !== sutta.id) {
      ref.current.dataset.suttaId = sutta.id;
      ref.current.innerHTML = migrateSuttaToHtml(sutta);
    }
  }, [sutta]);

  const handleBlur = () => {
    if (!ref.current) return;
    const newHtml = ref.current.innerHTML;
    if (newHtml !== migrateSuttaToHtml(sutta)) {
      updateSuttaContent(newHtml);
    }
  };

  const createAnnotation = useCallback((range) => {
    if (!ref.current.contains(range.commonAncestorContainer)) return;

    const id = 'anno-' + Date.now();
    const mark = document.createElement('mark');
    mark.className = 'annotated';
    mark.dataset.annotationId = id;

    if (range.collapsed) {
      mark.innerHTML = '&nbsp;';
      mark.classList.add('space-annotation');
      range.insertNode(mark);
    } else {
      try {
        const content = range.extractContents();
        mark.appendChild(content);
        range.insertNode(mark);
      } catch (err) {
        return; // ignore complex overlapping selections for now
      }
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    updateSuttaContent(ref.current.innerHTML);

    onShowPopup({
      annotationId: id,
      initialWord: mark.textContent.trim() || 'khoảng trống',
      target: mark
    });
  }, [updateSuttaContent, onShowPopup]);

  useEffect(() => {
    const handleShortcutAnnotate = () => {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      createAnnotation(sel.getRangeAt(0));
    };

    window.addEventListener('shortcut-annotate', handleShortcutAnnotate);
    return () => window.removeEventListener('shortcut-annotate', handleShortcutAnnotate);
  }, [createAnnotation]);

  const handleMouseUp = (e) => {
    let target = e.target;
    while (target && target !== ref.current) {
      if (target.tagName === 'MARK') {
        const rect = target.getBoundingClientRect();
        onShowTooltip({
          annotationId: target.dataset.annotationId,
          x: rect.left,
          y: rect.bottom + 6,
          pinned: true,
          word: target.textContent,
          target
        });
        return;
      }
      target = target.parentNode;
    }

    if (!annotationMode) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    createAnnotation(sel.getRangeAt(0));
  };

  return (
    <div
      ref={ref}
      className="full-editor"
      contentEditable={!annotationMode}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onMouseUp={handleMouseUp}
      onMouseOver={(e) => {
        if (annotationMode) return;
        let target = e.target;
        if (target.tagName === 'MARK') {
          const rect = target.getBoundingClientRect();
          onShowTooltip({
            annotationId: target.dataset.annotationId,
            x: rect.left,
            y: rect.bottom + 6,
            pinned: false,
            word: target.textContent,
            target
          });
        }
      }}
      onMouseOut={(e) => {
        if (!annotationMode && e.target.tagName === 'MARK') {
          onShowTooltip(null);
        }
      }}
      style={{ cursor: annotationMode ? 'crosshair' : 'text', minHeight: '300px', outline: 'none' }}
    />
  );
}

export default function SuttaReader({ sutta }) {
  const { annotationMode, updateSutta, settings, removeAnnotation } = useApp();
  const [tooltip, setTooltip] = useState(null);
  const [popup, setPopup] = useState(null);

  const isPopupMode = settings.annotationDisplay !== 'sidebar';

  const updateSuttaContent = useCallback((newHtml, skipOrphanCheck = false) => {
    if (!skipOrphanCheck) {
      const doc = new DOMParser().parseFromString(newHtml, 'text/html');
      const marks = doc.querySelectorAll('mark.annotated');
      const existingIds = new Set(Array.from(marks).map(m => m.dataset.annotationId));
      
      const orphanedIds = Object.keys(sutta.annotations || {}).filter(id => !existingIds.has(id));
      
      if (orphanedIds.length > 0) {
        if (window.confirm('Đoạn kinh chứa chú thích đã bị xóa. Xóa luôn chú thích đính kèm?')) {
          orphanedIds.forEach(id => removeAnnotation(sutta.id, id));
          updateSutta(sutta.id, { htmlContent: newHtml });
        } else {
          const editor = document.querySelector('.full-editor');
          if (editor) {
            editor.innerHTML = migrateSuttaToHtml(sutta);
          }
        }
        return;
      }
    }
    updateSutta(sutta.id, { htmlContent: newHtml });
  }, [sutta, updateSutta, removeAnnotation]);

  const handleRemoveMark = useCallback((annotationId) => {
    const mark = document.querySelector(`mark[data-annotation-id="${annotationId}"]`);
    if (mark) {
      const parent = mark.parentNode;
      const editor = mark.closest('.full-editor');
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      
      if (editor) {
         updateSuttaContent(editor.innerHTML, true);
      }
    }
  }, [updateSuttaContent]);

  useEffect(() => {
    const handleEdit = (e) => {
      setPopup({
        annotationId: e.detail.annotationId,
        initialWord: e.detail.initialWord,
      });
    };
    window.addEventListener('edit-annotation', handleEdit);
    return () => window.removeEventListener('edit-annotation', handleEdit);
  }, []);

  return (
    <div className="editor-area" onClick={() => {}}>
      <div className="editor-inner">
        <h1 className="sutta-title" contentEditable suppressContentEditableWarning onBlur={e => updateSutta(sutta.id, {title: e.target.innerText})}>{sutta.title}</h1>
        {sutta.subtitle && <div className="sutta-subtitle" contentEditable suppressContentEditableWarning onBlur={e => updateSutta(sutta.id, {subtitle: e.target.innerText})}>{sutta.subtitle}</div>}

        <FullEditor
          sutta={sutta}
          annotationMode={annotationMode}
          onShowPopup={setPopup}
          onShowTooltip={(data) => {
            if (!isPopupMode) {
              if (data && data.pinned) {
                // If in sidebar mode and clicked, maybe highlight the sidebar item instead of showing popup
                const sidebarItem = document.getElementById(`sidebar-anno-${data.annotationId}`);
                if (sidebarItem) {
                  sidebarItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  const originalBg = sidebarItem.style.background;
                  sidebarItem.style.background = 'var(--bg3)';
                  setTimeout(() => sidebarItem.style.background = originalBg, 1500);
                }
              }
              return;
            }
            if (!data && tooltip && tooltip.pinned) return;
            setTooltip(data);
          }}
          updateSuttaContent={updateSuttaContent}
        />
      </div>

      {tooltip && sutta.annotations && sutta.annotations[tooltip.annotationId] && (
        <AnnotationTooltip
          annotation={sutta.annotations[tooltip.annotationId]}
          x={tooltip.x}
          y={tooltip.y}
          pinned={tooltip.pinned}
          onClose={() => setTooltip(null)}
          onEdit={() => { 
            setPopup({ annotationId: tooltip.annotationId, initialWord: tooltip.word, target: tooltip.target }); 
            setTooltip(null); 
          }}
          annotationId={tooltip.annotationId}
          suttaId={sutta.id}
          onRemoveMark={handleRemoveMark}
        />
      )}

      {popup && (
        <AnnotationPopup
          annotationId={popup.annotationId}
          initialWord={popup.initialWord}
          suttaId={sutta.id}
          onClose={() => setPopup(null)}
          onRemoveMark={handleRemoveMark}
        />
      )}
    </div>
  );
}
