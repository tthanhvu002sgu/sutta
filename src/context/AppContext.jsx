import { createContext, useContext, useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { initialSuttas } from '../data/initialData';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  annotationColor: '#c0392b',
  fontFamily: 'Lora',
  fontSize: 17,
  annotationDisplay: 'popup',
};

export function AppProvider({ children }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [suttas, setSuttas] = useState([]);
  const [activeSuttaId, setActiveSuttaId] = useState(null);
  const [view, setView] = useState('reader'); // 'reader' | 'settings'
  const [annotationMode, setAnnotationMode] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

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

  if (!isLoaded) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>Đang tải dữ liệu...</div>;
  }

  return (
    <AppContext.Provider value={{
      suttas, activeSutta, activeSuttaId, setActiveSuttaId,
      view, setView,
      annotationMode, setAnnotationMode,
      settings, updateSetting,
      addSutta, deleteSutta, updateSutta,
      addAnnotation, removeAnnotation,
      restoreData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
