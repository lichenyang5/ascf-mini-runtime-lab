'use strict';

/*
 * ASCF Mini Runtime Lab — h5-demo/bridge.js（组装层 / H5 Demo Layer）
 *
 * 分层：
 *   H5 Demo Layer（本文件）
 *     -> Bridge Protocol     bridge-core/protocol/bridgeProtocol.js
 *     -> Bridge Dispatcher   bridge-core/dispatcher/bridgeDispatcher.js
 *     -> Ability Registry    bridge-core/registry/abilityRegistry.js
 *     -> Ability Plugin      ability-plugins/<...>/...
 *     -> Unified Response    protocol.createSuccessResponse / createErrorResponse
 *
 * 本文件只负责：构造 request、组装 registry、暴露 window.ascfBridge.send、
 * 展示当前 Request / Response、绑定按钮。
 *
 * 调试日志的「记录与渲染」已从本文件移出，交给旁路观测层 window.DebugPanel
 * （debug-panel/debugPanel.js）。本文件只在 send 完成后构造 entry 并 DebugPanel.record(entry)。
 */
(function (global) {
  // 依赖 bridge-core / ability-plugins / debug-panel 已先于本文件加载（见 index.html 的 script 顺序）
  var BridgeCore = global.BridgeCore;
  var AbilityPlugins = global.AbilityPlugins;
  var DebugPanel = global.DebugPanel;

  /* ---- 1. 组装：创建注册表并注册能力 ---- */
  var registry = new BridgeCore.AbilityRegistry();

  // 支持「单个 ability」或「一个文件导出的 ability 数组」（如 storage）
  function registerAll(items) {
    items.forEach(function (item) {
      if (!item) return; // 容错：某 ability 脚本未加载时跳过，不连累其他能力
      var list = Array.isArray(item) ? item : [item];
      list.forEach(function (ability) {
        if (ability && ability.action) registry.register(ability.action, ability);
      });
    });
  }

  registerAll([
    AbilityPlugins.toastAbility,        // toast.show
    AbilityPlugins.deviceAbility,       // device.info
    AbilityPlugins.storageAbilities,    // storage.set + storage.get（数组）
    AbilityPlugins.networkAbility,      // network.status
    AbilityPlugins.clipboardAbility     // clipboard.write
  ]);

  /* ---- 2. H5 侧请求构造（id / version 由 H5 负责生成）---- */
  var PROTOCOL_VERSION = '1.0.0';
  var requestSeq = 0;

  function generateRequestId() {
    requestSeq += 1;
    return 'req_' + String(requestSeq).padStart(3, '0');
  }

  function createRequest(action, params) {
    return {
      id: generateRequestId(),
      version: PROTOCOL_VERSION,
      action: action,
      params: params || {},
      timestamp: Date.now()
    };
  }

  /* ---- 3. 桥接层：window.ascfBridge.send ---- */
  // 模拟容器里 H5 -> Native -> H5 的异步往返；分发交给 bridge-core，
  // 记录交给 DebugPanel（本文件不再渲染日志）。
  global.ascfBridge = {
    send: function (request) {
      var startedAt = nowMs();
      return new Promise(function (resolve) {
        var mockLatency = 10 + Math.floor(Math.random() * 50); // 模拟 Native 往返耗时(mock)
        setTimeout(function () {
          var response = BridgeCore.dispatchBridgeRequest(request, registry);
          var duration = Math.round((nowMs() - startedAt) * 100) / 100;

          // 组装一条调试 entry，交给旁路观测层记录
          var entry = {
            id: request.id,
            action: request.action,
            request: request,
            response: response,
            duration: duration,
            code: response.code,
            msg: response.msg,
            timestamp: Date.now()
          };
          if (DebugPanel) DebugPanel.record(entry);

          resolve(response);
        }, mockLatency);
      });
    }
  };

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /* ---- 4. 当前 Request / Response 展示（仍由组装层负责）---- */
  function formatJson(value) {
    return JSON.stringify(value, null, 2);
  }

  function renderRequest(request) {
    var el = document.getElementById('request-view');
    if (el) el.textContent = formatJson(request);
  }

  function renderResponse(response) {
    var el = document.getElementById('response-view');
    if (el) el.textContent = formatJson(response);
  }

  /* ---- 5. 入口：构造调用 + 绑定按钮 ---- */
  async function callAction(action, params) {
    var request = createRequest(action, params);
    renderRequest(request);                            // 立即展示本次 request（H5 侧发出）
    var response = await global.ascfBridge.send(request); // 等待 Native 回灌（DebugPanel 已记录）
    renderResponse(response);                          // 展示本次 response
  }

  function bindClick(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function bindUi() {
    // 初始化旁路观测层，并把"当前已注册 action 列表"喂给它（不写死在 HTML）
    if (DebugPanel) {
      DebugPanel.init({
        logContainerId: 'debug-log',
        statsContainerId: 'debug-stats',
        actionsContainerId: 'registered-actions'
      });
      DebugPanel.setRegisteredActions(registry.listActions());
    }

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
      // 故意只传 key、不传 value -> storage.set 返回 400 PARAM_ERROR
      callAction('storage.set', { key: (storageKeyInput && storageKeyInput.value.trim()) || 'username' });
    });

    // 清空 Debug Log（统计随之归零）
    bindClick('btn-clear-log', function () { if (DebugPanel) DebugPanel.clear(); });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindUi);
    } else {
      bindUi();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
