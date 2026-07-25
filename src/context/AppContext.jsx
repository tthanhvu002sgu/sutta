import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { initialSuttas } from '../data/initialData';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  annotationColor: '#c0392b',
  fontFamily: 'Lora',
  fontSize: 17,
  annotationDisplay: 'popup',
  githubToken: '',
  gistId: '',
  theme: 'light',
  lineHeight: 1.5,
  letterSpacing: 0.01,
  paddingX: 15,
  readingMode: 'scroll',
};

// Helper: Parse URL parameters and hash
function parseUrlState(availableSuttas) {
  const hash = window.location.hash || '';
  if (!hash || hash === '#/' || hash === '#') return null;

  const [hashPath, queryString] = hash.split('?');
  const path = hashPath.replace(/^#\/?/, '');
  const params = new URLSearchParams(queryString || '');

  const result = {
    view: null,
    suttaId: null,
    showSummary: null,
    settingsOverride: {},
  };

  if (path === 'settings') {
    result.view = 'settings';
  } else {
    const suttaId = path.replace(/^sutta\//, '').trim();
    if (suttaId) {
      result.view = 'reader';
      const exists = availableSuttas?.some(s => s.id === suttaId);
      if (exists) {
        result.suttaId = suttaId;
      }
    }
  }

  const tab = params.get('tab');
  if (tab === 'summary') {
    result.showSummary = true;
  } else if (tab === 'text') {
    result.showSummary = false;
  }

  const theme = params.get('theme');
  if (theme && ['light', 'dark', 'sepia', 'cyberpunk'].includes(theme)) {
    result.settingsOverride.theme = theme;
  }

  const font = params.get('font') || params.get('fontFamily');
  if (font && ['Lora', 'Times New Roman', 'Google Sans'].includes(font)) {
    result.settingsOverride.fontFamily = font;
  }

  const size = params.get('size') || params.get('fontSize');
  if (size && !isNaN(parseInt(size))) {
    result.settingsOverride.fontSize = Math.max(12, Math.min(28, parseInt(size)));
  }

  const mode = params.get('mode') || params.get('readingMode');
  if (mode && ['scroll', 'paged'].includes(mode)) {
    result.settingsOverride.readingMode = mode;
  }

  const lh = params.get('lh') || params.get('lineHeight');
  if (lh && !isNaN(parseFloat(lh))) {
    result.settingsOverride.lineHeight = Math.max(1.0, Math.min(3.0, parseFloat(lh)));
  }

  const px = params.get('px') || params.get('paddingX');
  if (px && !isNaN(parseInt(px))) {
    result.settingsOverride.paddingX = Math.max(0, Math.min(40, parseInt(px)));
  }

  const color = params.get('color');
  if (color && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
    result.settingsOverride.annotationColor = color;
  }

  return result;
}

// Helper: Build hash string based on state
function buildUrlHash({ view, activeSuttaId, showSummary, settings }) {
  if (view === 'settings') {
    return '#/settings';
  }

  if (!activeSuttaId) return '#/';

  const params = new URLSearchParams();
  if (showSummary) {
    params.set('tab', 'summary');
  }

  if (settings) {
    if (settings.theme && settings.theme !== DEFAULT_SETTINGS.theme) {
      params.set('theme', settings.theme);
    }
    if (settings.fontFamily && settings.fontFamily !== DEFAULT_SETTINGS.fontFamily) {
      params.set('font', settings.fontFamily);
    }
    if (settings.fontSize && settings.fontSize !== DEFAULT_SETTINGS.fontSize) {
      params.set('size', settings.fontSize);
    }
    if (settings.readingMode && settings.readingMode !== DEFAULT_SETTINGS.readingMode) {
      params.set('mode', settings.readingMode);
    }
    if (settings.lineHeight && settings.lineHeight !== DEFAULT_SETTINGS.lineHeight) {
      params.set('lh', settings.lineHeight);
    }
    if (settings.paddingX !== undefined && settings.paddingX !== DEFAULT_SETTINGS.paddingX) {
      params.set('px', settings.paddingX);
    }
  }

  const queryString = params.toString();
  return `#/sutta/${activeSuttaId}${queryString ? '?' + queryString : ''}`;
}

export function AppProvider({ children }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [suttas, setSuttas] = useState([]);
  const [activeSuttaId, setActiveSuttaId] = useState(null);
  const [view, setView] = useState('reader'); // 'reader' | 'settings'
  const [annotationMode, setAnnotationMode] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1);
  const [isDeepMode, setIsDeepMode] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        // Migration from localStorage
        const oldSuttas = localStorage.getItem('sutta-suttas');
        const oldSettings = localStorage.getItem('sutta-settings');

        let loadedSuttas = null;
        let loadedSettings = null;

        if (oldSuttas) {
          loadedSuttas = JSON.parse(oldSuttas);
          await set('sutta-suttas', loadedSuttas);
          localStorage.removeItem('sutta-suttas'); // Clean up after migration
        } else {
          loadedSuttas = await get('sutta-suttas');
        }

        if (oldSettings) {
          loadedSettings = JSON.parse(oldSettings);
          await set('sutta-settings', loadedSettings);
          localStorage.removeItem('sutta-settings');
        } else {
          loadedSettings = await get('sutta-settings');
        }

        const finalSuttas = loadedSuttas || initialSuttas;
        setSuttas(finalSuttas);

        let finalSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };

        // Parse initial URL for sutta ID, view mode, tab, and settings
        const parsed = parseUrlState(finalSuttas);
        if (parsed) {
          if (parsed.view) setView(parsed.view);
          if (parsed.suttaId) {
            setActiveSuttaId(parsed.suttaId);
          } else {
            setActiveSuttaId(finalSuttas[0]?.id || null);
          }
          if (parsed.showSummary !== null) {
            setShowSummary(parsed.showSummary);
          }
          if (Object.keys(parsed.settingsOverride).length > 0) {
            finalSettings = { ...finalSettings, ...parsed.settingsOverride };
          }
        } else {
          setActiveSuttaId(finalSuttas[0]?.id || null);
        }

        setSettings(finalSettings);
      } catch (err) {
        console.error('Failed to load from IndexedDB', err);
        setSuttas(initialSuttas);
        setActiveSuttaId(initialSuttas[0]?.id || null);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Sync state to URL hash
  useEffect(() => {
    if (!isLoaded) return;
    const newHash = buildUrlHash({ view, activeSuttaId, showSummary, settings });
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, [isLoaded, view, activeSuttaId, showSummary, settings]);

  // Handle browser back / forward navigation (hashchange)
  useEffect(() => {
    if (!isLoaded) return;

    const handleHashChange = () => {
      const parsed = parseUrlState(suttas);
      if (!parsed) return;

      if (parsed.view && parsed.view !== view) setView(parsed.view);
      if (parsed.suttaId && parsed.suttaId !== activeSuttaId) setActiveSuttaId(parsed.suttaId);
      if (parsed.showSummary !== null && parsed.showSummary !== showSummary) setShowSummary(parsed.showSummary);
      if (Object.keys(parsed.settingsOverride).length > 0) {
        setSettings(prev => ({ ...prev, ...parsed.settingsOverride }));
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isLoaded, suttas, view, activeSuttaId, showSummary]);

  // Persist Suttas
  useEffect(() => {
    if (isLoaded) {
      set('sutta-suttas', suttas).catch(err => console.error('Failed to save suttas', err));
    }
  }, [suttas, isLoaded]);

  // Persist Settings & Apply CSS
  useEffect(() => {
    if (isLoaded) {
      set('sutta-settings', settings).catch(err => console.error('Failed to save settings', err));
    }
    
    // Apply CSS vars
    document.documentElement.style.setProperty('--annotation-color', settings.annotationColor);
    document.documentElement.style.setProperty('--font-size', settings.fontSize + 'px');
    const fontMap = {
      'Lora': "'Lora', serif",
      'Times New Roman': "'Times New Roman', serif",
      'Google Sans': "'Google Sans', sans-serif",
    };
    document.documentElement.style.setProperty('--font-family', fontMap[settings.fontFamily] || "'Lora', serif");
    
    // Apply layout, typography, and theme CSS properties
    document.documentElement.style.setProperty('--line-height', settings.lineHeight || 1.5);
    document.documentElement.style.setProperty('--letter-spacing', (settings.letterSpacing !== undefined ? settings.letterSpacing : 0.01) + 'em');
    document.documentElement.style.setProperty('--editor-padding-x', (settings.paddingX !== undefined ? settings.paddingX : 15) + '%');
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
  }, [settings, isLoaded]);

  // Copy shareable URL to clipboard
  const copyShareUrl = useCallback((includeSettings = true) => {
    const url = new URL(window.location.href);
    if (view === 'settings') {
      url.hash = '#/settings';
    } else if (activeSuttaId) {
      const params = new URLSearchParams();
      params.set('tab', showSummary ? 'summary' : 'text');
      if (includeSettings) {
        params.set('theme', settings.theme || 'light');
        params.set('font', settings.fontFamily || 'Lora');
        params.set('size', settings.fontSize || 17);
        params.set('mode', settings.readingMode || 'scroll');
        if (settings.lineHeight) params.set('lh', settings.lineHeight);
        if (settings.paddingX !== undefined) params.set('px', settings.paddingX);
      }
      url.hash = `#/sutta/${activeSuttaId}?${params.toString()}`;
    }

    const shareUrl = url.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('📋 Đã sao chép URL bài kinh & cài đặt vào bộ nhớ tạm!');
      }).catch(() => {
        prompt('Sao chép liên kết dưới đây:', shareUrl);
      });
    } else {
      prompt('Sao chép liên kết dưới đây:', shareUrl);
    }
  }, [view, activeSuttaId, showSummary, settings, showToast]);

  const activeSutta = suttas.find(s => s.id === activeSuttaId) || null;

  function addSutta(sutta) {
    setSuttas(prev => [sutta, ...prev]);
    setActiveSuttaId(sutta.id);
  }

  function deleteSutta(id) {
    setSuttas(prev => prev.filter(s => s.id !== id));
    if (activeSuttaId === id) {
      const remaining = suttas.filter(s => s.id !== id);
      setActiveSuttaId(remaining[0]?.id || null);
    }
  }

  function updateSutta(id, updates) {
    setSuttas(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  function addAnnotation(suttaId, tokenKey, word, note) {
    setSuttas(prev => prev.map(s => {
      if (s.id !== suttaId) return s;
      return {
        ...s,
        annotations: { ...s.annotations, [tokenKey]: { word, note } }
      };
    }));
  }

  function removeAnnotation(suttaId, tokenKey) {
    setSuttas(prev => prev.map(s => {
      if (s.id !== suttaId) return s;
      const annotations = { ...s.annotations };
      delete annotations[tokenKey];
      return { ...s, annotations };
    }));
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }
  
  function restoreData(importedSuttas) {
    setSuttas(importedSuttas);
    setActiveSuttaId(importedSuttas[0]?.id || null);
  }

  async function syncToGist() {
    const rawToken = settings.githubToken || '';
    const rawGistId = settings.gistId || '';
    const cleanToken = rawToken.replace(/[^\x00-\x7F]/g, '').replace(/^(token|bearer)\s+/i, '').trim();
    let cleanGistId = rawGistId.replace(/[^\x00-\x7F]/g, '').trim();
    if (cleanGistId.includes('/')) {
      cleanGistId = cleanGistId.split('/').filter(Boolean).pop();
    }

    if (!cleanToken || !cleanGistId) {
      throw new Error('Vui lòng cấu hình GitHub Token và Gist ID hợp lệ');
    }
    const dataStr = JSON.stringify(suttas, null, 2);
    const response = await fetch(`https://api.github.com/gists/${cleanGistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        files: {
          'sutta-backup.json': {
            content: dataStr
          }
        }
      })
    });
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      if (response.status === 401 || errJson.message === 'Bad credentials') {
        throw new Error('GitHub Token không hợp lệ hoặc đã hết hạn (Bad credentials). Vui lòng tạo Token mới trên GitHub và dán vào mục Cài đặt.');
      }
      throw new Error(errJson.message || `Lỗi khi lưu lên Gist (HTTP ${response.status})`);
    }
  }

  async function syncFromGist() {
    const rawToken = settings.githubToken || '';
    const rawGistId = settings.gistId || '';
    const cleanToken = rawToken.replace(/[^\x00-\x7F]/g, '').replace(/^(token|bearer)\s+/i, '').trim();
    let cleanGistId = rawGistId.replace(/[^\x00-\x7F]/g, '').trim();
    if (cleanGistId.includes('/')) {
      cleanGistId = cleanGistId.split('/').filter(Boolean).pop();
    }

    if (!cleanToken || !cleanGistId) {
      throw new Error('Vui lòng cấu hình GitHub Token và Gist ID hợp lệ');
    }
    const response = await fetch(`https://api.github.com/gists/${cleanGistId}`, {
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    });
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      if (response.status === 401 || errJson.message === 'Bad credentials') {
        throw new Error('GitHub Token không hợp lệ hoặc đã hết hạn (Bad credentials). Vui lòng tạo Token mới trên GitHub và dán vào mục Cài đặt.');
      }
      throw new Error(errJson.message || `Lỗi khi tải từ Gist (HTTP ${response.status})`);
    }
    const data = await response.json();
    const file = data.files['sutta-backup.json'];
    if (!file) throw new Error('Không tìm thấy file sutta-backup.json trong Gist');
    
    let content = file.content;
    if (file.truncated || !content) {
      const rawResponse = await fetch(file.raw_url);
      if (!rawResponse.ok) throw new Error('Lỗi khi tải nội dung file thô từ Gist');
      content = await rawResponse.text();
    }
    
    const importedSuttas = JSON.parse(content);
    restoreData(importedSuttas);
  }

  if (!isLoaded) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>Đang tải dữ liệu...</div>;
  }

  return (
    <AppContext.Provider value={{
      suttas, activeSutta, activeSuttaId, setActiveSuttaId,
      view, setView,
      annotationMode, setAnnotationMode,
      showSummary, setShowSummary,
      autoScroll, setAutoScroll,
      autoScrollSpeed, setAutoScrollSpeed,
      isDeepMode, setIsDeepMode,
      showRightSidebar, setShowRightSidebar,
      settings, updateSetting,
      addSutta, deleteSutta, updateSutta,
      addAnnotation, removeAnnotation,
      restoreData,
      syncToGist, syncFromGist,
      copyShareUrl,
      toastMessage,
      showToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
