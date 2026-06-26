'use strict';

/*
 * ASCF Mini Runtime Lab — h5-demo/bridge.js（H5 Demo 组装层）
 *
 * 自 Stage 5.1 起，所有"装配 + 调度 + 调试记录 + 事件"都搬到了 runtime/Runtime.js。
 * 本文件只剩 H5 Demo 自己的事：
 *   1. 创建 runtime、把 ability 数组喂进去、启动 runtime
 *   2. 暴露 window.ascfBridge.send（薄薄一层，转交 runtime.dispatch）
 *   3. 读取输入框、绑定按钮、调用 runtime.call(action, params)
 *   4. 展示本次 Request / Response（Debug Log/Stats/Actions 由 DebugPanel 自渲染）
 *
 * 不再做：new AbilityRegistry、registerAll、维护 debugLogs、renderLog 等。
 */
(function (global) {
  var BridgeCore = global.BridgeCore;
  var AbilityPlugins = global.AbilityPlugins;
  var DebugPanel = global.DebugPanel;
  var MiniRuntime = global.MiniRuntime;

  /* ---- 1. 创建并启动 runtime ---- */
  var runtime = MiniRuntime.createRuntime({
    protocolVersion: '1.0.0',
    bridgeCore: BridgeCore,
    debugPanel: DebugPanel
  });

  runtime.registerAbilities([
    AbilityPlugins.toastAbility,        // toast.show
    AbilityPlugins.deviceAbility,       // device.info
    AbilityPlugins.storageAbilities,    // storage.set + storage.get（数组）
    AbilityPlugins.networkAbility,      // network.status
    AbilityPlugins.clipboardAbility     // clipboard.write
  ]);

  /* ---- 2. 暴露 window.ascfBridge.send（保持对外接口不变）---- */
  global.ascfBridge = {
    send: function (request) {
      return runtime.dispatch(request);
    }
  };

  /* ---- 3. 仅 H5 Demo 自己的展示：当前 Request / Response ---- */
  function formatJson(v) { return JSON.stringify(v, null, 2); }
  function renderRequest(request) {
    var el = document.getElementById('request-view');
    if (el) el.textContent = formatJson(request);
  }
  function renderResponse(response) {
    var el = document.getElementById('response-view');
    if (el) el.textContent = formatJson(response);
  }

  /* ---- 4. 入口：构造调用 + 绑定按钮 ---- */
  async function callAction(action, params) {
    var result = await runtime.call(action, params);
    renderRequest(result.request);
    renderResponse(result.response);
  }

  function bindClick(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function bindUi() {
    runtime.start();

    var messageInput = document.getElementById('toast-message');
    var storageKeyInput = document.getElementById('storage-key');
    var storageValueInput = document.getElementById('storage-value');
    var clipboardTextInput = document.getElementById('clipboard-text');

    // 基础能力
    bindClick('btn-toast', function () {
      var message = messageInput ? messageInput.value.trim() : '';
      callAction('toast.show', message ? { message: message } : {});
    });
    bindClick('btn-device', function () { callAction('device.info', {}); });

    // 存储能力
    bindClick('btn-storage-set', function () {
      callAction('storage.set', {
        key: storageKeyInput ? storageKeyInput.value.trim() : '',
        value: storageValueInput ? storageValueInput.value : ''
      });
    });
    bindClick('btn-storage-get', function () {
      callAction('storage.get', { key: storageKeyInput ? storageKeyInput.value.trim() : '' });
    });

    // 系统能力 Mock
    bindClick('btn-network', function () { callAction('network.status', {}); });
    bindClick('btn-clipboard', function () {
      callAction('clipboard.write', { text: clipboardTextInput ? clipboardTextInput.value : '' });
    });

    // 错误场景
    bindClick('btn-unknown', function () { callAction('unknown.action', {}); });
    bindClick('btn-param-error', function () {
      callAction('storage.set', { key: (storageKeyInput && storageKeyInput.value.trim()) || 'username' });
    });

    // 清空 Debug Log（DebugPanel 自己维护统计）
    bindClick('btn-clear-log', function () { if (DebugPanel) DebugPanel.clear(); });
  }

  /* ---- 5. 调试入口（控制台用）---- */
  global.MiniRuntimeDevtools = {
    runtime: runtime,
    getState: function () { return runtime.getStateSnapshot(); },
    getLogs: function () { return DebugPanel ? DebugPanel.getLogs() : []; }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindUi);
    } else {
      bindUi();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
