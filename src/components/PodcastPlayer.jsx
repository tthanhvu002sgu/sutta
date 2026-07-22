import { useState, useRef, useEffect } from 'react';

export default function PodcastPlayer({
  title,
  audioUrl,
  isLoading,
  statusMessage,
  isCached,
  error,
  onClose,
  onRetry,
  onRegenerate,
  onDeleteCache,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [playbackError, setPlaybackError] = useState(null);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      setPlaybackError(null);
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Autoplay policy or play error:', err);
            setIsPlaying(false);
          });
      }
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    setPlaybackError(null);
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.error('Lỗi khi phát audio:', err);
            setIsPlaying(false);
            setPlaybackError('Không thể phát file audio trên trình duyệt.');
          });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${(title || 'podcast-sutta').replace(/[^a-zA-Z0-9-đĐàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ\s]/g, '')}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="podcast-player-overlay">
      <div className="podcast-player-card">
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('Lỗi file audio:', e);
            setPlaybackError('Lỗi định dạng audio từ API.');
          }}
        />

        {/* Clean Header */}
        <div className="podcast-header">
          <div className="podcast-badge-group">
            <span className="podcast-badge main-badge">
              🎙 Voice Podcast
            </span>
            {isCached && (
              <span className="podcast-badge cache-badge">
                💾 Đã lưu
              </span>
            )}
          </div>
          <button className="podcast-close-btn" onClick={onClose} title="Đóng trình phát">
            ✕
          </button>
        </div>

        {/* Title */}
        <div className="podcast-title">{title || 'Đang tạo Audio cho bài đọc...'}</div>

        {/* Loading state */}
        {isLoading && (
          <div className="podcast-status loading">
            <span className="spinner" />
            <span>{statusMessage || 'Đang tạo giọng đọc AI...'}</span>
          </div>
        )}

        {playbackError && (
          <div className="podcast-alert error">
            ⚠️ {playbackError}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="podcast-status error">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>❌ Không thể tạo Audio</div>
            <div>{error}</div>
            {onRetry && (
              <button className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={onRetry}>
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* Audio Player Controls */}
        {!isLoading && audioUrl && (
          <div className="podcast-controls">
            {/* Progress Slider */}
            <div className="podcast-timeline">
              <span className="time-text">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="podcast-slider"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
              />
              <span className="time-text">{formatTime(duration)}</span>
            </div>

            {/* Main Action Bar */}
            <div className="podcast-actions">
              <button className={`podcast-play-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
                {isPlaying ? '⏸ Tạm dừng' : '▶ Phát'}
              </button>

              <div className="podcast-speed-options">
                {[0.8, 1.0, 1.25].map((speed) => (
                  <button
                    key={speed}
                    className={`speed-chip ${playbackRate === speed ? 'active' : ''}`}
                    onClick={() => handleSpeedChange(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="podcast-volume">
                <span className="volume-icon">🔊</span>
                <input
                  type="range"
                  className="volume-slider"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                />
              </div>

              <div className="podcast-secondary-actions">
                <button className="podcast-action-btn" onClick={handleDownload} title="Tải MP3 về máy">
                  ⬇ Tải về
                </button>

                {onRegenerate && (
                  <button className="podcast-action-btn" onClick={onRegenerate} title="Tạo lại Audio mới từ Gemini AI">
                    🔄 Đọc lại
                  </button>
                )}

                {isCached && onDeleteCache && (
                  <button className="podcast-action-btn danger" onClick={onDeleteCache} title="Xóa bản lưu audio này">
                    🗑 Xóa
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
