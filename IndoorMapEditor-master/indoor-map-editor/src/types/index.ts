// 基础数据类型定义

export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'premium';
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  map_data: MapData;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface MapData {
  buildings: Building[];
  version: number;
  metadata: {
    created_at: string;
    updated_at: string;
    author: string;
  };
}

export interface Building {
  id: string;
  project_id: string;
  name: string;
  geometry: Geometry;
  height: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  ground_floors: number;
  under_floors: number;
  floors: Floor[];
}

export interface Floor {
  id: string;
  building_id: string;
  name: string;
  floor_number: number;
  height: number;
  geometry: Geometry;
  rooms: Room[];
  public_points: PublicPoint[];
}

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  shop_no?: string;
  category: RoomCategory;
  area_status: AreaStatus;
  sort_type: SortType;
  geometry: Geometry;
  area: number;
}

export interface PublicPoint {
  id: string;
  floor_id: string;
  name: string;
  point_type: PointType;
  position: Position;
  description?: string;
}

export interface Geometry {
  type: 'Polygon' | 'Point';
  coordinates: number[][][] | number[];
}

export interface Position {
  x: number;
  y: number;
}

// 枚举类型
export enum RoomCategory {
  RETAIL = 0,
  RESTAURANT = 1,
  ENTERTAINMENT = 2,
  SERVICE = 3,
  OFFICE = 4,
  OTHER = 5
}

export enum AreaStatus {
  AVAILABLE = 0,
  OCCUPIED = 1,
  MAINTENANCE = 2,
  RESERVED = 3
}

export enum SortType {
  NORMAL = 0,
  PRIORITY = 1,
  FEATURED = 2
}

export enum PointType {
  ENTRANCE = 1,
  ELEVATOR = 2,
  ESCALATOR = 3,
  STAIRS = 4,
  RESTROOM = 5,
  ATM = 6,
  INFORMATION = 7,
  EMERGENCY_EXIT = 8
}

// 编辑器相关类型
export interface EditorState {
  currentTool: EditorTool;
  selectedObjects: string[];
  currentProject: Project | null;
  currentFloor: Floor | null;
  canvasZoom: number;
  canvasOffset: Position;
}

export enum EditorTool {
  SELECT = 'select',
  DRAW_ROOM = 'draw_room',
  ADD_POINT = 'add_point',
  DRAW_WALL = 'draw_wall',
  SPLIT = 'split',
  MERGE = 'merge',
  ZOOM = 'zoom',
  PAN = 'pan'
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}