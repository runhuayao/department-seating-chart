import { create } from 'zustand';

// 临时定义相关接口
interface Position {
  x: number;
  y: number;
}

enum EditorTool {
  SELECT = 'select',
  DRAW_ROOM = 'draw_room',
  ADD_POINT = 'add_point',
  DRAW_WALL = 'draw_wall',
  SPLIT = 'split',
  MERGE = 'merge',
  ZOOM = 'zoom',
  PAN = 'pan'
}

interface Project {
  id: string;
  user_id: string;
  name: string;
  map_data: any;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

interface Floor {
  id: string;
  building_id: string;
  name: string;
  floor_number: number;
  height: number;
  geometry: any;
  rooms: any[];
  public_points: any[];
}

interface EditorState {
  currentTool: EditorTool;
  selectedObjects: string[];
  currentProject: Project | null;
  currentFloor: Floor | null;
  canvasZoom: number;
  canvasOffset: Position;
}

interface EditorStore extends EditorState {
  // Actions
  setCurrentTool: (tool: EditorTool) => void;
  setSelectedObjects: (objects: string[]) => void;
  addSelectedObject: (objectId: string) => void;
  removeSelectedObject: (objectId: string) => void;
  clearSelection: () => void;
  setCurrentProject: (project: Project | null) => void;
  setCurrentFloor: (floor: Floor | null) => void;
  setCanvasZoom: (zoom: number) => void;
  setCanvasOffset: (offset: Position) => void;
  resetEditor: () => void;
}

const initialState: EditorState = {
  currentTool: EditorTool.SELECT,
  selectedObjects: [],
  currentProject: null,
  currentFloor: null,
  canvasZoom: 1,
  canvasOffset: { x: 0, y: 0 }
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,

  setCurrentTool: (tool) => set({ currentTool: tool }),

  setSelectedObjects: (objects) => set({ selectedObjects: objects }),

  addSelectedObject: (objectId) => {
    const { selectedObjects } = get();
    if (!selectedObjects.includes(objectId)) {
      set({ selectedObjects: [...selectedObjects, objectId] });
    }
  },

  removeSelectedObject: (objectId) => {
    const { selectedObjects } = get();
    set({ selectedObjects: selectedObjects.filter(id => id !== objectId) });
  },

  clearSelection: () => set({ selectedObjects: [] }),

  setCurrentProject: (project) => set({ currentProject: project }),

  setCurrentFloor: (floor) => set({ currentFloor: floor }),

  setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.1, Math.min(5, zoom)) }),

  setCanvasOffset: (offset) => set({ canvasOffset: offset }),

  resetEditor: () => set(initialState)
}));