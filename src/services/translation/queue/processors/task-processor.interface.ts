import { QueueTask } from '../queue-task.interface';

/**
 * 队列任务处理器接口
 */
export interface TaskProcessor {
  /**
   * 处理任务
   * @param task 要处理的任务
   */
  process(task: QueueTask): Promise<any>;
} 