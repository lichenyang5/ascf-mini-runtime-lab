'use strict';

/*
 * ability-plugins/storage/storageAbility.js
 *
 * 两个能力：storage.set / storage.get（一个文件可提供多个 ability，这里导出数组）。
 * 用浏览器 localStorage 作为 Native Storage Mock；localStorage 不可用时退回内存，保证不报错。
 */
(function (global) {
  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});
  var AbilityPlugins = global.AbilityPlugins || (global.AbilityPlugins = {});

  // 选一个可用的存储后端：优先 localStorage（file:// 下可能被拒），否则退回内存
  var store = (function () {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var probe = '__ascf_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return {
          get: function (k) { return localStorage.getItem(k); },
          set: function (k, v) { localStorage.setItem(k, v); }
        };
      }
    } catch (e) { /* 落到内存实现 */ }
    var mem = {};
    return {
      get: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set: function (k, v) { mem[k] = v; }
    };
  })();

  function paramError(reason) {
    return BridgeCore.abilityError(
      BridgeCore.ERROR_CODE.PARAM_ERROR,
      BridgeCore.ERROR_MESSAGE.PARAM_ERROR,
      { reason: reason }
    );
  }

  var storageSetAbility = {
    action: 'storage.set',
    handle: function (params) {
      params = params || {};
      if (!params.key) return paramError('params.key is required');
      if (params.value === undefined || params.value === null) return paramError('params.value is required');
      store.set(params.key, String(params.value));
      return { saved: true, key: params.key };
    }
  };

  var storageGetAbility = {
    action: 'storage.get',
    handle: function (params) {
      params = params || {};
      if (!params.key) return paramError('params.key is required');
      var value = store.get(params.key);
      // key 不存在时 code 仍为 0，但 data.value = null
      return { key: params.key, value: value === undefined ? null : value };
    }
  };

  // 一个文件导出多个 ability：用数组，交给 h5-demo/bridge.js 统一注册
  AbilityPlugins.storageAbilities = [storageSetAbility, storageGetAbility];
})(typeof window !== 'undefined' ? window : globalThis);
