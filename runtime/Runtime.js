'use strict';

/*
 * runtime/Runtime.js
 *
 * Mini Runtime 的统一入口。把 Registry / Dispatcher / DebugPanel / State / EventBus
 * 组装成一个有清晰对外 API 的 Runtime 对象，让 h5-demo/bridge.js 退回到「H5 Demo 组装层」。
 *
 * 暴露：window.MiniRuntime.createRuntime(options) -> runtimeInstance
 *
 * options:
 *   protocolVersion  string  请求协议版本，默认 "1.0.0"
 *   bridgeCore       object  桥接核心命名空间（默认取 window.BridgeCore）
 *   debugPanel       object  观测层（默认取 window.DebugPanel）
 *
 * 流程：
 *   bridge.js
 *     -> runtime.registerAbilities([...])
 *     -> runtime.start()
 *     -> runtime.call(action, params)  ->  { request, response }
 *           内部：createRequest -> dispatch -> DebugPanel.record -> emit
 */
(function (global) {

  function createRuntime(options) {
    options = options || {};
    var bridgeCore = options.bridgeCore || global.BridgeCore;
    var debugPanel = options.debugPanel || global.DebugPanel;
    var protocolVersion = options.protocolVersion || '1.0.0';

    if (!bridgeCore || !bridgeCore.AbilityRegistry || !bridgeCore.dispatchBridgeRequest) {
      throw new Error('[MiniRuntime] BridgeCore not available');
    }

    var state = global.RuntimeState.createRuntimeState({ version: protocolVersion });
    var events = global.RuntimeEventBus.createEventBus();
    var registry = new bridgeCore.AbilityRegistry();
    // EventBus 上的旁路观测者，按 action 维度统计调用情况；不参与主链路分发
    var abilityMonitor = global.AbilityMonitor
      ? global.AbilityMonitor.createAbilityMonitor()
      : null;

    var requestSeq = 0;
    function generateRequestId() {
      requestSeq += 1;
      return 'req_' + String(requestSeq).padStart(3, '0');
    }

    /* ---- 能力注册 ---- */

    // 递归扁平化输入，跳过 null / undefined（spec：某个 ability 文件缺失不应连累全局）
    function flatten(items, out) {
      out = out || [];
      if (items == null) return out;
      if (Array.isArray(items)) {
        for (var i = 0; i < items.length; i++) flatten(items[i], out);
      } else {
        out.push(items);
      }
      return out;
    }

    function registerAbility(ability) {
      if (!ability || !ability.action) return false;
      registry.register(ability.action, ability);
      state.setAbilityCount(registry.listActions().length);
      events.emit('ability:registered', { action: ability.action });
      return true;
    }

    function registerAbilities(items) {
      flatten(items).forEach(registerAbility);
    }

    /* ---- 请求构造 ---- */

    function createRequest(action, params) {
      var request = {
        id: generateRequestId(),
        version: protocolVersion,
        action: action,
        params: params || {},
        timestamp: Date.now()
      };
      events.emit('request:created', request);
      return request;
    }

    /* ---- 调度（Promise 化，保留 mock 延迟以模拟 H5↔Native 异步往返）---- */

    function nowMs() {
      return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    function dispatch(request) {
      var startedAt = nowMs();
      return new Promise(function (resolve) {
        var mockLatency = 10 + Math.floor(Math.random() * 50);
        setTimeout(function () {
          var response = bridgeCore.dispatchBridgeRequest(request, registry);
          var duration = Math.round((nowMs() - startedAt) * 100) / 100;

          state.increaseRequestCount();

          // 组装并交给旁路观测层
          if (debugPanel && typeof debugPanel.record === 'function') {
            debugPanel.record({
              id: request.id,
              action: request.action,
              request: request,
              response: response,
              duration: duration,
              code: response.code,
              msg: response.msg,
              timestamp: Date.now()
            });
          }

          // 事件通知
          var evtPayload = { request: request, response: response, duration: duration };
          events.emit(response.code === 0 ? 'request:finished' : 'request:error', evtPayload);

          resolve(response);
        }, mockLatency);
      });
    }

    function call(action, params) {
      var request = createRequest(action, params);
      return dispatch(request).then(function (response) {
        return { request: request, response: response };
      });
    }

    /* ---- 生命周期 ---- */

    function start() {
      // 状态：已启动
      state.start();
      state.setAbilityCount(registry.listActions().length);

      // 观测层：拿到当前注册 action 列表（不写死在 HTML）
      if (debugPanel) {
        if (typeof debugPanel.init === 'function') {
          debugPanel.init({
            logContainerId: 'debug-log',
            statsContainerId: 'debug-stats',
            actionsContainerId: 'registered-actions'
          });
        }
        if (typeof debugPanel.setRegisteredActions === 'function') {
          debugPanel.setRegisteredActions(registry.listActions());
        }
      }

      // 接 AbilityMonitor 到 EventBus，并把它绑定到页面容器（首渲染 + 后续自动刷新）
      if (abilityMonitor) {
        abilityMonitor.attach(events);
        if (typeof abilityMonitor.render === 'function') {
          abilityMonitor.render('ability-monitor');
        }
      }

      events.emit('runtime:started', state.snapshot());
    }

    function stop() {
      if (abilityMonitor) abilityMonitor.detach();
      state.stop();
      events.emit('runtime:stopped', state.snapshot());
    }

    function getStateSnapshot() { return state.snapshot(); }
    function getRegistry() { return registry; }
    function getEvents() { return events; }
    function getAbilityMonitor() { return abilityMonitor; }

    return {
      // 生命周期
      start: start,
      stop: stop,
      // 能力管理
      registerAbility: registerAbility,
      registerAbilities: registerAbilities,
      // 调度
      createRequest: createRequest,
      dispatch: dispatch,
      call: call,
      // 自省（给 devtools / 文档用）
      getStateSnapshot: getStateSnapshot,
      getRegistry: getRegistry,
      getEvents: getEvents,
      getAbilityMonitor: getAbilityMonitor
    };
  }

  global.MiniRuntime = { createRuntime: createRuntime };
})(typeof window !== 'undefined' ? window : globalThis);
