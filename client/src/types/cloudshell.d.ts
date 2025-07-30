export interface CloudShellSession {
  id: string;
  configId: string;
  cluster: string;
  namespace: string;
  podName: string;
  createdAt: string;
  lastActivity: string;
  status: 'creating' | 'ready' | 'terminated';
}

export interface CloudShellCreateRequest {
  config: string;
  cluster: string;
  namespace?: string;
}

export interface CloudShellCreateResponse {
  session: CloudShellSession;
  message: string;
}

export interface CloudShellListResponse {
  sessions: CloudShellSession[];
}

export interface CloudShellDeleteResponse {
  message: string;
} 