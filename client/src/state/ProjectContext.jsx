import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import { api } from "../services/api.js";

const ProjectContext = createContext(null);

const initialState = {
  project: null, // { id, name, width, height, duration }
  objects: [],
  selectedId: null,
  loading: true,
  saving: false,
  dirty: false,
  error: null,
};

function reindexZ(objects) {
  // Keeps zIndex a dense, gapless sequence in current order (1 = bottom).
  return objects.map((obj, i) => ({ ...obj, zIndex: i + 1 }));
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        dirty: false,
        project: {
          id: action.project.id,
          name: action.project.name,
          width: action.project.width,
          height: action.project.height,
          duration: action.project.duration,
        },
        objects: [...action.project.objects].sort((a, b) => a.zIndex - b.zIndex),
        selectedId: null,
      };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };

    case "SET_SAVING":
      return { ...state, saving: action.saving };
    case "MARK_SAVED":
      return { ...state, dirty: false, project: { ...state.project, ...action.project } };

    case "RENAME":
      return { ...state, project: { ...state.project, name: action.name }, dirty: true };

    case "ADD_OBJECT": {
      const objects = reindexZ([...state.objects, { ...action.object, zIndex: 0 }]);
      return { ...state, objects, selectedId: action.object.id, dirty: true };
    }

    case "UPDATE_OBJECT": {
      const objects = state.objects.map((obj) =>
        obj.id === action.id ? { ...obj, ...action.patch } : obj
      );
      return { ...state, objects, dirty: true };
    }

    case "REMOVE_OBJECT": {
      const objects = reindexZ(state.objects.filter((obj) => obj.id !== action.id));
      const selectedId = state.selectedId === action.id ? null : state.selectedId;
      return { ...state, objects, selectedId, dirty: true };
    }

    case "MOVE_LAYER": {
      const sorted = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
      const index = sorted.findIndex((obj) => obj.id === action.id);
      if (index === -1) return state;
      const target = action.direction === "up" ? index + 1 : index - 1;
      if (target < 0 || target >= sorted.length) return state;
      [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
      return { ...state, objects: reindexZ(sorted), dirty: true };
    }

    case "SELECT":
      return { ...state, selectedId: action.id };

    case "SET_CANVAS_SIZE":
      return {
        ...state,
        project: { ...state.project, width: action.width, height: action.height },
        dirty: true,
      };

    default:
      return state;
  }
}

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadProject = useCallback(async (id) => {
    dispatch({ type: "LOAD_START" });
    try {
      const project = await api.getProject(id);
      dispatch({ type: "LOAD_SUCCESS", project });
      localStorage.setItem("led-controller:last-project", project.id);
      return project;
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", error: error.message });
      throw error;
    }
  }, []);

  const newProject = useCallback(
    async (name = "Untitled Project") => {
      dispatch({ type: "LOAD_START" });
      const project = await api.createProject({ name });
      dispatch({ type: "LOAD_SUCCESS", project });
      localStorage.setItem("led-controller:last-project", project.id);
      return project;
    },
    []
  );

  const saveProject = useCallback(async () => {
    if (!state.project) return;
    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const saved = await api.saveProject(state.project.id, {
        name: state.project.name,
        width: state.project.width,
        height: state.project.height,
        duration: state.project.duration,
        objects: state.objects,
      });
      dispatch({ type: "MARK_SAVED", project: saved });
    } finally {
      dispatch({ type: "SET_SAVING", saving: false });
    }
  }, [state.project, state.objects]);

  const saveProjectAs = useCallback(
    async (name) => {
      if (!state.project) return;
      await saveProject(); // persist current edits to the source project first
      const created = await api.saveProjectAs(state.project.id, name);
      dispatch({ type: "LOAD_SUCCESS", project: created });
      localStorage.setItem("led-controller:last-project", created.id);
      return created;
    },
    [state.project, saveProject]
  );

  const renameProject = useCallback(
    async (name) => {
      if (!state.project) return;
      dispatch({ type: "RENAME", name });
      await api.renameProject(state.project.id, name);
    },
    [state.project]
  );

  const deleteProject = useCallback(async (id) => {
    await api.deleteProject(id);
  }, []);

  const addObject = useCallback((object) => dispatch({ type: "ADD_OBJECT", object }), []);
  const updateObject = useCallback(
    (id, patch) => dispatch({ type: "UPDATE_OBJECT", id, patch }),
    []
  );
  const removeObject = useCallback((id) => dispatch({ type: "REMOVE_OBJECT", id }), []);
  const moveLayer = useCallback(
    (id, direction) => dispatch({ type: "MOVE_LAYER", id, direction }),
    []
  );
  const select = useCallback((id) => dispatch({ type: "SELECT", id }), []);
  const setCanvasSize = useCallback(
    (width, height) => dispatch({ type: "SET_CANVAS_SIZE", width, height }),
    []
  );

  const selectedObject = useMemo(
    () => state.objects.find((obj) => obj.id === state.selectedId) ?? null,
    [state.objects, state.selectedId]
  );

  const value = useMemo(
    () => ({
      ...state,
      selectedObject,
      loadProject,
      newProject,
      saveProject,
      saveProjectAs,
      renameProject,
      deleteProject,
      addObject,
      updateObject,
      removeObject,
      moveLayer,
      select,
      setCanvasSize,
    }),
    [
      state,
      selectedObject,
      loadProject,
      newProject,
      saveProject,
      saveProjectAs,
      renameProject,
      deleteProject,
      addObject,
      updateObject,
      removeObject,
      moveLayer,
      select,
      setCanvasSize,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within a ProjectProvider");
  return ctx;
}
