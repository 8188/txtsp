import { extractAudioUrl, extractEncouragement, extractFileUrl, extractImageUrl, extractMood, runArtworkWorkflow, runEncouragementWorkflow, fileToBlobFile, uploadCozeFile } from './coze';
import { getOrCreateStudentUuid, loadProfile, saveProfile, clearProfile } from './storage';
import { saveLogToFile } from './logger';
import type { StudentProfile, WorkflowRecord } from './types';

function requireEl<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`页面初始化失败，缺少必要的 DOM 节点: ${selector}`);
  }
  return el;
}

const profileForm = requireEl<HTMLFormElement>('[data-profile-form]');
const loginPanel = requireEl<HTMLElement>('[data-login-panel]');
const profileSummary = requireEl<HTMLElement>('[data-profile-summary]');
const resultEncouragement = requireEl<HTMLElement>('[data-result-encouragement]');
const resultImage = requireEl<HTMLImageElement>('[data-result-image]');
const resultMood = document.querySelector<HTMLElement>('[data-result-mood]');
const historyList = document.querySelector<HTMLElement>('[data-history-list]');
const video = requireEl<HTMLVideoElement>('[data-camera-preview]');
const canvas = requireEl<HTMLCanvasElement>('[data-capture-canvas]');
const profileCorner = requireEl<HTMLElement>('[data-profile-corner]');
const cameraPlaceholder = requireEl<HTMLElement>('[data-camera-placeholder]');
const cameraFrame = requireEl<HTMLElement>('[data-camera-frame]');
const profileSwitchButton = requireEl<HTMLButtonElement>('[data-switch-profile]');
const captureFaceButton = requireEl<HTMLButtonElement>('[data-capture-face]');
const encourageButton = requireEl<HTMLButtonElement>('[data-run-encouragement]');
const artworkButton = requireEl<HTMLButtonElement>('[data-run-artwork]');
const encouragementAudio = requireEl<HTMLAudioElement>('[data-encouragement-player]');
const authSections = Array.from(document.querySelectorAll<HTMLElement>('[data-auth-section]'));

const profileFields = profileForm.elements as typeof profileForm.elements & {
  nickname: HTMLInputElement;
  grade: HTMLInputElement;
  className: HTMLInputElement;
  school: HTMLInputElement;
};

const state = {
  profile: loadProfile() as StudentProfile | null,
  mediaStream: null as MediaStream | null,
  faceDataUrl: '',
  faceBlob: null as Blob | null,
  busy: false
};

renderProfileState();
setStatus('准备就绪，先登录再开始。');

profileForm.addEventListener('submit', handleProfileSubmit);
profileSwitchButton.addEventListener('click', switchProfile);
captureFaceButton.addEventListener('click', captureFace);
encourageButton.addEventListener('click', runEncouragement);
artworkButton.addEventListener('click', runArtwork);

void autoRestoreMedia();

function setStatus(message: string, tone: 'default' | 'success' | 'error' = 'default') {
  if (!message) return;
  if (tone === 'success') {
    console.log('[状态]', message);
    return;
  }
  resultEncouragement.textContent = message;
  resultEncouragement.dataset.tone = tone;
}

function showLoading() {
  resultEncouragement.dataset.loading = 'true';
}

function hideLoading() {
  delete resultEncouragement.dataset.loading;
  if (resultEncouragement.dataset.tone !== 'error') {
    resultEncouragement.textContent = '先点按钮，魔法马上来 ✨';
    delete resultEncouragement.dataset.tone;
  }
}

function renderProfileState() {
  const hasProfile = Boolean(state.profile);
  loginPanel.hidden = hasProfile;
  profileCorner.hidden = !hasProfile;
  authSections.forEach((section) => {
    section.hidden = !hasProfile;
  });

  if (!state.profile) {
    profileSummary.textContent = '尚未登录';
    return;
  }

  profileSummary.textContent = state.profile.nickname;

  const tooltipName = document.querySelector<HTMLElement>('[data-profile-tooltip-name]');
  const tooltipMeta = document.querySelector<HTMLElement>('[data-profile-tooltip-meta]');
  const tooltipId = document.querySelector<HTMLElement>('[data-profile-tooltip-id]');
  if (tooltipName) tooltipName.textContent = state.profile.nickname;
  if (tooltipMeta) tooltipMeta.textContent = `${state.profile.grade} · ${state.profile.className} · ${state.profile.school}`;
  if (tooltipId) tooltipId.textContent = `ID: ${state.profile.studentUuid}`;

  profileFields.nickname.value = state.profile.nickname;
  profileFields.grade.value = state.profile.grade;
  profileFields.className.value = state.profile.className;
  profileFields.school.value = state.profile.school;
}

function renderHistory() {
  // History logging is now handled by the logger module.
  // This function is kept for compatibility but does nothing.
}

function buildProfileKey(payload: { nickname: string; grade: string; className: string; school: string }) {
  return [payload.nickname, payload.grade, payload.className, payload.school]
    .map((value) => value.trim().toLowerCase())
    .join('|');
}

async function handleProfileSubmit(event: SubmitEvent) {
  event.preventDefault();

  const nickname = profileFields.nickname.value.trim();
  const grade = profileFields.grade.value.trim();
  const className = profileFields.className.value.trim();
  const school = profileFields.school.value.trim();

  if (!nickname) {
    setStatus('请至少填写姓名。', 'error');
    return;
  }

  const now = new Date().toISOString();
  const profileKey = buildProfileKey({ nickname, grade, className, school });
  state.profile = {
    studentUuid: getOrCreateStudentUuid(profileKey),
    nickname,
    grade,
    className,
    school,
    createdAt: state.profile?.createdAt || now,
    updatedAt: now
  };

  saveProfile(state.profile);
  renderProfileState();
  await autoRestoreMedia();
}

function switchProfile() {
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
  video.srcObject = null;
  cameraPlaceholder.hidden = false;
  state.faceBlob = null;
  state.faceDataUrl = '';
  encouragementAudio.src = '';
  encouragementAudio.hidden = true;
  resultImage.hidden = true;
  resultEncouragement.textContent = '先点按钮，魔法马上来。';
  state.profile = null;
  clearProfile();
  profileForm.reset();
  renderProfileState();
  setStatus('已退出当前学生档案。');
}

async function autoRestoreMedia() {
  if (!state.profile) return;
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    await enableMedia();
  } catch {
    // ignore silent restore failures
  }
}

async function enableMedia() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('当前浏览器不支持摄像头，你仍可使用其他功能。', 'error');
    return false;
  }

  try {
    state.mediaStream?.getTracks().forEach((track) => track.stop());
    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user'
      }
    });
    video.srcObject = state.mediaStream;
    await video.play();
    cameraPlaceholder.hidden = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法启用摄像头。';
    setStatus(message, 'error');
    return false;
  }
}

function captureFace() {
  if (!state.mediaStream) {
    setStatus('请先启用摄像头。', 'error');
    return;
  }

  // 闪光反馈
  cameraFrame.classList.add('flash');
  setTimeout(() => cameraFrame.classList.remove('flash'), 350);

  const context = canvas.getContext('2d');
  if (!context) {
    setStatus('无法创建画布上下文。', 'error');
    return;
  }

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;
  // 截图时需要翻转回来，因为视频是镜像显示的
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, width, height);
  context.restore();
  state.faceDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  canvas.toBlob((blob) => {
    state.faceBlob = blob;
  }, 'image/jpeg', 0.92);
  setStatus('人脸图片已保存。', 'success');
}

async function runEncouragement() {
  if (!state.profile) {
    setStatus('请先登录学生档案。', 'error');
    return;
  }

  if (state.busy) return;
  state.busy = true;
  encourageButton.disabled = true;
  artworkButton.disabled = true;
  setStatus('正在调用鼓励工作流...');
  showLoading();

  try {
    const payload = await runEncouragementWorkflow(state.profile.studentUuid);
    console.log('Encouragement workflow raw result:', payload);
    const encouragement = validateEncouragement(extractEncouragement(payload));
    const audioUrl = validateAudioUrl(extractAudioUrl(payload));
    resultEncouragement.textContent = encouragement;
    if (audioUrl) {
      encouragementAudio.src = audioUrl;
      encouragementAudio.hidden = false;
      void encouragementAudio.play().catch(() => {
        setStatus('鼓励语音已加载，请点击播放器的播放按钮。', 'success');
      });
    } else {
      throw new Error('工作流没有返回可播放的语音 URL。');
    }
    appendRecord({
      kind: 'encouragement',
      promptSummary: `student_uuid = ${state.profile.studentUuid}`,
      encouragement,
      voiceDataUrl: audioUrl,
      status: 'success'
    });
    setStatus('鼓励语音已加载。', 'success');
  } catch (error) {
    console.error('Encouragement workflow failed:', error);
    const message = error instanceof Error ? error.message : '鼓励工作流调用失败。';
    appendRecord({
      kind: 'encouragement',
      promptSummary: `student_uuid = ${state.profile.studentUuid}`,
      status: 'failed',
      errorMessage: message
    });
    setStatus(message, 'error');
  } finally {
    hideLoading();
    state.busy = false;
    encourageButton.disabled = false;
    artworkButton.disabled = false;
  }
}

async function runArtwork() {
  if (!state.profile) {
    setStatus('请先登录学生档案。', 'error');
    return;
  }

  if (!state.faceDataUrl) {
    setStatus('请先拍一张头像。', 'error');
    return;
  }

  if (state.busy) return;
  state.busy = true;
  encourageButton.disabled = true;
  artworkButton.disabled = true;
  setStatus('正在调用治愈画工作流...');
  showLoading();

  try {
    const faceFile = await fileToBlobFile(state.faceBlob || dataUrlToBlob(state.faceDataUrl), `face-${state.profile.studentUuid}.jpg`);
    const faceUpload = await uploadCozeFile(faceFile);
    const rawFaceInput = extractFileUrl(faceUpload) || String((faceUpload as { id?: string }).id || '');

    if (!rawFaceInput) {
      throw new Error('头像文件上传后没有可用的 URL 或 file_id。');
    }

    const faceParam = /^https?:\/\//i.test(rawFaceInput)
      ? rawFaceInput
      : JSON.stringify({ file_id: rawFaceInput });

    console.log('Calling artwork workflow with parameters:', { student_uuid: state.profile.studentUuid, face: faceParam });

    const payload = await runArtworkWorkflow({
      studentUuid: state.profile.studentUuid,
      face: String(faceParam)
    });
    console.log('Artwork workflow raw result:', payload);
    const imageUrl = validateImageUrl(extractImageUrl(payload));
    const mood = extractMood(payload).trim();
    if (!imageUrl) {
      throw new Error('工作流返回了空图片地址，请确认工作流最终节点输出了 image_url。');
    }
    resultImage.src = imageUrl;
    resultImage.hidden = false;

    if (mood) {
      resultMood!.textContent = mood;
      const moodDisplay = resultMood!.closest<HTMLElement>('.mood-display');
      if (moodDisplay) moodDisplay.hidden = false;
    } else {
      if (resultMood) resultMood.textContent = '';
      const moodDisplay = resultMood?.closest<HTMLElement>('.mood-display');
      if (moodDisplay) moodDisplay.hidden = true;
    }

    appendRecord({
      kind: 'artwork',
      promptSummary: `student_uuid = ${state.profile.studentUuid}`,
      imageUrl,
      mood: mood || undefined,
      faceDataUrl: state.faceDataUrl,
      status: 'success'
    });
    setStatus('治愈画已生成。', 'success');
  } catch (error) {
    console.error('Artwork workflow failed:', error);
    const message = error instanceof Error ? error.message : '治愈画工作流调用失败。';
    appendRecord({
      kind: 'artwork',
      promptSummary: `student_uuid = ${state.profile.studentUuid}`,
      status: 'failed',
      errorMessage: message,
      faceDataUrl: state.faceDataUrl
    });
    setStatus(message, 'error');
  } finally {
    hideLoading();
    state.busy = false;
    encourageButton.disabled = false;
    artworkButton.disabled = false;
  }
}

// 图片全屏灯箱
const lightbox = requireEl<HTMLElement>('[data-lightbox]');
const lightboxImg = requireEl<HTMLImageElement>('[data-lightbox-img]');
const lightboxCloseButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-lightbox-close]'));

resultImage.addEventListener('click', () => {
  if (!resultImage.src || resultImage.hidden) return;
  lightboxImg.src = resultImage.src;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
});

lightboxCloseButtons.forEach(btn => {
  btn.addEventListener('click', closeLightbox);
});

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !lightbox.hidden) {
    closeLightbox();
  }
});

function appendRecord(record: Omit<WorkflowRecord, 'id' | 'createdAt' | 'studentUuid'>) {
  const nextRecord: WorkflowRecord = {
    ...record,
    studentUuid: state.profile?.studentUuid || '',
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  // Save log to IndexedDB via logger module
  void saveLogToFile(nextRecord);
}

function validateEncouragement(text: string) {
  const value = text.trim();
  if (!value) {
    throw new Error('工作流返回了空的鼓励内容。');
  }

  if (value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }

  const blockedWords = ['成人', '暴力', '赌博', '色情', '违法'];
  if (blockedWords.some((word) => value.includes(word))) {
    throw new Error('鼓励内容未通过儿童安全校验。');
  }

  return value;
}

function validateAudioUrl(url: string) {
  const value = url.trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function validateImageUrl(url: string) {
  const value = url.trim();
  if (!value) return '';

  if (/^data:image\//i.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(',');
  const match = header?.match(/data:(.*?);base64/);
  const mimeType = match?.[1] || 'application/octet-stream';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
