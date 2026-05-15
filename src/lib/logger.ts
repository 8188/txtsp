import type { WorkflowRecord } from './types';

const LOG_DB_NAME = 'tongxin-logs';
const LOG_STORE_NAME = 'workflow-logs';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOG_DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open log database'));
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(LOG_STORE_NAME)) {
        database.createObjectStore(LOG_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
  });
}

export async function saveLogToFile(record: WorkflowRecord): Promise<void> {
  try {
    const database = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([LOG_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(LOG_STORE_NAME);
      
      const logEntry = {
        id: record.id,
        timestamp: record.createdAt,
        kind: record.kind,
        studentUuid: record.studentUuid,
        promptSummary: record.promptSummary,
        encouragement: record.encouragement || null,
        imageUrl: record.imageUrl || null,
        voiceDataUrl: record.voiceDataUrl || null,
        faceDataUrl: record.faceDataUrl || null,
        status: record.status,
        errorMessage: record.errorMessage || null,
        loggedAt: new Date().toISOString()
      };

      const request = store.add(logEntry);

      request.onsuccess = () => {
        console.log(`Log saved: ${record.kind} - ${record.status}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save log entry'));
      };
    });
  } catch (error) {
    console.error('Error saving log:', error);
  }
}

export async function exportLogsToFile(): Promise<void> {
  try {
    const database = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([LOG_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LOG_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const logs = request.result as Array<{ 
          timestamp: string; 
          kind: string; 
          status: string; 
          studentUuid: string; 
          promptSummary: string; 
          encouragement?: string | null; 
          imageUrl?: string | null; 
          errorMessage?: string | null;
        }>;
        
        // Create a formatted log text
        const logText = logs
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map(log => {
            return `[${log.timestamp}] ${log.kind.toUpperCase()} | Status: ${log.status} | Student: ${log.studentUuid}\n` +
                   `  Summary: ${log.promptSummary}\n` +
                   (log.encouragement ? `  Encouragement: ${log.encouragement}\n` : '') +
                   (log.imageUrl ? `  Image URL: ${log.imageUrl}\n` : '') +
                   (log.errorMessage ? `  Error: ${log.errorMessage}\n` : '') +
                   '  ' + '-'.repeat(50);
          })
          .join('\n');

        // Create and trigger download
        const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tongxin-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to export logs'));
      };
    });
  } catch (error) {
    console.error('Error exporting logs:', error);
  }
}

export async function getLogCount(): Promise<number> {
  try {
    const database = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([LOG_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LOG_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get log count'));
      };
    });
  } catch (error) {
    console.error('Error getting log count:', error);
    return 0;
  }
}
