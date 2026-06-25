# 03 · Ability Registry：能力注册表

> 对应代码：[bridge-core/registry/abilityRegistry.js](../bridge-core/registry/abilityRegistry.js)

## 1. 为什么需要注册表

Stage 1 的分发是写死的 `switch` / `if`：

```js
// Stage 1：action 写死在分发逻辑里
if (action === 'toast.show') { ... }
else if (action === 'device.info') { ... }
else { /* 404 */ }
```

问题很现实：**每加一个能力，就要回去改分发函数**。分发逻辑和能力清单耦合在一起，越改越长，也越容易碰坏已有能力。

我们想要的是：加能力时**只新增一个文件**，不动分发器。要做到这点，就得把「有哪些能力」这件事，从分发器里搬出来，单独存放——这就是注册表。

## 2. 它是什么

注册表就是一张 `action -> ability` 的映射表。它只负责「存 / 取 / 查 / 列」，不负责调用，也不关心能力内部干什么。

ability 是一个最简单的对象约定：

```txt
{
  action: "toast.show",          // 能力名
  handle(params, request) { }    // 具体实现，返回 data 或 abilityError 信封
}
```

## 3. 怎么做（本项目实现）

内部用 `Map` 存映射，对外暴露五个方法：

```js
const registry = new AbilityRegistry();

registry.register(action, ability);  // 注册（返回 this，可链式）
registry.unregister(action);         // 注销
registry.get(action);                // 取出能力（不存在返回 undefined）
registry.has(action);                // 是否已注册
registry.listActions();              // 列出所有 action，便于调试 / 自检
```

在 H5 组装层 `h5-demo/bridge.js` 里，注册就是几行声明：

```js
const registry = new BridgeCore.AbilityRegistry();
registry.register(toastAbility.action, toastAbility);
registry.register(deviceAbility.action, deviceAbility);
```

以后要加 `storage.get`，只需：写一个 `storageAbility.js` → 在这里 `registry.register(...)` 一行。**dispatcher 一个字都不用改。**

## 4. 小结

注册表把「有哪些能力」与「怎么分发」解耦：

- 能力清单是**数据**（注册表里的条目），不是写死的**代码分支**；
- 新增能力是「加数据」，不是「改流程」；
- `listActions()` 还顺手让整套能力变得可自省、可调试。

下一篇 [04-dispatch-flow.md](04-dispatch-flow.md) 讲分发器如何用这张表把一次调用跑完。
