'use strict';

/*
 * ability-plugins/toast/toastAbility.js
 *
 * toast.show 能力：展示一段文案。
 * - message 存在 -> 返回 { shown, message }，由 dispatcher 包装成 success
 * - message 缺失 -> 返回 PARAM_ERROR「错误信封」（abilityError），由 dispatcher 包装成 400
 *
 * 注意：ability 只关心自己的业务，不负责拼最终 response，也不依赖 dispatcher。
 */
(function (global) {
  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});
  var AbilityPlugins = global.AbilityPlugins || (global.AbilityPlugins = {});

  var toastAbility = {
    action: 'toast.show',
    handle: function (params) {
      var message = params && params.message;
      if (!message) {
        // 返回 PARAM_ERROR 语义的错误信封（也可以选择 throw，但那样会被统一成 500）
        return BridgeCore.abilityError(
          BridgeCore.ERROR_CODE.PARAM_ERROR,
          BridgeCore.ERROR_MESSAGE.PARAM_ERROR,
          { reason: 'params.message is required' }
        );
      }
      return { shown: true, message: message };
    }
  };

  AbilityPlugins.toastAbility = toastAbility;
})(typeof window !== 'undefined' ? window : globalThis);
