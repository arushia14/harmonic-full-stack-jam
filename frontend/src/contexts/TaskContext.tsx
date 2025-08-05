
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  getTaskStatus, 
  startBulkTransfer, 
  startSelectiveTransfer, // new function
  startBulkDelete,      // new function
  ITaskStatusOut 
} from '../utils/jam-api';
import toast from 'react-hot-toast';

// context state shape
interface TaskContextType {
  task: ITaskStatusOut | null;
  startTransfer: (sourceCollectionId: string, destinationCollectionId: string) => Promise<void>;
  startSelectionTransfer: (companyIds: number[], destinationCollectionId: string) => Promise<void>; // new action
  startCollectionDelete: (collectionId: string) => Promise<void>; // new action
  isProcessing: boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  const [task, setTask] = useState<ITaskStatusOut | null>(null);
  const isProcessing = task?.status === 'PENDING' || task?.status === 'IN_PROGRESS';

  const setInitialTask = (initialTaskPromise: Promise<any>, loadingMessage: string) => {
    toast.loading(loadingMessage, { id: 'taskStart' });
    initialTaskPromise.then(initialTask => {
      toast.dismiss('taskStart');
      setTask({
        ...initialTask,
        progress: 0,
        total: 0,
        detail: 'Task is pending...',
      });
    }).catch(error => {
      console.error('Failed to start task', error);
      toast.dismiss('taskStart');
      toast.error('Failed to start the task.');
    });
  };

  const startTransfer = useCallback(async (source: string, dest: string) => {
    setInitialTask(startBulkTransfer(source, dest), 'Starting full transfer...');
  }, []);

  const startSelectionTransfer = useCallback(async (ids: number[], dest: string) => {
    setInitialTask(startSelectiveTransfer(ids, dest), 'Starting selection transfer...');
  }, []);

  const startCollectionDelete = useCallback(async (collectionId: string) => {
    setInitialTask(startBulkDelete(collectionId), 'Starting bulk delete...');
  }, []);

  useEffect(() => {
    if (!task || !isProcessing) return;

    const intervalId = setInterval(async () => {
      try {
        const updatedTask = await getTaskStatus(task.task_id);
        setTask(updatedTask);

        if (updatedTask.status === 'IN_PROGRESS') {
          const percentage = updatedTask.total > 0 ? Math.round((updatedTask.progress / updatedTask.total) * 100) : 0;
          toast.loading(`${updatedTask.detail} ${updatedTask.progress} / ${updatedTask.total} (${percentage}%)`, { id: task.task_id });
        } else if (updatedTask.status === 'SUCCESS') {
          toast.success(updatedTask.detail, { id: task.task_id, duration: 4000 });
          clearInterval(intervalId);
        } else if (updatedTask.status === 'FAILED') {
          toast.error(`Task failed: ${updatedTask.detail}`, { id: task.task_id });
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Failed to get task status', error);
        toast.error('Could not get task status.', { id: task.task_id });
        clearInterval(intervalId);
      }
    }, 2000); // poll every 2 seconds

    return () => clearInterval(intervalId);
  }, [task, isProcessing]);

  const value = { task, startTransfer, startSelectionTransfer, startCollectionDelete, isProcessing };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};
