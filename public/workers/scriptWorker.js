// public/workers/scriptWorker.js
self.onmessage = (event) => {
  const { code } = event.data;
  let result = "";
  try {
    const fn = new Function(code);
    // 如果脚本里无显式 return => 返回 undefined
    const output = fn();
    result = output !== undefined ? String(output) : "[No return value]";
  } catch (err) {
    result = "Error: " + err.message;
  }

  // 把执行结果发回主线程
  self.postMessage({ result });
};
