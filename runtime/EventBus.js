'use strict';

/*
 * runtime/EventBus.js
 *
 * 极简事件总线：用普通对象按事件名存 handler 数组。
 * 暴露：window.RuntimeEventBus.createEventBus() -> busInstance
 *
 * 约定事件名（先做契约，不强制校验）：
 *   runtime:started       runtime 启动
 *   runtime:stopped       runtime 停止
 *   request:created       Runtime.createRequest 后
 *   request:finished      dispatch 成功（code === 0）
 *   request:error         dispatch 失败（code !== 0）
 *   ability:registered    注册一个新 ability
 */
(function (global) {
  function createEventBus() {
    var handlers = Object.create(null);

    function on(name, handler) {
      if (typeof handler !== 'function') return;
      (handlers[name] || (handlers[name] = [])).push(handler);
    }

    function off(name, handler) {
      var list = handlers[name];
      if (!list) return;
      var i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    }

    function emit(name, payload) {
      var list = handlers[name];
      if (!list || !list.length) return;
      // 复制一份再遍历，避免 handler 在回调中 off 自己时漏触发
      list.slice().forEach(function (h) {
        try { h(payload); } catch (e) { /* 单个 handler 抛错不影响其它 */ }
      });
    }

    function clear() {
      handlers = Object.create(null);
    }

    return { on: on, off: off, emit: emit, clear: clear };
  }

  global.RuntimeEventBus = { createEventBus: createEventBus };
})(typeof window !== 'undefined' ? window : globalThis);
