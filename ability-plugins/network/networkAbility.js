'use strict';

/*
 * ability-plugins/network/networkAbility.js
 *
 * network.status：返回 mock 网络状态。不发起任何真实网络请求。
 */
(function (global) {
  var AbilityPlugins = global.AbilityPlugins || (global.AbilityPlugins = {});

  var networkAbility = {
    action: 'network.status',
    handle: function () {
      return { online: true, type: 'wifi', rtt: 32 };
    }
  };

  AbilityPlugins.networkAbility = networkAbility;
})(typeof window !== 'undefined' ? window : globalThis);
