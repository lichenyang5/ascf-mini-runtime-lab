'use strict';

/*
 * ability-plugins/device/deviceAbility.js
 *
 * device.info 能力：返回 mock 设备信息。
 * 纯 mock，不读取任何真实设备数据。
 */
(function (global) {
  var AbilityPlugins = global.AbilityPlugins || (global.AbilityPlugins = {});

  var deviceAbility = {
    action: 'device.info',
    handle: function () {
      return {
        platform: 'HarmonyOS Mock',
        model: 'Mini Runtime Device',
        osVersion: '1.0.0'
      };
    }
  };

  AbilityPlugins.deviceAbility = deviceAbility;
})(typeof window !== 'undefined' ? window : globalThis);
