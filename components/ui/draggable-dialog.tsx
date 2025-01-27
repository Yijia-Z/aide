"use client";

import React, { useEffect, useRef, useState, ReactNode } from "react";
import {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
  // DialogDescription,
} from "@/components/ui/dialog";

interface DraggableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * 无蒙层 + 只在头部可拖拽 + 八方向可拉伸，
 * 缺省高度缩小(仅150px)，背景换成蓝色，
 * 这样就不会太大、也有更明显颜色。
 */
export function DraggableDialog({
  open,
  onOpenChange,
  children,
}: DraggableDialogProps) {
  // 默认对话框位置 (left=200, top=100)，默认大小(宽400, 高150)
  // 你可以根据需要进一步调整
  const [position, setPosition] = useState({ x: 500, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 600 });

  const dialogRef = useRef<HTMLDivElement>(null);

  // 如果你想在关闭时保留当前大小/位置，就不要在 useEffect 时重置
  useEffect(() => {
    if (!open) {
      // 如果你想“每次打开都回到初始大小/位置”，可以在这里 reset
      // setPosition({ x: 200, y: 100 });
      // setSize({ width: 400, height: 150 });
    }
  }, [open]);

  // 仅头部区域可拖拽
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

  // “八方向” 拖拽拉伸
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

      // 这里改最小高度 => 100, 你可以再小点
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

      // 你也可以加更大限制
      // if(newW>800) ...
      // if(newH>600)...

      // 不让它跑到屏幕外
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
    // modal={false} => 去掉蒙层、不会挡住背后的内容
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPortal>
        {/* 不渲染 Overlay => 无半透明遮罩 */}
        {/* <DialogOverlay className="hidden" /> */}

        <DialogContent
          ref={dialogRef}
          onPointerDownOutside={(e) => e.preventDefault()} // 禁止点外部关闭
          onInteractOutside={(e) => {
            e.preventDefault(); // 阻止默认行为 => 不要自动 close
          }}
          className={`
            data-[state=open]:animate-in data-[state=closed]:animate-out
            border border-border
            z-[9999]
            // 这里改成你想要的蓝色 + 白字：
            bg-blue-800 text-white
            // 也可写 bg-blue-600, 依你喜好
            rounded-md flex flex-col
            overflow-hidden shadow-lg
          `}
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
          }}
        >
          {/* 头部 => 只在此区域可拖拽 */}
          <DialogHeader
            className="cursor-move border-b border-border p-1 h-8 flex items-center"
            onMouseDown={handleHeaderMouseDown}
          >
            {/* 如果你想要最小化头部空间，可不写 Title/Description */}
            <DialogTitle className="text-sm font-semibold leading-tight">
              Create New Tool
            </DialogTitle>
          </DialogHeader>

          {/* 内容区 => 你的 children，会更小 */}
          <div className="p-2 flex-grow overflow-auto">
            {children}
          </div>

          {/* 底部 => Save + Close 按钮 */}
          <div className="p-2 border-t border-border flex justify-end gap-2">
            {/* 你想要一个 Save 按钮 */}
            <button
              onClick={() => {
                // 这里写你要保存的逻辑
                alert("You clicked Save!");
              }}
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

          {/* 8个拉伸 handle (四边+四角) */}
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
