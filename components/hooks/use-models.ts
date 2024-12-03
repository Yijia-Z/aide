import { useState, useCallback, useEffect } from "react";
import { Model } from "../types";
import { storage } from "../store";

export function useModels() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    // Initialize from localStorage
    const saved = storage.get('selectedModels');
    return saved || [];
  });
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  // Save selectedModels to localStorage whenever it changes
  useEffect(() => {
    storage.set('selectedModels', selectedModels);
  }, [selectedModels]);

  return {
    modelsLoaded,
    setModelsLoaded,
    availableModels,
    setAvailableModels,
    models,
    setModels,
    selectedModels,
    setSelectedModels,
    editingModel,
    setEditingModel,
  };
}