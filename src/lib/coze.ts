import { CozeAPI, WorkflowEventType, type WorkflowEvent } from '@coze/api';

const DEFAULT_BASE_URL = 'https://api.coze.cn';
const DEFAULT_ENCOURAGE_WORKFLOW_ID = '7639346749559373839';
const DEFAULT_ARTWORK_WORKFLOW_ID = '7638979852711985192';

type WorkflowResponsePayload = Record<string, unknown> | string | null | undefined;

export function getWorkflowIds() {
  return {
    encourageWorkflowId: import.meta.env.PUBLIC_COZE_ENCOURAGE_WORKFLOW_ID?.trim() || DEFAULT_ENCOURAGE_WORKFLOW_ID,
    artworkWorkflowId: import.meta.env.PUBLIC_COZE_ARTWORK_WORKFLOW_ID?.trim() || DEFAULT_ARTWORK_WORKFLOW_ID
  };
}

function getApiBase() {
  const rawBase = import.meta.env.PUBLIC_COZE_API_BASE?.trim() || DEFAULT_BASE_URL;
  return rawBase.replace(/\/v1\/(workflow\/run|workflow\/stream_run|workflows\/chat)\/?$/i, '');
}

function getToken() {
  return import.meta.env.PUBLIC_COZE_TOKEN?.trim() || '';
}

function createClient() {
  const token = getToken();
  if (!token) {
    throw new Error('缺少 Coze 访问令牌，请先在 .env 中配置 PUBLIC_COZE_TOKEN。');
  }

  return new CozeAPI({
    token,
    baseURL: getApiBase(),
    allowPersonalAccessTokenInBrowser: true
  });
}

function parseJsonLike(payload: string) {
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { raw: payload };
  }
}

async function executeWorkflow(parameters: Record<string, unknown>, workflowId: string) {
  const client = createClient();
  const stream = await client.workflows.runs.stream({
    workflow_id: workflowId,
    parameters
  });

  return collectWorkflowOutput(stream);
}

function parseWorkflowOutput(data: unknown) {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return '';

    const parsed = parseJsonLike(trimmed);
    if (Object.keys(parsed).length > 1 || parsed.raw === undefined) {
      return parsed;
    }

    return trimmed;
  }

  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }

  return '';
}

async function collectWorkflowOutput(stream: AsyncGenerator<WorkflowEvent, void>) {
  const messages: string[] = [];

  for await (const event of stream) {
    if (event.event === WorkflowEventType.MESSAGE) {
      const content = extractEventContent(event.data);
      if (content) {
        messages.push(content);
      }
    }

    if (event.event === WorkflowEventType.ERROR) {
      const content = extractEventContent(event.data);
      throw new Error(content || '工作流执行失败。');
    }
  }

  const merged = messages.join('').trim();
  return parseWorkflowOutput(merged);
}

function extractEventContent(eventData: unknown) {
  if (!eventData || typeof eventData !== 'object') {
    return '';
  }

  const record = eventData as Record<string, unknown>;
  const content = record.content;
  if (typeof content === 'string') {
    return content;
  }

  return '';
}

function findStringValue(value: unknown, keys: string[]): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const candidate of Object.values(record)) {
    const nested = findStringValue(candidate, keys);
    if (nested) {
      return nested;
    }
  }

  return '';
}

export async function runWorkflow(parameters: Record<string, unknown>, workflowId: string) {
  return executeWorkflow(parameters, workflowId);
}

export async function uploadCozeFile(file: File) {
  const client = createClient();
  return client.files.upload({ file });
}

export async function runEncouragementWorkflow(studentUuid: string) {
  const { encourageWorkflowId } = getWorkflowIds();
  return runWorkflow({ student_uuid: studentUuid }, encourageWorkflowId);
}

export async function runArtworkWorkflow(payload: { studentUuid: string; voice: string; face: string }) {
  const { artworkWorkflowId } = getWorkflowIds();
  return runWorkflow(
    {
      student_uuid: payload.studentUuid,
      voice: payload.voice,
      face: payload.face
    },
    artworkWorkflowId
  );
}

export function extractEncouragement(payload: WorkflowResponsePayload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();

  const nested = findStringValue(payload, ['encourage', 'encouragement', 'text', 'answer', 'message', 'content', 'output']);
  if (nested) {
    return nested;
  }

  return JSON.stringify(payload, null, 2);
}

export function extractAudioUrl(payload: WorkflowResponsePayload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();

  return findStringValue(payload, ['audio_url', 'audioUrl', 'voice_url', 'voiceUrl', 'url', 'link', 'result', 'output']);
}

export function extractImageUrl(payload: WorkflowResponsePayload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();

  return findStringValue(payload, ['image_url', 'imageUrl', 'url', 'link', 'result', 'output']);
}

export function extractMood(payload: WorkflowResponsePayload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();

  return findStringValue(payload, ['mood', 'str_mood', 'emotion']);
}

export function extractFileUrl(fileObject: unknown) {
  if (!fileObject || typeof fileObject !== 'object') {
    return '';
  }

  const record = fileObject as Record<string, unknown>;
  const candidates = [record.url, record.file_url, record.fileUrl, record.download_url, record.downloadUrl];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

export async function fileToBlobFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}
