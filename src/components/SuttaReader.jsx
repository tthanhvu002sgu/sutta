import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
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

function FullEditor({ sutta, annotationMode, onShowPopup, onShowTooltip, updateSuttaContent, isMobile }) {
  const ref = useRef();
  const [resizingMark, setResizingMark] = useState(null);

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
      if (resizingMark) return;
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      createAnnotation(sel.getRangeAt(0));
    };

    window.addEventListener('shortcut-annotate', handleShortcutAnnotate);
    return () => window.removeEventListener('shortcut-annotate', handleShortcutAnnotate);
  }, [createAnnotation, resizingMark]);

  const handleMouseUp = (e) => {
    if (resizingMark) return;

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

  const handleDoubleClick = (e) => {
    let target = e.target;
    while (target && target !== ref.current) {
      if (target.tagName === 'MARK') {
        const id = target.dataset.annotationId;
        
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        sel.removeAllRanges();
        sel.addRange(range);
        
        setResizingMark(id);
        onShowTooltip(null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      target = target.parentNode;
    }
  };

  const saveResize = () => {
    if (!resizingMark) return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    const range = sel.getRangeAt(0);
    const id = resizingMark;
    
    const newMark = document.createElement('mark');
    newMark.className = 'annotated';
    newMark.dataset.annotationId = id;
    
    try {
      const content = range.extractContents();
      
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(content);
      const innerMarks = tempDiv.querySelectorAll('mark');
      innerMarks.forEach(m => {
        const parent = m.parentNode;
        while (m.firstChild) {
          parent.insertBefore(m.firstChild, m);
        }
        parent.removeChild(m);
      });
      
      while(tempDiv.firstChild) {
          newMark.appendChild(tempDiv.firstChild);
      }
      
      range.insertNode(newMark);
    } catch(err) {
      console.error(err);
    }
    
    const allMarks = ref.current.querySelectorAll(`mark[data-annotation-id="${id}"]`);
    allMarks.forEach(m => {
      if (m !== newMark) {
        const parent = m.parentNode;
        while (m.firstChild) {
          parent.insertBefore(m.firstChild, m);
        }
        parent.removeChild(m);
      }
    });
    
    ref.current.normalize();
    
    sel.removeAllRanges();
    setResizingMark(null);
    updateSuttaContent(ref.current.innerHTML);
  };

  const cancelResize = () => {
    setResizingMark(null);
    window.getSelection().removeAllRanges();
  };

  return (
    <>
      <div
        ref={ref}
        className="full-editor"
        contentEditable={!isMobile && !annotationMode && !resizingMark}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onMouseOver={(e) => {
          if (resizingMark) return;
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
          if (resizingMark) return;
          if (!annotationMode && e.target.tagName === 'MARK') {
            onShowTooltip(null);
          }
        }}
        style={{ cursor: annotationMode ? 'crosshair' : 'text', minHeight: '300px', outline: 'none' }}
      />
      {resizingMark && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          padding: '10px 20px',
          borderRadius: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 1000
        }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Kéo thả vùng chọn để sửa giới hạn đoạn chú thích</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={cancelResize}>Hủy</button>
            <button className="btn btn-sm btn-primary" onClick={saveResize}>Lưu</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function SuttaReader({ sutta }) {
  const { annotationMode, updateSutta, settings, removeAnnotation, showSummary, setShowSummary } = useApp();
  const [tooltip, setTooltip] = useState(null);
  const [popup, setPopup] = useState(null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPopupMode = settings.annotationDisplay !== 'sidebar';

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && showSummary) {
        setShowSummary(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSummary, setShowSummary]);

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
        <h1 className="sutta-title" contentEditable={!isMobile} suppressContentEditableWarning onBlur={e => updateSutta(sutta.id, {title: e.target.innerText})}>{sutta.title}</h1>
        {sutta.subtitle && <div className="sutta-subtitle" contentEditable={!isMobile} suppressContentEditableWarning onBlur={e => updateSutta(sutta.id, {subtitle: e.target.innerText})}>{sutta.subtitle}</div>}

        {showSummary && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Bản giải thích (Tóm tắt)</span>
              <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 4, padding: 2, border: '1px solid var(--border)' }}>
                <button
                  className={`btn btn-sm ${!isEditingSummary ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ border: 'none', borderRadius: 3 }}
                  onClick={() => setIsEditingSummary(false)}
                >
                  Xem
                </button>
                <button
                  className={`btn btn-sm ${isEditingSummary ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ border: 'none', borderRadius: 3 }}
                  onClick={() => setIsEditingSummary(true)}
                >
                  Sửa
                </button>
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => setShowSummary(false)}>Đóng (ESC)</button>
          </div>
        )}

        {showSummary ? (
          isEditingSummary ? (
            <textarea
              className="form-textarea"
              style={{ width: '100%', minHeight: '400px', padding: 16, fontSize: 'var(--font-size)', fontFamily: 'var(--font-family)', lineHeight: 1.6, border: 'none', background: 'transparent', resize: 'vertical' }}
              placeholder="Dán bản giải thích / tóm tắt từ AI vào đây (Hỗ trợ Markdown)..."
              value={sutta.summaryContent || ''}
              onChange={e => updateSutta(sutta.id, { summaryContent: e.target.value })}
              autoFocus
            />
          ) : (
            <div className="markdown-body" style={{ padding: '0 16px', fontSize: 'var(--font-size)', fontFamily: 'var(--font-family)', lineHeight: 1.6, minHeight: 400 }}>
              {sutta.summaryContent ? (
                <ReactMarkdown>{sutta.summaryContent}</ReactMarkdown>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
                  Chưa có nội dung. Bấm "Sửa" để dán bản giải thích vào đây.
                </div>
              )}
            </div>
          )
        ) : (
          <FullEditor
            sutta={sutta}
            isMobile={isMobile}
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
        )}
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
