"use client";

import React, { useEffect, useRef, useState, ReactNode } from "react";
import {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DraggableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * 可拖拽 + 可拉伸 + 无蒙层的 Dialog
 * 在打开时自动适应/居中 => 避免小屏时跑出可视区
 */
export function DraggableDialog({
  open,
  onOpenChange,
  children,
}: DraggableDialogProps) {
  const [position, setPosition] = useState({ x: 400, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 600 });

  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * 当 open=true 时，自动做“居中 + 尺寸适应”
   * 防止小屏幕时弹窗超出可视区
   */
  useEffect(() => {
    if (open) {
      // 读取当前窗口宽高
      const w = window.innerWidth;
      const h = window.innerHeight;
      console.log("[DraggableDialog] window size:", w, h);

      // 先用默认值
      let desiredWidth = 400;
      let desiredHeight = 600;

      // 如果屏幕太小，则缩小弹窗
      if (desiredWidth > w - 40) {
        desiredWidth = w - 40; // 两边留点边距
      }
      if (desiredHeight > h - 40) {
        desiredHeight = h - 40;
      }

      // 设置最终大小
      setSize({ width: desiredWidth, height: desiredHeight });
      console.log("[DraggableDialog] final size:", desiredWidth, desiredHeight);

      // 居中
      const x = Math.max(0, (w - desiredWidth) / 2);
      const y = Math.max(0, (h - desiredHeight) / 2);
      setPosition({ x, y });
      console.log("[DraggableDialog] final position:", x, y);
    }
  }, [open]);

  /**
   * 头部区域可拖拽 => onMouseDown + document.onMouseMove
   */
  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dialogRef.current) return;

    const rect = dialogRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newX = moveEvent.clientX - offsetX;
      const newY = moveEvent.clientY - offsetY;

      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  /**
   * “八方向”拖拽拉伸 => onMouseDown + document.onMouseMove
   */
  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    direction: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startW = size.width;
    const startH = size.height;
    const startL = position.x;
    const startT = position.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      let deltaX = moveEvent.clientX - startX;
      let deltaY = moveEvent.clientY - startY;

      let newW = startW;
      let newH = startH;
      let newL = startL;
      let newT = startT;

      if (direction.includes("l")) {
        newW = startW - deltaX;
        newL = startL + deltaX;
      } else if (direction.includes("r")) {
        newW = startW + deltaX;
      }

      if (direction.includes("t")) {
        newH = startH - deltaY;
        newT = startT + deltaY;
      } else if (direction.includes("b")) {
        newH = startH + deltaY;
      }

      // 限制最小宽高
      if (newW < 200) {
        newW = 200;
        if (direction.includes("l")) {
          newL = startL + (startW - 200);
        }
      }
      if (newH < 100) {
        newH = 100;
        if (direction.includes("t")) {
          newT = startT + (startH - 100);
        }
      }

      // 如果你想限制最大宽高，也可在此添加
      // if (newW > 1000) { newW = 1000 }
      // if (newH > 800) { newH = 800 }

      // 不让它超出屏幕
      const maxLeft = window.innerWidth - newW;
      const maxTop = window.innerHeight - newH;
      if (newL < 0) newL = 0;
      if (newT < 0) newT = 0;
      if (newL > maxLeft) newL = maxLeft;
      if (newT > maxTop) newT = maxTop;

      setSize({ width: newW, height: newH });
      setPosition({ x: newL, y: newT });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPortal>
        {/* 关闭点击外部自动关闭 & Overlay */}
        {/* <DialogOverlay className="hidden" /> */}

        <DialogContent
          ref={dialogRef}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="
           data-[state=open]:animate-in data-[state=closed]:animate-out
    border border-border z-[9999]
    
    bg-popover
    text-popover-foreground
    rounded-md flex flex-col
    overflow-hidden shadow-lg
          "
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
          }}
        >
          {/* 头部 => 鼠标按下可拖拽 */}
          <DialogHeader
            className="cursor-move border-b border-border p-1 h-8 flex items-center"
            onMouseDown={handleHeaderMouseDown}
          >
            <DialogTitle className="text-sm font-semibold leading-tight">
              Create New Tool
            </DialogTitle>
          </DialogHeader>

          {/* 内容区 */}
          <div className="p-2 flex-grow overflow-auto">{children}</div>

          {/* 底部按钮区 */}
          <div className="p-2 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => alert("You clicked Save!")}
              className="px-3 py-1 rounded-md bg-white text-blue-900"
            >
              Save
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1 rounded-md bg-white text-blue-900"
            >
              Close
            </button>
          </div>

          {/* 四边 + 四角 => 8个拖拽拉伸点 */}
          {/* top edge */}
          <div
            className="absolute top-0 left-0 w-full h-2 cursor-ns-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "t")}
          />
          {/* bottom edge */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "b")}
          />
          {/* left edge */}
          <div
            className="absolute top-0 left-0 h-full w-2 cursor-ew-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "l")}
          />
          {/* right edge */}
          <div
            className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "r")}
          />

          {/* corners */}
          <div
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "tl")}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "tr")}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "bl")}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "br")}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export default DraggableDialog;
