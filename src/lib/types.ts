export type StudentProfile = {
  studentUuid: string;
  nickname: string;
  grade: string;
  className: string;
  school: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRecord = {
  id: string;
  createdAt: string;
  kind: 'encouragement' | 'artwork';
  studentUuid: string;
  promptSummary: string;
  encouragement?: string;
  imageUrl?: string;
  voiceDataUrl?: string;
  faceDataUrl?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
};
