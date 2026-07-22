/**
 * Gemini Voice & TTS API Service
 * Handles audio generation with fast health check and fallback strategy
 */

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts raw 16-bit PCM audio bytes (mono) into a valid WAV Blob
 * so standard HTML5 <audio> tags can play it natively across all browsers.
 */
function pcmToWavBlob(pcmBytes, sampleRate = 24000, numChannels = 1) {
  const dataLength = pcmBytes.length;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (1 is PCM) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * numChannels * bitsPerSample / 8) */
  view.setUint32(28, sampleRate * numChannels * 2, true);
  /* block align */
  view.setUint16(32, numChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, dataLength, true);

  // Copy PCM data cleanly
  new Uint8Array(buffer, 44).set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Quick Pre-flight Health Check to test if a model is active and responding
 * before sending a large text payload.
 */
async function pingModelHealth(model, apiKey, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Check' }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
      }),
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }
    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Timeout: Mô hình phản hồi quá chậm');
    }
    throw err;
  }
}

/**
 * Call Gemini API with fast pre-flight check and model fallback strategy
 */
export async function generateGeminiAudio({
  text,
  apiKey,
  primaryModel = 'gemini-2.0-flash',
  fallbackModel = 'gemini-2.5-flash',
  systemPrompt = '',
  voice = 'Enceladus',
  onStatusUpdate = () => {},
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Vui lòng nhập và lưu Gemini API Key trong Cài đặt trước khi sử dụng.');
  }

  if (!text || !text.trim()) {
    throw new Error('Không có nội dung văn bản để chuyển thành giọng nói.');
  }

  // Candidate models to attempt
  const candidateModels = [
    primaryModel,
    fallbackModel,
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
  ].filter(Boolean);

  const modelsToTry = [...new Set(candidateModels)];

  // Fast pre-flight check to find a 100% active model without wasting time on full payloads
  onStatusUpdate('⚡ Đang siêu kiểm tra (Quick Health Check) trạng thái hoạt động của các mô hình...');

  let workingModel = null;
  let isFallbackUsed = false;
  let healthLogs = [];

  for (let i = 0; i < modelsToTry.length; i++) {
    const candidate = modelsToTry[i];
    onStatusUpdate(`🔍 Đang kiểm tra nhanh mô hình ${candidate}...`);

    try {
      await pingModelHealth(candidate, apiKey.trim(), 3500);
      workingModel = candidate;
      isFallbackUsed = i > 0;
      break;
    } catch (pingErr) {
      console.warn(`Health check thất bại với ${candidate}:`, pingErr.message);
      healthLogs.push(`${candidate}: ${pingErr.message}`);
    }
  }

  // If no model passed quick health check, try full payload on first candidate as fallback
  const targetModel = workingModel || modelsToTry[0];
  if (isFallbackUsed) {
    onStatusUpdate(`⚡ Mô hình chính bận. Đã tự động xoay vòng sang mô hình sẵn sàng: ${targetModel}...`);
  } else {
    onStatusUpdate(`🎙 Mô hình ${targetModel} đã sẵn sàng 100%. Đang khởi tạo Podcast...`);
  }

  try {
    const audioResult = await callGeminiAudioApi({
      text,
      apiKey: apiKey.trim(),
      model: targetModel,
      systemPrompt,
      voice,
    });

    return {
      ...audioResult,
      usedModel: targetModel,
      isFallbackUsed,
    };
  } catch (err) {
    // If targetModel fails full generation, try next available models
    for (const altModel of modelsToTry) {
      if (altModel === targetModel) continue;
      onStatusUpdate(`Tự động thử lại với mô hình ${altModel}...`);
      try {
        const result = await callGeminiAudioApi({
          text,
          apiKey: apiKey.trim(),
          model: altModel,
          systemPrompt,
          voice,
        });
        return {
          ...result,
          usedModel: altModel,
          isFallbackUsed: true,
        };
      } catch (_) {
        // continue
      }
    }
    throw new Error(`Tất cả mô hình đều lỗi. Nhật ký: ${healthLogs.join(' | ')} - ${err.message}`);
  }
}

async function callGeminiAudioApi({ text, apiKey, model, systemPrompt, voice }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Newsletter style directive for solemn, serious, news-like delivery
  const styleDirective = '[STYLE / PHONG CÁCH GIỌNG ĐỌC]: Newsletter (Đọc với tông giọng nghiêm nghị, đĩnh đạc, từ tốn, trang trọng và rõ ràng từng câu chữ).';

  let fullPrompt = text;
  if (systemPrompt && systemPrompt.trim()) {
    fullPrompt = `${styleDirective}\n[YÊU CẦU CỤ THỂ]: ${systemPrompt.trim()}\n\n[NỘI DUNG CẦN ĐỌC]: ${text}`;
  } else {
    fullPrompt = `${styleDirective}\n\n[NỘI DUNG CẦN ĐỌC]: ${text}`;
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice || 'Enceladus',
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errMessage = `HTTP status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch (_) {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }

  const data = await response.json();

  const candidates = data.candidates || [];
  if (!candidates.length) {
    throw new Error('Gemini API không trả về nội dung.');
  }

  const parts = candidates[0]?.content?.parts || [];
  let inlineAudioData = null;
  let textResponse = '';

  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      inlineAudioData = part.inlineData;
    }
    if (part.text) {
      textResponse += part.text + ' ';
    }
  }

  if (!inlineAudioData) {
    throw new Error('Gemini không trả về dữ liệu audio stream trong kết quả.');
  }

  const base64Data = inlineAudioData.data;
  const rawMimeType = inlineAudioData.mimeType || 'audio/mp3';
  const rawBytes = base64ToUint8Array(base64Data);

  // Parse sample rate if specified in mimeType string (e.g., audio/pcm;rate=24000)
  let sampleRate = 24000;
  const rateMatch = rawMimeType.match(/rate=(\d+)/i);
  if (rateMatch && rateMatch[1]) {
    sampleRate = parseInt(rateMatch[1], 10);
  }

  let blob;
  const cleanMime = rawMimeType.split(';')[0].trim().toLowerCase();

  // If MIME indicates raw PCM or uncontainerized data, convert to WAV Blob
  if (cleanMime.includes('pcm') || cleanMime.includes('raw') || cleanMime.includes('l16') || !cleanMime.startsWith('audio/')) {
    blob = pcmToWavBlob(rawBytes, sampleRate, 1);
  } else {
    // Standard audio container format (e.g., audio/mp3, audio/wav, audio/ogg)
    blob = new Blob([rawBytes], { type: cleanMime });
  }

  const audioUrl = URL.createObjectURL(blob);

  return {
    audioUrl,
    blob,
    mimeType: blob.type,
    textResponse: textResponse.trim(),
  };
}
