import type { StudentProfile, WorkflowRecord } from './types';

const PROFILE_KEY = 'tongxin.profile';
const HISTORY_KEY = 'tongxin.history';
const PROFILE_MAP_KEY = 'tongxin.profile.map';

export function createStudentUuid() {
  return `stu_${crypto.randomUUID()}`;
}

type ProfileMap = Record<string, string>;

function loadProfileMap(): ProfileMap {
  const raw = localStorage.getItem(PROFILE_MAP_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as ProfileMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveProfileMap(map: ProfileMap) {
  localStorage.setItem(PROFILE_MAP_KEY, JSON.stringify(map));
}

export function getOrCreateStudentUuid(profileKey: string) {
  const normalized = profileKey.trim().toLowerCase();
  if (!normalized) {
    return createStudentUuid();
  }

  const map = loadProfileMap();
  if (map[normalized]) {
    return map[normalized];
  }

  const uuid = createStudentUuid();
  map[normalized] = uuid;
  saveProfileMap(map);
  return uuid;
}

export function loadProfile(): StudentProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StudentProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: StudentProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

export function loadHistory(): WorkflowRecord[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as WorkflowRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(records: WorkflowRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 20)));
}
