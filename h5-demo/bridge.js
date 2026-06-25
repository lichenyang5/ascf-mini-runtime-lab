'use strict';

/*
 * ASCF Mini Runtime Lab — h5-demo/bridge.js
 *
 * 用纯 JavaScript 在浏览器里模拟「小程序容器 / WebView JSBridge」的最小闭环：
 *
 *   H5（页面按钮）
 *     → window.ascfBridge.send(request)              // H5 -> Native：把 request 交给"Native"
 *     → dispatchAction(request)                       // 按 action 分发到对应 Mock 能力
 *     → mockAbilities[action](request)                // Mock Native Ability 执行，产出 data
 *     → createSuccessResponse / createErrorResponse   // 统一响应协议
 *     → Promise.resolve(response)                     // Native -> H5：把 response 回灌给 H5
 *     → recordDebugLog(request, response, duration)   // 全链路记录
 *
 * 说明：
 * - 本阶段（Stage 1）刻意把所有逻辑集中在这一个文件里，先不抽 bridge-core。
 * - 这里没有任何真实系统能力，全部是 mock，仅用于理解架构。
 */

/* ============ 1. 协议层：请求 id 与 request / response 构造 ============ */

const PROTOCOL_VERSION = '1.0.0';

// 统一错误码（与 skill.md / README 保持一致）
const ERROR_CODE = {
  SUCCESS: 0,
  PARAM_ERROR: 400,
  UNKNOWN_ACTION: 404,
  TIMEOUT: 408,
  INTERNAL_ERROR: 500
};

let requestSeq = 0;

// 生成自增请求 id：req_001、req_002……同一个 id 贯穿 request 与 response，用于配对
function generateRequestId() {
  requestSeq += 1;
  return 'req_' + String(requestSeq).padStart(3, '0');
}

// 构造统一 request 结构
function createRequest(action, params) {
  return {
    id: generateRequestId(),
    version: PROTOCOL_VERSION,
    action: action,
    params: params || {},
    timestamp: Date.now()
  };
}

// 构造统一成功响应
function createSuccessResponse(request, data) {
  return {
    id: request.id,
    action: request.action,
    code: ERROR_CODE.SUCCESS,
    msg: 'success',
    data: data === undefined ? null : data
  };
}

// 构造统一错误响应（所有能力共用同一种错误结构）
function createErrorResponse(request, code, msg, data) {
  return {
    id: request.id,
    action: request.action,
    code: code,
    msg: msg,
    data: data === undefined ? null : data
  };
}

/* ============ 2. 能力层：Mock Native Abilities ============ */
// 一个极简「注册表」：action -> 能力实现，dispatchAction 据此查找。
// 本阶段直接用对象字面量，不抽独立 registry 模块。
const mockAbilities = {
  // toast.show：params.message 存在 -> success；缺失 -> 400 PARAM_ERROR
  'toast.show': function (request) {
    const message = request.params && request.params.message;
    if (!message) {
      return createErrorResponse(request, ERROR_CODE.PARAM_ERROR, 'PARAM_ERROR', {
        reason: 'params.message is required'
      });
    }
    return createSuccessResponse(request, { shown: true, message: message });
  },

  // device.info：返回 mock 设备信息（platform / model / osVersion）
  'device.info': function (request) {
    return createSuccessResponse(request, {
      platform: 'HarmonyOS',
      model: 'Mock-Device-001',
      osVersion: '5.0.0'
    });
  }
};

/* ============ 3. 分发层：根据 action 找到能力并执行 ============ */
function dispatchAction(request) {
  const ability = mockAbilities[request.action];
  // 未注册的 action -> 统一 404 UNKNOWN_ACTION
  if (typeof ability !== 'function') {
    return createErrorResponse(request, ERROR_CODE.UNKNOWN_ACTION, 'UNKNOWN_ACTION', null);
  }
  try {
    return ability(request);
  } catch (err) {
    // 能力内部异常 -> 统一 500，避免把异常直接抛回 H5
    return createErrorResponse(request, ERROR_CODE.INTERNAL_ERROR, 'INTERNAL_ERROR', {
      reason: String(err && err.message ? err.message : err)
    });
  }
}

/* ============ 4. 桥接层：window.ascfBridge.send ============ */
// 模拟真实 WebView 容器：H5 调用 send 把 request 交给 Native，
// Native 处理后异步把 response 回灌给 H5。这里用 Promise + setTimeout 模拟这次往返。
window.ascfBridge = {
  send: function (request) {
    const startedAt = nowMs();
    return new Promise(function (resolve) {
      // 模拟 Native 往返耗时（mock：10~60ms），让 duration 可见
      const mockLatency = 10 + Math.floor(Math.random() * 50);
      setTimeout(function () {
        const response = dispatchAction(request);
        const duration = Math.round((nowMs() - startedAt) * 100) / 100; // 毫秒，保留两位
        recordDebugLog(request, response, duration);
        resolve(response);
      }, mockLatency);
    });
  }
};

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

/* ============ 5. 调试层：Debug Log ============ */
const debugLogs = []; // 内存中保存所有调用记录

function recordDebugLog(request, response, duration) {
  const entry = {
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

/* ============ 6. 视图层：DOM 渲染（Stage 1 集中在本文件） ============ */

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function renderRequest(request) {
  const el = document.getElementById('request-view');
  if (el) el.textContent = formatJson(request);
}

function renderResponse(response) {
  const el = document.getElementById('response-view');
  if (el) el.textContent = formatJson(response);
}

function renderDebugLogEntry(entry) {
  const container = document.getElementById('debug-log');
  if (!container) return;

  // 首次写入时清掉「暂无记录」提示
  const emptyHint = container.querySelector('.empty-hint');
  if (emptyHint) emptyHint.remove();

  const ok = entry.code === ERROR_CODE.SUCCESS;

  const item = document.createElement('div');
  item.className = 'log-item ' + (ok ? 'log-ok' : 'log-error');

  // head 只使用程序内可控字段（id / action / code / msg / duration），不含用户输入
  const head = document.createElement('div');
  head.className = 'log-head';
  head.innerHTML =
    '<span class="log-id">' + entry.id + '</span>' +
    '<span class="log-action">' + entry.action + '</span>' +
    '<span class="log-pill ' + (ok ? 'pill-ok' : 'pill-error') + '">' + entry.code + ' ' + entry.msg + '</span>' +
    '<span class="log-duration">' + entry.duration + ' ms</span>';

  // body 用 textContent 输出，message 等用户输入在此处展示也不会造成注入
  const body = document.createElement('pre');
  body.className = 'log-json';
  body.textContent =
    'request:\n' + formatJson(entry.request) + '\n\nresponse:\n' + formatJson(entry.response);

  item.appendChild(head);
  item.appendChild(body);

  // 最新记录放最上面
  container.insertBefore(item, container.firstChild);
}

/* ============ 7. 入口：构造调用 + 绑定按钮 ============ */

// 统一调用入口：构造 request -> 展示 request -> send -> 展示 response
async function callAction(action, params) {
  const request = createRequest(action, params);
  renderRequest(request);                                  // 立即展示本次 request（H5 侧发出）
  const response = await window.ascfBridge.send(request);  // 等待 Native 回灌
  renderResponse(response);                                // 展示 response；Debug Log 已在 send 内追加
}

function bindUi() {
  const toastBtn = document.getElementById('btn-toast');
  const deviceBtn = document.getElementById('btn-device');
  const unknownBtn = document.getElementById('btn-unknown');
  const messageInput = document.getElementById('toast-message');

  if (toastBtn) {
    toastBtn.addEventListener('click', function () {
      const message = messageInput ? messageInput.value.trim() : '';
      // message 为空时故意不传 message，触发 toast.show 的 PARAM_ERROR 分支
      callAction('toast.show', message ? { message: message } : {});
    });
  }
  if (deviceBtn) {
    deviceBtn.addEventListener('click', function () {
      callAction('device.info', {});
    });
  }
  if (unknownBtn) {
    unknownBtn.addEventListener('click', function () {
      callAction('unknown.action', {});
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindUi);
} else {
  bindUi();
}
