import { useState, useCallback, useEffect } from 'react';
import { Model } from '../types';

export function useModels() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [editingModel, setEditingModel] = useState<Model | null>(null);

    return {
        modelsLoaded,
        setModelsLoaded,
        availableModels,
        setAvailableModels,
        models,
        setModels,
        selectedModel,
        setSelectedModel,
        editingModel,
        setEditingModel,
    }
}