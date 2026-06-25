'use strict';

/*
 * ASCF Mini Runtime Lab — h5-demo/bridge.js（组装层 / H5 Demo Layer）
 *
 * 分层（Stage 2 起）：
 *   H5 Demo Layer（本文件）
 *     -> Bridge Protocol     bridge-core/protocol/bridgeProtocol.js
 *     -> Bridge Dispatcher   bridge-core/dispatcher/bridgeDispatcher.js
 *     -> Ability Registry    bridge-core/registry/abilityRegistry.js
 *     -> Ability Plugin      ability-plugins/<toast|device|storage|network|clipboard>/...
 *     -> Unified Response    protocol.createSuccessResponse / createErrorResponse
 *
 * 本文件只负责：构造 request、组装 registry、暴露 window.ascfBridge.send、记录 Debug Log、绑定 UI。
 * 不包含任何具体能力的业务逻辑——业务都在 ability-plugins 里。
 */
(function (global) {
  // 依赖 bridge-core / ability-plugins 已先于本文件加载（见 index.html 的 script 顺序）
  var BridgeCore = global.BridgeCore;
  var AbilityPlugins = global.AbilityPlugins;

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
  // 模拟容器里 H5 -> Native -> H5 的异步往返；具体分发交给 bridge-core 的 dispatcher。
  global.ascfBridge = {
    send: function (request) {
      var startedAt = nowMs();
      return new Promise(function (resolve) {
        var mockLatency = 10 + Math.floor(Math.random() * 50); // 模拟 Native 往返耗时(mock)
        setTimeout(function () {
          var response = BridgeCore.dispatchBridgeRequest(request, registry);
          var duration = Math.round((nowMs() - startedAt) * 100) / 100;
          recordDebugLog(request, response, duration);
          resolve(response);
        }, mockLatency);
      });
    }
  };

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /* ---- 4. Debug Log ---- */
  var debugLogs = [];

  function recordDebugLog(request, response, duration) {
    var entry = {
      id: request.id,
      action: request.action,
      request: request,
      response: response,
      duration: duration,
      code: response.code,
      msg: response.msg
    };
    debugLogs.push(entry);
    renderDebugLogEntry(entry);
    return entry;
  }

  /* ---- 5. 视图层 ---- */
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

  function renderDebugLogEntry(entry) {
    var container = document.getElementById('debug-log');
    if (!container) return;

    var emptyHint = container.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();

    var ok = entry.code === BridgeCore.ERROR_CODE.SUCCESS;

    var item = document.createElement('div');
    item.className = 'log-item ' + (ok ? 'log-ok' : 'log-error');

    // head 只用程序内可控字段（id / action / code / msg / duration），不含用户输入
    var head = document.createElement('div');
    head.className = 'log-head';
    head.innerHTML =
      '<span class="log-id">' + entry.id + '</span>' +
      '<span class="log-action">' + entry.action + '</span>' +
      '<span class="log-pill ' + (ok ? 'pill-ok' : 'pill-error') + '">' + entry.code + ' ' + entry.msg + '</span>' +
      '<span class="log-duration">' + entry.duration + ' ms</span>';

    // body 用 textContent 输出，用户输入（如 message / value / text）在此展示也不会造成注入
    var body = document.createElement('pre');
    body.className = 'log-json';
    body.textContent = 'request:\n' + formatJson(entry.request) + '\n\nresponse:\n' + formatJson(entry.response);

    item.appendChild(head);
    item.appendChild(body);
    container.insertBefore(item, container.firstChild);
  }

  /* ---- 6. 入口：构造调用 + 绑定按钮 ---- */
  async function callAction(action, params) {
    var request = createRequest(action, params);
    renderRequest(request);                            // 立即展示本次 request（H5 侧发出）
    var response = await global.ascfBridge.send(request); // 等待 Native 回灌
    renderResponse(response);                          // 展示 response；Debug Log 已在 send 内追加
  }

  function bindClick(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function bindUi() {
    var messageInput = document.getElementById('toast-message');
    var storageKeyInput = document.getElementById('storage-key');
    var storageValueInput = document.getElementById('storage-value');
    var clipboardTextInput = document.getElementById('clipboard-text');

    // 基础能力
    bindClick('btn-toast', function () {
      var message = messageInput ? messageInput.value.trim() : '';
      // message 为空时故意不传，触发 toast.show 的 PARAM_ERROR 分支
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
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindUi);
    } else {
      bindUi();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
