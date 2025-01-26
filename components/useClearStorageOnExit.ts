// useClearStorageOnExit.ts
import { useEffect } from "react";

export function useClearStorageOnExit() {
  useEffect(() => {
    const handleUnload = () => {
      // 1) 清空 localStorage
      window.localStorage.clear();

      // 2) 清空 sessionStorage (如果有用到)
      window.sessionStorage.clear();

      // 3) 清空 IndexedDB => 可以简单暴力地删除整个数据库
      //    或者你也可以调用 storage 的 setLarge / getLarge 里的 openDB 做自定义
      const dbName = "aide-store";
      const deleteReq = indexedDB.deleteDatabase(dbName);
      deleteReq.onerror = () => {
        console.error(`Failed to delete IndexedDB "${dbName}".`);
      };
      deleteReq.onsuccess = () => {
        console.log(`IndexedDB "${dbName}" deleted successfully.`);
      };
    };

    // 当窗口/标签页卸载或刷新时执行
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);
}
