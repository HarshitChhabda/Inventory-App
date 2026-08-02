import { Worker } from 'worker_threads';
import path from 'path';

let worker: Worker | null = null;
let taskIdCounter = 0;
const pendingTasks = new Map<string, { resolve: Function; reject: Function }>();

function getWorker(): Worker {
  if (worker === null) {
    const workerPath = path.join(__dirname, 'heavy-tasks.worker.js');
    worker = new Worker(workerPath);

    worker.on('message', (msg: { id: string; result?: any; error?: string }) => {
      const pending = pendingTasks.get(msg.id);
      if (pending) {
        pendingTasks.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
    });

    worker.on('error', (err) => {
      console.error('[WorkerManager] Worker error:', err);
      worker = null;
      pendingTasks.forEach((pending) => {
        pending.reject(err);
      });
      pendingTasks.clear();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[WorkerManager] Worker exited with code ${code}`);
      }
      worker = null;
    });
  }
  return worker;
}

export function runHeavyTask(type: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `task-${++taskIdCounter}`;
    pendingTasks.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, data });
  });
}

export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingTasks.forEach((pending) => {
      pending.reject(new Error('Worker terminated'));
    });
    pendingTasks.clear();
  }
}
