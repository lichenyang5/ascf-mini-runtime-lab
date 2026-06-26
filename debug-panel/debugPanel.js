'use strict';

/*
 * debug-panel/debugPanel.js
 *
 * Debug Panel：旁路观测层（不参与主链路业务分发）。
 * 负责记录每次调用、统计成功/失败、展示已注册 action、提供复制 request/response。
 *
 * 暴露全局 window.DebugPanel，方法：
 *   init(options)              初始化容器 id 并首渲染
 *   record(entry)              记录一条调用日志并刷新
 *   clear()                    清空日志（统计随之归零）
 *   getLogs()                  返回当前日志数组副本
 *   render()                   重渲染：日志列表 + 统计 + 已注册 action
 *   setRegisteredActions(arr)  保存并展示当前已注册 action 列表
 */
(function (global) {
  var state = {
    logs: [],
    registeredActions: [],
    logContainerId: 'debug-log',
    statsContainerId: 'debug-stats',
    actionsContainerId: 'registered-actions'
  };

  function init(options) {
    options = options || {};
    if (options.logContainerId) state.logContainerId = options.logContainerId;
    if (options.statsContainerId) state.statsContainerId = options.statsContainerId;
    if (options.actionsContainerId) state.actionsContainerId = options.actionsContainerId;
    render();
  }

  function record(entry) {
    state.logs.push(entry);
    render();
    return entry;
  }

  function clear() {
    state.logs = [];
    render();
  }

  function getLogs() {
    return state.logs.slice();
  }

  function setRegisteredActions(actions) {
    state.registeredActions = Array.isArray(actions) ? actions.slice() : [];
    render();
  }

  function render() {
    renderStats();
    renderActions();
    renderLogs();
  }

  /* ---------- 渲染：统计 ---------- */
  function renderStats() {
    var el = byId(state.statsContainerId);
    if (!el) return;
    var total = state.logs.length;
    var success = 0;
    var lastError = null;
    for (var i = 0; i < state.logs.length; i++) {
      if (state.logs[i].code === 0) success++;
      else lastError = state.logs[i];
    }
    var fail = total - success;

    el.innerHTML = '';
    el.appendChild(metricCard('总调用', total, ''));
    el.appendChild(metricCard('成功', success, 'ok'));
    el.appendChild(metricCard('失败', fail, fail > 0 ? 'error' : ''));
    // 最近一次错误：无错误时显示「暂无错误」；有错误时同时展示 action + code + msg
    if (lastError) {
      el.appendChild(metricCard(
        lastError.action + ' · ' + lastError.code,
        lastError.msg,
        'error'
      ));
    } else {
      el.appendChild(metricCard('最近错误', '暂无错误', ''));
    }
  }

  function metricCard(label, value, tone) {
    var card = el('div', 'metric' + (tone ? ' metric-' + tone : ''));
    card.appendChild(elText('div', 'metric-value', String(value)));
    card.appendChild(elText('div', 'metric-label', label));
    return card;
  }

  /* ---------- 渲染：已注册 action ---------- */
  function renderActions() {
    var box = byId(state.actionsContainerId);
    if (!box) return;
    box.innerHTML = '';
    if (!state.registeredActions.length) {
      box.appendChild(elText('span', 'empty-hint', '（暂无注册能力）'));
      return;
    }
    state.registeredActions.forEach(function (action) {
      box.appendChild(elText('span', 'chip', action));
    });
  }

  /* ---------- 渲染：日志列表 ---------- */
  function renderLogs() {
    var box = byId(state.logContainerId);
    if (!box) return;
    box.innerHTML = '';
    if (!state.logs.length) {
      box.appendChild(elText('p', 'empty-hint',
        '暂无调用记录。每次调用会在这里追加一条 request / response / duration / code。'));
      return;
    }
    // 最新的记录放最上面
    for (var i = state.logs.length - 1; i >= 0; i--) {
      box.appendChild(buildLogItem(state.logs[i]));
    }
  }

  function buildLogItem(entry) {
    var ok = entry.code === 0;
    var item = el('div', 'log-item ' + (ok ? 'log-ok' : 'log-error'));

    // 头部：id / action / code+msg / duration / timestamp（全部用 textContent，避免注入）
    var head = el('div', 'log-head');
    head.appendChild(elText('span', 'log-id', entry.id));
    head.appendChild(elText('span', 'log-action', entry.action));
    head.appendChild(elText('span', 'log-pill ' + (ok ? 'pill-ok' : 'pill-error'), entry.code + ' ' + entry.msg));
    head.appendChild(elText('span', 'log-duration', entry.duration + ' ms'));
    head.appendChild(elText('span', 'log-time', formatTime(entry.timestamp)));

    // 操作：复制 request / response
    var actions = el('div', 'log-actions');
    actions.appendChild(copyButton('复制 request', function () { return formatJson(entry.request); }));
    actions.appendChild(copyButton('复制 response', function () { return formatJson(entry.response); }));

    // 主体：request / response JSON
    var body = elText('pre', 'log-json',
      'request:\n' + formatJson(entry.request) + '\n\nresponse:\n' + formatJson(entry.response));

    item.appendChild(head);
    item.appendChild(actions);
    item.appendChild(body);
    return item;
  }

  /* ---------- 复制：navigator.clipboard 优先，textarea + execCommand 兜底 ---------- */
  function copyButton(label, getText) {
    var btn = el('button', 'btn btn-ghost btn-xs');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', function () {
      copyText(getText(), function (okCopy) {
        btn.textContent = okCopy ? '已复制 ✓' : '复制失败';
        setTimeout(function () { btn.textContent = label; }, 1200);
      });
    });
    return btn;
  }

  function copyText(text, done) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
        return;
      }
    } catch (e) { /* 落到兜底 */ }
    fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var okCopy = document.execCommand('copy');
      document.body.removeChild(ta);
      done(!!okCopy);
    } catch (e) {
      done(false); // 复制失败也不让页面崩溃
    }
  }

  /* ---------- 小工具 ---------- */
  function byId(id) { return (typeof document !== 'undefined') ? document.getElementById(id) : null; }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function elText(tag, cls, text) { var e = el(tag, cls); e.textContent = text; return e; }
  function formatJson(v) { return JSON.stringify(v, null, 2); }
  function formatTime(ts) {
    var d = new Date(typeof ts === 'number' ? ts : Date.now());
    function p(n, w) { return String(n).padStart(w || 2, '0'); }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
  }

  global.DebugPanel = {
    init: init,
    record: record,
    clear: clear,
    getLogs: getLogs,
    render: render,
    setRegisteredActions: setRegisteredActions
  };
})(typeof window !== 'undefined' ? window : globalThis);
