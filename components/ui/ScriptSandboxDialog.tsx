"use client";

import React, { useEffect, useState } from "react";
import DraggableDialog from "@/components/ui/draggable-dialog";
import { Button } from "@/components/ui/button";
import { Editor } from "@monaco-editor/react"; // 关键：导入Monaco Editor

interface ScriptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId: string;
  initialScript?: string;
  onSaveScript: (toolId: string, script: string) => void;
  onUploadScript: (toolId: string, script: string) => void;
}

export function ScriptEditorDialog({
  open,
  onOpenChange,
  toolId,
  initialScript = "",
  onSaveScript,
  onUploadScript,
}: ScriptEditorDialogProps) {
  const [tempScript, setTempScript] = useState(initialScript);

  useEffect(() => {
    if (open) {
      setTempScript(initialScript);
    }
  }, [open, initialScript]);

  function handleSave() {
    onSaveScript(toolId, tempScript);
    console.log("Got script =>", toolId, tempScript);
    onOpenChange(false);
  }
  async function handleUpload() {
    // 这里既可以先save，再upload
    // 也可以合并, 具体看你的后端
    await onUploadScript(toolId, tempScript);
    console.log("Uploaded script =>", toolId, tempScript);
    onOpenChange(false);
  }

  return (
    <DraggableDialog open={open} onOpenChange={onOpenChange}>
      {/* DraggableDialog 的可拖拽容器 */}
      <div className="flex flex-col w-full h-full p-4 gap-4">
        <h2 className="text-sm font-bold">edit your function for ur tool here, support Javascript only right now, more coming soon</h2>

        {/* 将原先 <Textarea> 换成 <Editor> */}
        <div className="flex-grow" style={{ minHeight: 0 }}>
          <Editor
            height="100%"
            defaultLanguage="javascript" 
            value={tempScript}
            theme="vs-dark"
            onChange={(value: string | undefined) => {
                if (value !== undefined) {
                  setTempScript(value);}
                }}
            options={{
              // 一些可选配置
              wordWrap: "on",
              minimap: { enabled: false },
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            discard
          </Button>
          <Button onClick={handleSave}>
            save
          </Button>
          <Button onClick={handleUpload} variant="destructive">
            upload
          </Button>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default ScriptEditorDialog;
