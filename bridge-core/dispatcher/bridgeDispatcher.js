'use strict';

/*
 * bridge-core/dispatcher/bridgeDispatcher.js
 *
 * Bridge Dispatcher：JSBridge 的中枢。只做四件事——
 *   1. 协议校验      validateBridgeRequest
 *   2. 能力查找      registry.get(action)
 *   3. 调用能力      ability.handle(params, request)
 *   4. 包装统一响应  createSuccessResponse / createErrorResponse
 *
 * 这里不允许写任何具体业务逻辑（见 docs/04-dispatch-flow.md）。
 */
(function (global) {
  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});

  function dispatchBridgeRequest(request, registry) {
    var ERROR_CODE = BridgeCore.ERROR_CODE;
    var ERROR_MESSAGE = BridgeCore.ERROR_MESSAGE;

    // 1. 协议校验失败 -> 400 PARAM_ERROR
    var check = BridgeCore.validateBridgeRequest(request);
    if (!check.valid) {
      return BridgeCore.createErrorResponse(request, ERROR_CODE.PARAM_ERROR, ERROR_MESSAGE.PARAM_ERROR, {
        reason: check.reason
      });
    }

    // 2. 能力查找失败 -> 404 UNKNOWN_ACTION
    var ability = registry ? registry.get(request.action) : undefined;
    if (!ability || typeof ability.handle !== 'function') {
      return BridgeCore.createErrorResponse(request, ERROR_CODE.UNKNOWN_ACTION, ERROR_MESSAGE.UNKNOWN_ACTION, null);
    }

    // 3. 调用能力 + 4. 包装响应
    try {
      var result = ability.handle(request.params, request);
      // ability 主动返回的「错误信封」-> 按其 code/msg 包装成统一错误响应
      if (result && result.__bridgeError) {
        return BridgeCore.createErrorResponse(request, result.code, result.msg, result.data);
      }
      return BridgeCore.createSuccessResponse(request, result);
    } catch (err) {
      // ability 抛异常 -> 统一 500 INTERNAL_ERROR
      return BridgeCore.createErrorResponse(request, ERROR_CODE.INTERNAL_ERROR, ERROR_MESSAGE.INTERNAL_ERROR, {
        reason: String(err && err.message ? err.message : err)
      });
    }
  }

  BridgeCore.dispatchBridgeRequest = dispatchBridgeRequest;
})(typeof window !== 'undefined' ? window : globalThis);
