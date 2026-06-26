'use strict';

/*
 * runtime/AbilityMonitor.js
 *
 * 按 action 维度做调用统计：total / success / failure / 耗时 / 最近 code·msg。
 * 它是 Runtime EventBus 上的订阅者，不参与主链路分发。
 *
 * 暴露：window.AbilityMonitor.createAbilityMonitor(options) -> monitorInstance
 *
 * 监听事件：
 *   request:finished  (payload: { request, response, duration })
 *   request:error     (payload: { request, response, duration })
 *
 * 用法：
 *   var monitor = AbilityMonitor.createAbilityMonitor();
 *   monitor.attach(eventBus);                    // 自动订阅
 *   monitor.render('ability-monitor');           // 绑定容器；之后每次 record 自动刷新
 *   monitor.getStats();                          // [{ action, total, success, ... }, ...]
 */
(function (global) {
  function createAbilityMonitor(options) {
    options = options || {};
    var statsMap = Object.create(null);    // action -> stats 对象
    var sumDuration = Object.create(null); // action -> 累计耗时（用于算 avgDuration）
    var eventBus = null;
    var handlers = null;
    var currentContainerId = options.containerId || null;

    function ensure(action) {
      if (!statsMap[action]) {
        statsMap[action] = {
          action: action,
          total: 0,
          success: 0,
          failure: 0,
          avgDuration: 0,
          maxDuration: 0,
          lastCode: null,
          lastMsg: null,
          lastCalledAt: null
        };
        sumDuration[action] = 0;
      }
      return statsMap[action];
    }

    /* ---- 记录 ---- */
    function record(payload) {
      if (!payload || !payload.request || !payload.response) return;
      var action = payload.request.action;
      if (!action) return;

      var s = ensure(action);
      var code = payload.response.code;
      var msg = payload.response.msg;
      var duration = typeof payload.duration === 'number' ? payload.duration : 0;

      s.total += 1;
      if (code === 0) s.success += 1; else s.failure += 1;
      sumDuration[action] += duration;
      s.avgDuration = round2(sumDuration[action] / s.total);
      if (duration > s.maxDuration) s.maxDuration = round2(duration);
      s.lastCode = code;
      s.lastMsg = msg;
      s.lastCalledAt = Date.now();

      autoRender();
    }

    function round2(n) { return Math.round(n * 100) / 100; }

    /* ---- 事件订阅 ---- */
    function attach(eb) {
      if (!eb || typeof eb.on !== 'function') return;
      detach(); // 防重复订阅
      eventBus = eb;
      // 单一处理函数：finished / error 走同一份 record 逻辑
      var onAny = function (payload) { record(payload); };
      handlers = { finished: onAny, error: onAny };
      eb.on('request:finished', handlers.finished);
      eb.on('request:error', handlers.error);
    }

    function detach() {
      if (eventBus && handlers) {
        eventBus.off('request:finished', handlers.finished);
        eventBus.off('request:error', handlers.error);
      }
      eventBus = null;
      handlers = null;
    }

    /* ---- 读取 ---- */
    function snapshotOne(s) {
      var copy = {};
      for (var k in s) {
        if (Object.prototype.hasOwnProperty.call(s, k)) copy[k] = s[k];
      }
      return copy;
    }

    function getStats() {
      var arr = [];
      for (var k in statsMap) {
        if (Object.prototype.hasOwnProperty.call(statsMap, k)) arr.push(snapshotOne(statsMap[k]));
      }
      return arr;
    }

    function getStatsByAction(action) {
      return statsMap[action] ? snapshotOne(statsMap[action]) : null;
    }

    function reset() {
      statsMap = Object.create(null);
      sumDuration = Object.create(null);
      autoRender();
    }

    /* ---- 渲染：简单表格 ---- */
    function render(containerId) {
      if (containerId) currentContainerId = containerId;
      if (!currentContainerId || typeof document === 'undefined') return;
      var el = document.getElementById(currentContainerId);
      if (!el) return;

      var stats = getStats();
      if (!stats.length) {
        el.innerHTML = '';
        var hint = document.createElement('p');
        hint.className = 'empty-hint';
        hint.textContent = '暂无能力调用统计。';
        el.appendChild(hint);
        return;
      }

      // 按 total 降序
      stats.sort(function (a, b) { return b.total - a.total; });

      el.innerHTML = '';
      var table = document.createElement('table');
      table.className = 'ability-monitor-table';

      var thead = document.createElement('thead');
      var trh = document.createElement('tr');
      ['action', 'total', 'success', 'failure', 'avg ms', 'max ms', 'last code', 'last msg']
        .forEach(function (label) {
          var th = document.createElement('th');
          th.textContent = label;
          trh.appendChild(th);
        });
      thead.appendChild(trh);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      stats.forEach(function (s) {
        var tr = document.createElement('tr');
        if (s.failure > 0) tr.className = 'row-has-failure';
        appendCell(tr, s.action, 'mono');
        appendCell(tr, String(s.total));
        appendCell(tr, String(s.success), 'num-ok');
        appendCell(tr, String(s.failure), s.failure > 0 ? 'num-error' : 'num-muted');
        appendCell(tr, String(s.avgDuration));
        appendCell(tr, String(s.maxDuration));
        appendCell(tr, s.lastCode === null ? '-' : String(s.lastCode), 'mono');
        appendCell(tr, s.lastMsg === null ? '-' : String(s.lastMsg), 'mono');
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      el.appendChild(table);
    }

    function appendCell(tr, text, cls) {
      var td = document.createElement('td');
      if (cls) td.className = cls;
      td.textContent = text; // 一律 textContent，杜绝注入
      tr.appendChild(td);
    }

    function autoRender() { if (currentContainerId) render(); }

    return {
      attach: attach,
      detach: detach,
      record: record,
      getStats: getStats,
      getStatsByAction: getStatsByAction,
      reset: reset,
      render: render
    };
  }

  global.AbilityMonitor = { createAbilityMonitor: createAbilityMonitor };
})(typeof window !== 'undefined' ? window : globalThis);
