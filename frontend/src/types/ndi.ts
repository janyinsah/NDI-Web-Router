export interface NDISource {
  name: string;
  url: string;
  connected: boolean;
  group?: string;
}

export interface MatrixSourceSlot {
  slotNumber: number;
  assignedNdiSource: string;
  displayName: string;
  isAssigned: boolean;
}

export interface MatrixDestination {
  slotNumber: number;
  name: string;
  description: string;
  enabled: boolean;
  currentSourceSlot: number; // 0 means no source assigned
}

export interface MatrixRoute {
  id: string;
  sourceSlot: number;
  destinationSlot: number;
  active: boolean;
}

export interface CreateMatrixDestinationRequest {
  name: string;
  description?: string;
}

export interface AssignSourceToSlotRequest {
  slotNumber: number;
  ndiSourceName: string;
  displayName?: string;
}

export interface CreateMatrixRouteRequest {
  sourceSlot: number;
  destinationSlot: number;
}

export interface RemoveMatrixRouteRequest {
  sourceSlot: number;
  destinationSlot: number;
}

// Legacy types (for backward compatibility)
export interface NDIDestination {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  currentSource: string;
}

export interface NDIRoute {
  id: string;
  source: string;
  destination: string;
  destinationId: string;
  active: boolean;
}

export interface CreateDestinationRequest {
  name: string;
  description?: string;
}

export interface CreateRouteRequest {
  source: string;
  destinationId: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}