'use strict';

/*
 * bridge-core/protocol/bridgeProtocol.js
 *
 * Bridge Protocol：定义并校验 request / response 的统一结构。
 * 它是 H5 与 Native 之间的「契约」，不关心任何具体能力。
 *
 * 对外提供：
 *   - validateBridgeRequest(request)         校验请求结构
 *   - createSuccessResponse(request, data)    包装成功响应
 *   - createErrorResponse(request, code, msg, data)  包装错误响应
 *   - abilityError(code, msg, data)           供 ability「返回错误语义」用的信封
 */
(function (global) {
  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});

  // 校验 H5 传来的 request 是否合法。
  // 返回 { valid: true } 或 { valid: false, reason }；不直接抛错，由 dispatcher 决定如何包装。
  function validateBridgeRequest(request) {
    if (!request || typeof request !== 'object') {
      return { valid: false, reason: 'request is required' };
    }
    if (!request.id) {
      return { valid: false, reason: 'request.id is required' };
    }
    if (!request.version) {
      return { valid: false, reason: 'request.version is required' };
    }
    if (!request.action) {
      return { valid: false, reason: 'request.action is required' };
    }
    // params 可以为空，但必须默认成对象
    if (request.params === undefined || request.params === null) {
      request.params = {};
    } else if (typeof request.params !== 'object') {
      return { valid: false, reason: 'request.params must be an object' };
    }
    return { valid: true };
  }

  // 统一成功响应：{ id, action, code: 0, msg: "success", data }
  function createSuccessResponse(request, data) {
    return {
      id: request.id,
      action: request.action,
      code: BridgeCore.ERROR_CODE.SUCCESS,
      msg: BridgeCore.ERROR_MESSAGE.SUCCESS,
      data: data === undefined ? null : data
    };
  }

  // 统一错误响应：{ id, action, code, msg, data }
  function createErrorResponse(request, code, msg, data) {
    return {
      id: request ? request.id : undefined,
      action: request ? request.action : undefined,
      code: code,
      msg: msg,
      data: data === undefined ? null : data
    };
  }

  // ability 想表达「业务级错误」（如 PARAM_ERROR）时返回此信封，
  // dispatcher 识别 __bridgeError 后用 createErrorResponse 统一包装。
  function abilityError(code, msg, data) {
    return { __bridgeError: true, code: code, msg: msg, data: data === undefined ? null : data };
  }

  BridgeCore.validateBridgeRequest = validateBridgeRequest;
  BridgeCore.createSuccessResponse = createSuccessResponse;
  BridgeCore.createErrorResponse = createErrorResponse;
  BridgeCore.abilityError = abilityError;
})(typeof window !== 'undefined' ? window : globalThis);
