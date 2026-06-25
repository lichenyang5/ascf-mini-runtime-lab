'use strict';

/*
 * ability-plugins/clipboard/clipboardAbility.js
 *
 * clipboard.write：把文本写入剪贴板。
 * - params.text 缺失 -> 400 PARAM_ERROR
 * - 优先用 navigator.clipboard.writeText（异步，fire-and-forget，不阻塞同步分发）
 * - 不支持 clipboard API（如 file:// 非安全上下文）时返回 mock success（data.mock = true），不让页面报错
 */
(function (global) {
  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});
  var AbilityPlugins = global.AbilityPlugins || (global.AbilityPlugins = {});

  var clipboardAbility = {
    action: 'clipboard.write',
    handle: function (params) {
      var text = params && params.text;
      if (!text) {
        return BridgeCore.abilityError(
          BridgeCore.ERROR_CODE.PARAM_ERROR,
          BridgeCore.ERROR_MESSAGE.PARAM_ERROR,
          { reason: 'params.text is required' }
        );
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          // 真实 API 是异步的；这里 fire-and-forget，并吞掉可能的拒绝（非安全上下文会被拒）
          navigator.clipboard.writeText(text).catch(function () {});
          return { copied: true, text: text };
        }
      } catch (e) { /* 落到下面的 mock 分支 */ }
      // 不支持 clipboard API：返回 mock success，避免页面报错
      return { copied: true, text: text, mock: true };
    }
  };

  AbilityPlugins.clipboardAbility = clipboardAbility;
})(typeof window !== 'undefined' ? window : globalThis);
