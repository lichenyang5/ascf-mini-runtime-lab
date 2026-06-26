'use strict';

/*
 * runtime/RuntimeState.js
 *
 * 运行时状态对象：只持有状态、提供小步更新方法，不做 DOM 渲染、不做能力调用。
 * 暴露：window.RuntimeState.createRuntimeState(options) -> stateInstance
 */
(function (global) {
  function createRuntimeState(options) {
    options = options || {};

    var state = {
      version: options.version || '1.0.0',
      started: false,
      debugMode: options.debugMode !== undefined ? !!options.debugMode : true,
      currentPage: options.currentPage || 'h5-demo/index.html',
      requestCount: 0,
      abilityCount: 0,
      startedAt: null,
      lastRequestAt: null
    };

    function start() {
      state.started = true;
      state.startedAt = Date.now();
    }

    function stop() {
      state.started = false;
    }

    function increaseRequestCount() {
      state.requestCount += 1;
      state.lastRequestAt = Date.now();
    }

    function setAbilityCount(count) {
      state.abilityCount = count | 0;
    }

    // 浅拷贝，避免外部直接改内部 state
    function snapshot() {
      var copy = {};
      for (var k in state) {
        if (Object.prototype.hasOwnProperty.call(state, k)) copy[k] = state[k];
      }
      return copy;
    }

    return {
      // 状态读取（一律走 snapshot，禁止直接拿引用）
      snapshot: snapshot,
      // 状态更新
      start: start,
      stop: stop,
      increaseRequestCount: increaseRequestCount,
      setAbilityCount: setAbilityCount
    };
  }

  global.RuntimeState = { createRuntimeState: createRuntimeState };
})(typeof window !== 'undefined' ? window : globalThis);
