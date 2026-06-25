'use strict';

/*
 * bridge-core/errors/bridgeErrors.js
 *
 * 统一错误码与错误消息常量。整条 JSBridge 链路只用这一套错误码，
 * 任何 ability 都不得自定义错误格式（见 docs/02-bridge-protocol.md）。
 *
 * 以经典 script 方式挂到全局 window.BridgeCore（浏览器 file:// 可直接运行，
 * 无需打包；Node 下则挂到 globalThis，方便测试）。
 */
(function (global) {
  // 统一错误码
  var ERROR_CODE = {
    SUCCESS: 0,
    PARAM_ERROR: 400,
    UNKNOWN_ACTION: 404,
    TIMEOUT: 408,
    INTERNAL_ERROR: 500
  };

  // 与错误码一一对应的默认错误消息（用于 response.msg）
  var ERROR_MESSAGE = {
    SUCCESS: 'success',
    PARAM_ERROR: 'PARAM_ERROR',
    UNKNOWN_ACTION: 'UNKNOWN_ACTION',
    TIMEOUT: 'TIMEOUT',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  };

  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});
  BridgeCore.ERROR_CODE = ERROR_CODE;
  BridgeCore.ERROR_MESSAGE = ERROR_MESSAGE;
})(typeof window !== 'undefined' ? window : globalThis);
