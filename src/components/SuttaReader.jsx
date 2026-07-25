import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { get as getStore, set as setStore, del as delStore } from 'idb-keyval';
import { useApp } from '../context/AppContext';
import PodcastPlayer from './PodcastPlayer';

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
    <div className="modal-overlay">
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

function FindReplaceBar({ findText, setFindText, onClose, updateSuttaContent, focusReplace, isEditingSummary, summaryContent, suttaId, updateSutta }) {
  const [replaceText, setReplaceText] = useState('');
  const replaceInputRef = useRef();
  const findInputRef = useRef();

  useEffect(() => {
    if (focusReplace && replaceInputRef.current) {
      replaceInputRef.current.focus();
    } else if (findInputRef.current) {
      findInputRef.current.focus();
    }
  }, [focusReplace, findText]);

  useEffect(() => {
    if (!window.CSS || !CSS.highlights || isEditingSummary) {
      if (window.CSS && CSS.highlights) CSS.highlights.clear();
      return;
    }
    const editorEl = document.querySelector('.full-editor');
    if (!findText || !editorEl) {
      CSS.highlights.clear();
      return;
    }

    try {
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
      const ranges = [];
      let node;
      const searchLen = findText.length;
      const searchLower = findText.toLowerCase();

      while ((node = walker.nextNode())) {
        let text = node.nodeValue.toLowerCase();
        let startIndex = 0;
        while ((startIndex = text.indexOf(searchLower, startIndex)) !== -1) {
          const range = new Range();
          range.setStart(node, startIndex);
          range.setEnd(node, startIndex + searchLen);
          ranges.push(range);
          startIndex += searchLen;
        }
      }

      const highlight = new Highlight(...ranges);
      CSS.highlights.set('search-results', highlight);
    } catch(e) {
      console.error(e);
    }

    return () => {
      if (CSS.highlights) CSS.highlights.clear();
    }
  }, [findText, isEditingSummary]);

  const doReplaceAll = () => {
    if (!findText) return;

    if (isEditingSummary) {
      if (!summaryContent) return;
      const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedFind, 'gi');
      const newContent = summaryContent.replace(regex, replaceText);
      updateSutta(suttaId, { summaryContent: newContent });
      return;
    }

    const editorEl = document.querySelector('.full-editor');
    if (!editorEl) return;

    const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }
    
    let count = 0;
    const searchLower = findText.toLowerCase();

    nodes.forEach(n => {
      let text = n.nodeValue;
      let lowerText = text.toLowerCase();
      if (lowerText.includes(searchLower)) {
        const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedFind, 'gi');
        n.nodeValue = text.replace(regex, replaceText);
        count++;
      }
    });

    if (count > 0) {
      updateSuttaContent(editorEl.innerHTML);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, background: 'var(--bg)', border: '1px solid var(--border)',
      padding: '8px 12px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', zIndex: 1000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      <style>{`
        ::highlight(search-results) {
          background-color: rgba(255, 193, 7, 0.4);
          color: inherit;
        }
      `}</style>
      <input 
        ref={findInputRef}
        value={findText} 
        onChange={e=>setFindText(e.target.value)} 
        placeholder="Tìm kiếm..." 
        className="form-input" 
        style={{ width: 140, padding: '6px 10px', fontSize: 13 }} 
      />
      <input 
        ref={replaceInputRef}
        value={replaceText} 
        onChange={e=>setReplaceText(e.target.value)} 
        placeholder="Thay thế bằng..." 
        className="form-input" 
        style={{ width: 140, padding: '6px 10px', fontSize: 13 }} 
        onKeyDown={e => { if(e.key === 'Enter') doReplaceAll() }}
      />
      <button className="btn btn-sm btn-primary" onClick={doReplaceAll}>Thay thế tất cả</button>
      <button className="btn btn-sm btn-ghost" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
    </div>
  );
}

function FullEditor({ sutta, annotationMode, onShowPopup, onShowTooltip, updateSuttaContent, isMobile, onOpenFindReplace }) {
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
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            const sel = window.getSelection().toString();
            if (onOpenFindReplace) onOpenFindReplace(sel, false);
          }
          if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            const sel = window.getSelection().toString();
            if (onOpenFindReplace) onOpenFindReplace(sel, true);
          }
        }}
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

function calculateReadingTime(sutta) {
  const html = migrateSuttaToHtml(sutta);
  if (!html) return { minutes: 0, words: 0 };
  
  // Strip HTML tags to get plain text
  const plainText = html.replace(/<[^>]*>/g, ' ');
  const words = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  // 200 words per minute is standard silent reading speed
  const minutes = Math.max(1, Math.round(words / 200));
  return { minutes, words };
}

export default function SuttaReader({ sutta }) {
  const { annotationMode, updateSutta, settings, removeAnnotation, showSummary, setShowSummary, autoScroll, setAutoScroll, autoScrollSpeed, setView } = useApp();
  const [tooltip, setTooltip] = useState(null);
  const [popup, setPopup] = useState(null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [findReplace, setFindReplace] = useState({ visible: false, findText: '', focusReplace: false });
  const scrollAreaRef = useRef();
  
  // Paged mode state & refs
  const isPagedMode = settings.readingMode === 'paged';
  const pagedContentRef = useRef(null);
  const pagedWrapperRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Podcast Voice State
  const [podcastState, setPodcastState] = useState({
    open: false,
    loading: false,
    audioUrl: null,
    title: '',
    statusMessage: '',
    usedModel: '',
    isFallbackUsed: false,
    isCached: false,
    error: null,
  });

  const [hasCachedAudio, setHasCachedAudio] = useState(false);
  
  // Check if audio exists in IndexedDB for current Sutta
  useEffect(() => {
    let isMounted = true;
    async function checkAudioCache() {
      try {
        const cachedBlob = await getStore(`sutta-audio-${sutta.id}`);
        if (isMounted) {
          setHasCachedAudio(!!cachedBlob);
        }
      } catch (_) {
        if (isMounted) setHasCachedAudio(false);
      }
    }
    checkAudioCache();
    return () => { isMounted = false; };
  }, [sutta.id]);
  
  const audioFileInputRef = useRef(null);

  const handleUploadAudioFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cacheKey = `sutta-audio-${sutta.id}`;
    try {
      await setStore(cacheKey, file);
      const audioUrl = URL.createObjectURL(file);
      setHasCachedAudio(true);
      setPodcastState({
        open: true,
        loading: false,
        audioUrl,
        title: sutta.title,
        statusMessage: '',
        usedModel: 'File tải lên',
        isFallbackUsed: false,
        isCached: true,
        error: null,
      });
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    } catch (err) {
      alert('Lỗi khi lưu file audio: ' + err.message);
    }
  };
  
  // Progress state & scroll timeout
  const [progress, setProgress] = useState(0);
  const scrollSaveTimeoutRef = useRef(null);

  const handleStartPodcast = async () => {
    const cacheKey = `sutta-audio-${sutta.id}`;
    try {
      const cachedBlob = await getStore(cacheKey);
      if (cachedBlob) {
        const audioUrl = URL.createObjectURL(cachedBlob);
        setPodcastState({
          open: true,
          loading: false,
          audioUrl,
          title: sutta.title,
          statusMessage: '',
          usedModel: 'File tải lên',
          isFallbackUsed: false,
          isCached: true,
          error: null,
        });
        setHasCachedAudio(true);
      } else {
        audioFileInputRef.current?.click();
      }
    } catch (err) {
      console.warn('Lỗi đọc file audio:', err);
      audioFileInputRef.current?.click();
    }
  };

  const handleDeletePodcastCache = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa file audio đã lưu cho bài đọc này?')) return;
    try {
      await delStore(`sutta-audio-${sutta.id}`);
      setHasCachedAudio(false);
      setPodcastState((prev) => ({ ...prev, open: false, audioUrl: null, isCached: false }));
      alert('Đã xóa bản lưu audio thành công.');
    } catch (err) {
      alert('Lỗi khi xóa bản lưu: ' + err.message);
    }
  };

  const getActiveColumnContainer = useCallback(() => {
    return document.querySelector('.paged-mode .full-editor') || document.querySelector('.paged-mode .markdown-body');
  }, []);

  // Calculate pagination in Paged mode
  const calculatePagination = useCallback(() => {
    if (!isPagedMode) return;
    const el = getActiveColumnContainer();
    if (!el) return;
    const width = el.clientWidth;
    const gap = 40;
    const columnSpan = width + gap;
    if (width <= 0) return;

    const scrollWidth = el.scrollWidth;
    const calculatedPages = Math.max(1, Math.round((scrollWidth + gap) / columnSpan));
    setTotalPages(calculatedPages);

    const page = Math.min(calculatedPages, Math.max(1, Math.round(el.scrollLeft / columnSpan) + 1));
    setCurrentPage(page);

    const progressVal = calculatedPages > 1 ? ((page - 1) / (calculatedPages - 1)) * 100 : 100;
    setProgress(progressVal);
  }, [isPagedMode, getActiveColumnContainer]);

  const goToPage = useCallback((targetPage) => {
    const el = getActiveColumnContainer();
    if (!el) return;
    const width = el.clientWidth;
    const gap = 40;
    const columnSpan = width + gap;

    const validPage = Math.min(totalPages, Math.max(1, targetPage));
    const targetScrollLeft = (validPage - 1) * columnSpan;

    el.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    setCurrentPage(validPage);

    const progressVal = totalPages > 1 ? ((validPage - 1) / (totalPages - 1)) * 100 : 100;
    setProgress(progressVal);

    if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current);
    scrollSaveTimeoutRef.current = setTimeout(() => {
      updateSutta(sutta.id, { scrollPosition: targetScrollLeft });
    }, 800);
  }, [totalPages, sutta.id, updateSutta, getActiveColumnContainer]);

  useEffect(() => {
    if (!isPagedMode) return;

    const updateCalculations = () => {
      calculatePagination();
    };

    updateCalculations();

    const el = getActiveColumnContainer();
    let observer;
    if (el) {
      observer = new ResizeObserver(updateCalculations);
      observer.observe(el);
    }

    const timer1 = setTimeout(updateCalculations, 100);
    const timer2 = setTimeout(updateCalculations, 400);

    return () => {
      if (observer) observer.disconnect();
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isPagedMode, calculatePagination, getActiveColumnContainer, sutta.id, sutta.htmlContent, sutta.summaryContent, settings.fontSize, settings.fontFamily, settings.lineHeight, settings.paddingX, showSummary]);

  // Wheel events in Paged mode
  useEffect(() => {
    if (!isPagedMode || !pagedWrapperRef.current) return;
    const wrapper = pagedWrapperRef.current;

    let wheelTimeout = null;
    const handleWheel = (e) => {
      if (Math.abs(e.deltaY) > 10 || Math.abs(e.deltaX) > 10) {
        e.preventDefault();
        if (wheelTimeout) return;

        if (e.deltaY > 0 || e.deltaX > 0) {
          goToPage(currentPage + 1);
        } else if (e.deltaY < 0 || e.deltaX < 0) {
          goToPage(currentPage - 1);
        }

        wheelTimeout = setTimeout(() => {
          wheelTimeout = null;
        }, 250);
      }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      wrapper.removeEventListener('wheel', handleWheel);
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [isPagedMode, currentPage, goToPage]);

  // Keyboard navigation in Paged mode
  useEffect(() => {
    if (!isPagedMode) return;

    const handleKeyDown = (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(totalPages);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPagedMode, currentPage, totalPages, goToPage]);

  // Touch events in Paged mode
  const handleTouchStart = (e) => {
    if (!isPagedMode) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!isPagedMode) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        goToPage(currentPage + 1);
      } else {
        goToPage(currentPage - 1);
      }
    }
  };

  // Auto-scroll effect
  useEffect(() => {
    if (!autoScroll) return;

    if (isPagedMode) {
      const intervalMs = Math.max(1500, (15 / autoScrollSpeed) * 1000);
      const intervalId = setInterval(() => {
        setCurrentPage(prev => {
          if (prev >= totalPages) {
            setAutoScroll(false);
            return prev;
          }
          const nextPage = prev + 1;
          const el = getActiveColumnContainer();
          if (el) {
            const width = el.clientWidth;
            const gap = 40;
            el.scrollTo({ left: (nextPage - 1) * (width + gap), behavior: 'smooth' });
          }
          return nextPage;
        });
      }, intervalMs);

      return () => clearInterval(intervalId);
    } else {
      let animationFrameId;
      let lastTime = performance.now();
      let fractionalScroll = 0;

      const scrollLoop = (time) => {
        if (autoScroll && scrollAreaRef.current) {
          const delta = time - lastTime;
          const scrollAmount = (autoScrollSpeed * 20 * delta) / 1000;
          
          fractionalScroll += scrollAmount;
          if (fractionalScroll >= 1) {
            const pixelsToScroll = Math.floor(fractionalScroll);
            scrollAreaRef.current.scrollTop += pixelsToScroll;
            fractionalScroll -= pixelsToScroll;
          }

          if (scrollAreaRef.current.scrollTop + scrollAreaRef.current.clientHeight >= scrollAreaRef.current.scrollHeight - 1) {
            setAutoScroll(false);
          }
        }
        lastTime = time;
        animationFrameId = requestAnimationFrame(scrollLoop);
      };

      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(scrollLoop);

      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [autoScroll, autoScrollSpeed, isPagedMode, totalPages, setAutoScroll, getActiveColumnContainer]);

  // Restore scroll position when loading/switching sutta
  useEffect(() => {
    const savedScroll = sutta.scrollPosition || 0;

    const timer = setTimeout(() => {
      const el = getActiveColumnContainer();
      if (isPagedMode && el) {
        el.scrollLeft = savedScroll;
        calculatePagination();
      } else if (!isPagedMode && scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = savedScroll;

        const scrollTop = scrollAreaRef.current.scrollTop;
        const scrollHeight = scrollAreaRef.current.scrollHeight;
        const clientHeight = scrollAreaRef.current.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        const progressVal = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
        setProgress(progressVal);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [sutta.id, isPagedMode, calculatePagination, getActiveColumnContainer]);

  // Scroll handler for progress bar and auto-bookmarking in Scroll Mode
  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current || isPagedMode) return;

    const scrollTop = scrollAreaRef.current.scrollTop;
    const scrollHeight = scrollAreaRef.current.scrollHeight;
    const clientHeight = scrollAreaRef.current.clientHeight;

    const maxScroll = scrollHeight - clientHeight;
    const progressVal = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    setProgress(progressVal);

    if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current);
    scrollSaveTimeoutRef.current = setTimeout(() => {
      updateSutta(sutta.id, { scrollPosition: scrollTop });
    }, 800);
  }, [sutta.id, updateSutta, isPagedMode]);

  useEffect(() => {
    return () => {
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current);
    };
  }, []);

  const handleOpenFindReplace = useCallback((text, focusReplace) => {
    setFindReplace(prev => ({
      visible: true,
      findText: text || prev.findText,
      focusReplace
    }));
  }, []);

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
    <div className="reader-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Sleek Reading Progress Bar */}
      <div 
        style={{
          width: '100%',
          height: '4px',
          background: 'var(--bg3)',
          zIndex: 90,
          flexShrink: 0
        }}
        id="reading-progress-bar-container"
      >
        <div 
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'var(--annotation-color)',
            transition: 'width 0.1s ease-out',
          }} 
          id="reading-progress-bar"
        />
      </div>

      {isPagedMode ? (
        <div className="editor-area paged-mode" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {findReplace.visible && (
            <FindReplaceBar
              findText={findReplace.findText}
              setFindText={(text) => setFindReplace(prev => ({ ...prev, findText: text }))}
              focusReplace={findReplace.focusReplace}
              onClose={() => setFindReplace(prev => ({ ...prev, visible: false }))}
              updateSuttaContent={updateSuttaContent}
              isEditingSummary={isEditingSummary}
              summaryContent={sutta.summaryContent}
              suttaId={sutta.id}
              updateSutta={updateSutta}
            />
          )}

          <div className="paged-header">
            <h1 className="sutta-title" contentEditable={!isMobile} suppressContentEditableWarning onBlur={e => updateSutta(sutta.id, {title: e.target.innerText})}>{sutta.title}</h1>
            {sutta.subtitle && <div className="sutta-subtitle" contentEditable={!isMobile} suppressContentEditableWarning onBlur={e => updateSutta(sutta.id, {subtitle: e.target.innerText})}>{sutta.subtitle}</div>}

            <div 
              className="sutta-metadata" 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: '13px',
                color: 'var(--text-muted)',
                marginBottom: '16px',
                marginTop: sutta.subtitle ? '-16px' : '0px',
                borderBottom: '1px dashed var(--border)',
                paddingBottom: '12px',
                flexWrap: 'wrap',
              }}
              id="sutta-metadata-bar"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                ⏱️ <strong>Thời gian đọc:</strong> ~{readingTime.minutes} phút
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                📝 <strong>Độ dài:</strong> {readingTime.words.toLocaleString()} từ
              </span>
              {/* Hidden Audio File Input */}
              <input
                type="file"
                ref={audioFileInputRef}
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
                style={{ display: 'none' }}
                onChange={handleUploadAudioFile}
              />

              {hasCachedAudio ? (
                <>
                  <button
                    className="btn btn-sm btn-ghost"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '1.5px solid var(--annotation-color)',
                      color: 'var(--annotation-color)',
                    }}
                    onClick={() => handleStartPodcast(false)}
                    title="Phát file Audio đã lưu"
                  >
                    ▶ Nghe Podcast (Đã lưu)
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => audioFileInputRef.current?.click()}
                    title="Tải lên file Audio MP3/WAV mới thay thế bản lưu hiện tại"
                  >
                    📤 Đổi file Audio
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => audioFileInputRef.current?.click()}
                  title="Tải file audio từ máy tính của bạn (MP3, WAV, M4A...)"
                >
                  📤 Tải file Audio lên
                </button>
              )}
              {sutta.scrollPosition > 10 && (
                <>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--annotation-color)', fontWeight: 500 }}>
                    🔖 <strong>Đang đọc dở</strong> (Khôi phục tự động)
                  </span>
                </>
              )}
            </div>

            {showSummary && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          </div>

          <div 
            className="paged-wrapper" 
            ref={pagedWrapperRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Left Page Click Zone */}
            <div 
              className="page-click-zone left" 
              onClick={() => goToPage(currentPage - 1)}
              title="Trang trước (Phím ←)"
              style={{ display: currentPage > 1 ? 'flex' : 'none' }}
            >
              <span className="zone-arrow">‹</span>
            </div>

            {/* Right Page Click Zone */}
            <div 
              className="page-click-zone right" 
              onClick={() => goToPage(currentPage + 1)}
              title="Trang sau (Phím →)"
              style={{ display: currentPage < totalPages ? 'flex' : 'none' }}
            >
              <span className="zone-arrow">›</span>
            </div>

            <div className="paged-body">
              {showSummary ? (
                isEditingSummary ? (
                  <textarea
                    className="form-textarea"
                    style={{ width: '100%', height: '100%', padding: 16, fontSize: 'var(--font-size)', fontFamily: 'var(--font-family)', lineHeight: 1.6, border: 'none', background: 'transparent', resize: 'none' }}
                    placeholder="Dán bản giải thích / tóm tắt từ AI vào đây (Hỗ trợ Markdown)..."
                    value={sutta.summaryContent || ''}
                    onChange={e => updateSutta(sutta.id, { summaryContent: e.target.value })}
                    autoFocus
                  />
                ) : (
                  <div className="markdown-body" style={{ fontSize: 'var(--font-size)', fontFamily: 'var(--font-family)', lineHeight: 1.6 }}>
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
                  onOpenFindReplace={handleOpenFindReplace}
                  onShowTooltip={(data) => {
                    if (!isPopupMode) {
                      if (data && data.pinned) {
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
          </div>

          {/* Paged Navigation Bar */}
          <div className="paged-nav-bar">
            <button 
              className="btn btn-sm btn-ghost paged-nav-btn" 
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              ◄ Trang trước
            </button>

            <div className="paged-nav-info">
              <span>Trang {currentPage} / {totalPages}</span>
              {totalPages > 1 && (
                <input 
                  type="range" 
                  min="1" 
                  max={totalPages} 
                  value={currentPage} 
                  onChange={(e) => goToPage(Number(e.target.value))}
                  className="paged-slider"
                  title={`Kéo để đến trang 1 - ${totalPages}`}
                />
              )}
            </div>

            <button 
              className="btn btn-sm btn-ghost paged-nav-btn" 
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Trang sau ►
            </button>
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

          {podcastState.open && (
            <PodcastPlayer
              title={podcastState.title}
              audioUrl={podcastState.audioUrl}
              isLoading={podcastState.loading}
              statusMessage={podcastState.statusMessage}
              progressPercent={podcastState.progressPercent}
              usedModel={podcastState.usedModel}
              isFallbackUsed={podcastState.isFallbackUsed}
              isCached={podcastState.isCached}
              error={podcastState.error}
              onClose={() => setPodcastState((prev) => ({ ...prev, open: false }))}
              onRetry={() => handleStartPodcast(false)}
              onRegenerate={() => handleStartPodcast(true)}
              onDeleteCache={handleDeletePodcastCache}
            />
          )}
        </div>
      ) : (
        <div className="editor-area" onClick={() => {}} onScroll={handleScroll} style={{ position: 'relative', flex: 1, overflowY: 'auto' }} ref={scrollAreaRef}>
          {findReplace.visible && (
            <FindReplaceBar
              findText={findReplace.findText}
              setFindText={(text) => setFindReplace(prev => ({ ...prev, findText: text }))}
              focusReplace={findReplace.focusReplace}
              onClose={() => setFindReplace(prev => ({ ...prev, visible: false }))}
              updateSuttaContent={updateSuttaContent}
              isEditingSummary={isEditingSummary}
              summaryContent={sutta.summaryContent}
              suttaId={sutta.id}
              updateSutta={updateSutta}
            />
          )}

          <div className="editor-inner">
            {renderSuttaMainContent()}
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

          {podcastState.open && (
            <PodcastPlayer
              title={podcastState.title}
              audioUrl={podcastState.audioUrl}
              isLoading={podcastState.loading}
              statusMessage={podcastState.statusMessage}
              progressPercent={podcastState.progressPercent}
              usedModel={podcastState.usedModel}
              isFallbackUsed={podcastState.isFallbackUsed}
              isCached={podcastState.isCached}
              error={podcastState.error}
              onClose={() => setPodcastState((prev) => ({ ...prev, open: false }))}
              onRetry={() => handleStartPodcast(false)}
              onRegenerate={() => handleStartPodcast(true)}
              onDeleteCache={handleDeletePodcastCache}
            />
          )}
        </div>
      )}
    </div>
  );
}
