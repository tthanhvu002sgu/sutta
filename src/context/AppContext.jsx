import { createContext, useContext, useState, useEffect } from 'react';
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
        setActiveSuttaId(finalSuttas[0]?.id || null);
        
        if (loadedSettings) {
          setSettings(prev => ({ ...prev, ...loadedSettings }));
        }
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
        'Authorization': `token ${cleanToken}`,
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
        'Authorization': `token ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    });
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
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
      settings, updateSetting,
      addSutta, deleteSutta, updateSutta,
      addAnnotation, removeAnnotation,
      restoreData,
      syncToGist, syncFromGist,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
