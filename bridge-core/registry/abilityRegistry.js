'use strict';

/*
 * bridge-core/registry/abilityRegistry.js
 *
 * AbilityRegistry：action -> ability 的注册表。
 * 把「谁能处理哪个 action」从 dispatcher 里解耦出来——
 * dispatcher 只管「查表 + 调用」，不关心有哪些能力（见 docs/03-ability-registry.md）。
 */
(function (global) {
  var BridgeCore = global.BridgeCore || (global.BridgeCore = {});

  function AbilityRegistry() {
    this._abilities = new Map();
  }

  // 注册一个能力。返回 this 以支持链式调用。
  AbilityRegistry.prototype.register = function (action, ability) {
    this._abilities.set(action, ability);
    return this;
  };

  // 注销一个能力。返回是否删除成功。
  AbilityRegistry.prototype.unregister = function (action) {
    return this._abilities.delete(action);
  };

  // 取出 action 对应的能力（不存在返回 undefined）。
  AbilityRegistry.prototype.get = function (action) {
    return this._abilities.get(action);
  };

  // 是否已注册某 action。
  AbilityRegistry.prototype.has = function (action) {
    return this._abilities.has(action);
  };

  // 列出所有已注册的 action（便于调试 / 自检）。
  AbilityRegistry.prototype.listActions = function () {
    return Array.from(this._abilities.keys());
  };

  BridgeCore.AbilityRegistry = AbilityRegistry;
})(typeof window !== 'undefined' ? window : globalThis);
