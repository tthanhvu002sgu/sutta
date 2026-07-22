/**
 * Gemini Voice & TTS API Service
 * Handles long text chunking, PCM audio concatenation, live progress tracking,
 * health checks, and fallback model strategy.
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
 * Concatenates multiple Uint8Array PCM byte arrays into a single Uint8Array.
 */
function concatenatePcmArrays(pcmArrays) {
  let totalLength = 0;
  for (const arr of pcmArrays) {
    totalLength += arr.length;
  }
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of pcmArrays) {
    combined.set(arr, offset);
    offset += arr.length;
  }
  return combined;
}

/**
 * Splits long text into manageable chunks at sentence boundaries (target ~9000 characters / ~3000 tokens per chunk)
 * to prevent Gemini API output token cutoff while minimizing API calls.
 */
function splitTextIntoChunks(text, targetChunkSize = 9000) {
  if (!text || text.length <= targetChunkSize) {
    return [text];
  }

  const paragraphs = text.split(/\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    if (currentChunk.length + para.length <= targetChunkSize) {
      currentChunk += (currentChunk ? '\n' : '') + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (para.length > targetChunkSize) {
        const sentences = para.match(/[^.!?]+[.!?]+|\S+/g) || [para];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= targetChunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Quick Pre-flight Health Check to test if a model is active and responding
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
 * Call Gemini API with automated long-text chunking & seamless PCM audio concatenation
 */
export async function generateGeminiAudio({
  text,
  apiKey,
  primaryModel = 'gemini-2.0-flash-exp',
  fallbackModel = 'gemini-2.0-flash',
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

  // Candidate models
  const candidateModels = [
    primaryModel,
    fallbackModel,
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
  ].filter(Boolean);

  const modelsToTry = [...new Set(candidateModels)];

  // Stage 1: Split text into chunks (~3000 tokens / 9000 chars) to prevent token cutoff
  const textChunks = splitTextIntoChunks(text, 9000);
  console.log(`Đã phân đoạn văn bản thành ${textChunks.length} phần.`);

  onStatusUpdate({ percent: 10, message: `Kiểm tra mô hình API (${textChunks.length} đoạn văn bản)...` });

  let workingModel = null;
  let isFallbackUsed = false;

  for (let i = 0; i < modelsToTry.length; i++) {
    const candidate = modelsToTry[i];
    onStatusUpdate({ percent: 10 + (i + 1) * 3, message: `Kiểm tra kết nối mô hình ${candidate}...` });

    try {
      await pingModelHealth(candidate, apiKey.trim(), 3500);
      workingModel = candidate;
      isFallbackUsed = i > 0;
      break;
    } catch (pingErr) {
      console.warn(`Health check thất bại với ${candidate}:`, pingErr.message);
    }
  }

  const targetModel = workingModel || modelsToTry[0];
  const pcmChunkList = [];
  let detectedSampleRate = 24000;

  // Stage 2: Sequentially generate audio for each chunk
  for (let i = 0; i < textChunks.length; i++) {
    const currentChunkText = textChunks[i];
    const chunkPercent = Math.round(20 + ((i + 1) / textChunks.length) * 70);

    onStatusUpdate({
      percent: chunkPercent,
      message: `Đang đọc AI đoạn ${i + 1}/${textChunks.length}...`,
    });

    try {
      const chunkResult = await callGeminiAudioApi({
        text: currentChunkText,
        apiKey: apiKey.trim(),
        model: targetModel,
        systemPrompt: i === 0 ? systemPrompt : '', // apply prompt context on main chunk
        voice,
      });

      pcmChunkList.push(chunkResult.rawBytes);
      if (chunkResult.sampleRate) {
        detectedSampleRate = chunkResult.sampleRate;
      }
    } catch (err) {
      console.warn(`Lỗi khi tạo đoạn ${i + 1} với mô hình ${targetModel}:`, err);
      // Fallback to alternative model if current chunk fails
      let recovered = false;
      for (const altModel of modelsToTry) {
        if (altModel === targetModel) continue;
        try {
          const chunkResult = await callGeminiAudioApi({
            text: currentChunkText,
            apiKey: apiKey.trim(),
            model: altModel,
            systemPrompt: i === 0 ? systemPrompt : '',
            voice,
          });
          pcmChunkList.push(chunkResult.rawBytes);
          if (chunkResult.sampleRate) detectedSampleRate = chunkResult.sampleRate;
          recovered = true;
          isFallbackUsed = true;
          break;
        } catch (_) {}
      }
      if (!recovered) {
        throw new Error(`Lỗi tại đoạn ${i + 1}/${textChunks.length}: ${err.message}`);
      }
    }
  }

  // Stage 3: Concatenate all PCM chunks seamlessly
  onStatusUpdate({ percent: 95, message: 'Đang nối các đoạn Audio & tạo file hoàn chỉnh...' });

  const finalPcmBytes = concatenatePcmArrays(pcmChunkList);
  const finalBlob = pcmToWavBlob(finalPcmBytes, detectedSampleRate, 1);
  const audioUrl = URL.createObjectURL(finalBlob);

  onStatusUpdate({ percent: 100, message: 'Hoàn tất!' });

  return {
    audioUrl,
    blob: finalBlob,
    mimeType: finalBlob.type,
    usedModel: targetModel,
    isFallbackUsed,
    chunksCount: textChunks.length,
  };
}

async function callGeminiAudioApi({ text, apiKey, model, systemPrompt, voice }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const isTtsDedicatedModel = model.includes('tts') || model.includes('preview-tts');

  // Explicit Southern Vietnamese accent & tone directive
  const accentDirective = '[CHẤT GIỌNG / ACCENT]: Đọc 100% bằng giọng miền Nam Việt Nam (Southern Vietnamese Accent), âm điệu Nam Bộ ấm áp, từ tốn, trang trọng và truyền cảm.';

  let fullPrompt = text;
  if (isTtsDedicatedModel) {
    // For TTS dedicated models, prepend simple clean accent directive before transcript text
    fullPrompt = `${accentDirective}\n\n${text}`;
  } else {
    const customInstruction = systemPrompt && systemPrompt.trim() ? systemPrompt.trim() : accentDirective;
    fullPrompt = `${accentDirective}\n[YÊU CẦU CỤ THỂ]: ${customInstruction}\n[PHONG CÁCH]: Newsletter (Nghiêm nghị, từ tốn, rõ lời, chuẩn giọng miền Nam Việt Nam).\n\n[NỘI DUNG CẦN ĐỌC]:\n${text}`;
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

  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      inlineAudioData = part.inlineData;
    }
  }

  if (!inlineAudioData) {
    throw new Error('Gemini không trả về dữ liệu audio stream trong kết quả.');
  }

  const base64Data = inlineAudioData.data;
  const rawMimeType = inlineAudioData.mimeType || 'audio/mp3';
  const rawBytes = base64ToUint8Array(base64Data);

  let sampleRate = 24000;
  const rateMatch = rawMimeType.match(/rate=(\d+)/i);
  if (rateMatch && rateMatch[1]) {
    sampleRate = parseInt(rateMatch[1], 10);
  }

  return {
    rawBytes,
    sampleRate,
    rawMimeType,
  };
}
