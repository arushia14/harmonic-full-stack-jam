
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';
import { 
  getTaskStatus, 
  startBulkTransfer, 
  startSelectiveTransfer, 
  startBulkDelete, 
  startSelectiveDelete, 
  ITaskStatusOut 
} from '../utils/jam-api';
import toast from 'react-hot-toast';

interface TaskContextType {
  task: ITaskStatusOut | null;
  startTransfer: (source: string, dest: string) => void;
  startSelectionTransfer: (ids: number[], dest: string) => void;
  startCollectionDelete: (collectionId: string) => void;
  startSelectionDelete: (collectionId: string, ids: number[]) => void;
  isProcessing: boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [task, setTask] = useState<ITaskStatusOut | null>(null);
  const isProcessing = task?.status === 'PENDING' || task?.status === 'IN_PROGRESS';

  const runTask = useCallback((taskPromise: Promise<ITaskStatusOut>) => {
    taskPromise
      .then(initialTask => {
        setTask({ ...initialTask, progress: 0, total: 0, detail: 'Task is pending...'});
      })
      .catch(err => {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          toast.error(err.response.data.detail || 'Another task is already in progress.');
        } else {
          console.error('Failed to start task', err);
          toast.error('Failed to start the task.');
        }
      });
  }, []);

  const startTransfer = useCallback((s, d) => runTask(startBulkTransfer(s, d)), [runTask]);
  const startSelectionTransfer = useCallback((i, d) => runTask(startSelectiveTransfer(i, d)), [runTask]);
  const startCollectionDelete = useCallback((id) => runTask(startBulkDelete(id)), [runTask]);
  const startSelectionDelete = useCallback((id, i) => runTask(startSelectiveDelete(id, i)), [runTask]);


  // manage polling interval lifecycle
  useEffect(() => {
    // if no task is processing, do nothing
    if (!isProcessing || !task) {
      return;
    }

    // set up interval to poll for status updates
    const poll = setInterval(async () => {
      try {
        const updatedTask = await getTaskStatus(task.task_id);
        setTask(updatedTask);
      } catch (error) {
        console.error('Polling failed', error);
        // if polling fails, stop interval and mark task as failed
        clearInterval(poll);
        setTask(prev => prev ? { ...prev, status: 'FAILED', detail: 'Lost connection to task.' } : null);
      }
    }, 2000); // poll every 2 seconds

    // cleanup function: clear interval when task stops processing
    return () => clearInterval(poll);
  }, [isProcessing, task?.task_id]); // this effect only re-runs if new task starts or current one finishes

  // manage displaying toast notifications based on current task state
  useEffect(() => {
    if (!task) return;

    const toastId = task.task_id;

    if (isProcessing) {
      const percentage = task.total > 0 ? Math.round((task.progress / task.total) * 100) : 0;
      const message = task.status === 'PENDING' 
        ? 'Starting task...' 
        : `${task.detail || 'Processing...'} ${task.progress} / ${task.total} (${percentage}%)`;
      toast.loading(message, { id: toastId });
    } else {
      // when task is no longer processing, show final status toast
      toast.dismiss(toastId);
      const finalMessage = `${task.status}: ${task.detail}`;
      if (task.status === 'SUCCESS') {
        toast.success(finalMessage, { duration: 4000 });
      } else if (task.status === 'FAILED') {
        toast.error(finalMessage, { duration: 6000 });
      }
    }
  }, [task]); // this effect re-runs every time task object is updated with new progress

  const value = { task, startTransfer, startSelectionTransfer, startCollectionDelete, startSelectionDelete, isProcessing };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTask must be used within a TaskProvider');
  return context;
};
