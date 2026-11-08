export type ToastType = 'success' | 'error' | 'info' | 'frame';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  timestamp: number;
  count?: number;
}
