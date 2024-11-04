import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Model, ModelParameters } from '../types';

interface ModelEditorProps {
  model: Model;
  onModelChange: (field: keyof Model, value: string | number | Partial<ModelParameters>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const ModelEditor: React.FC<ModelEditorProps> = ({
  model,
  onModelChange,
  onSave,
  onCancel,
}) => {
  const handleParameterChange = (param: keyof ModelParameters, value: number) => {
    onModelChange('parameters', { ...model.parameters, [param]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="model-name">Model Name</Label>
        <Input
          id="model-name"
          value={model.name}
          onChange={(e) => onModelChange('name', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="base-model">Base Model</Label>
        <Input
          id="base-model"
          value={model.baseModel}
          onChange={(e) => onModelChange('baseModel', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          value={model.systemPrompt}
          onChange={(e) => onModelChange('systemPrompt', e.target.value)}
        />
      </div>
      <div>
        <Label>Parameters</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(model.parameters).map(([key, value]) => (
            <div key={key}>
              <Label htmlFor={key}>{key}</Label>
              <Input
                id={key}
                type="number"
                value={value as number}
                onChange={(e) => handleParameterChange(key as keyof ModelParameters, parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </div>
    </div>
  );
};

export default ModelEditor;