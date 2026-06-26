# Runtime Engine：为什么需要一个运行时入口？

> 对应代码：[runtime/Runtime.js](../runtime/Runtime.js)、[runtime/RuntimeState.js](../runtime/RuntimeState.js)、[runtime/EventBus.js](../runtime/EventBus.js)、[h5-demo/bridge.js](../h5-demo/bridge.js)

## 1. 之前的问题：bridge.js 越来越像"总管"

到 Stage 4 为止，`h5-demo/bridge.js` 实际上同时干了五件事：

- 自己 `new AbilityRegistry()` 并把所有 ability 注册进去；
- 自己调用 `BridgeCore.dispatchBridgeRequest` 做分发；
- 自己组装 entry、调用 `DebugPanel.record`；
- 自己读取输入框、绑定按钮、展示当前 Request / Response；
- 同时还兼任「请求 id 生成器」「mock 异步往返」。

每加一个新能力，这个文件都会再胖一点。问题不在「能不能跑」——能跑——而在职责越来越糊：它既是 H5 Demo 的 UI 入口，又是 Mini Runtime 的总装配间。两件事在一个文件里搅在一起，谁出问题都要回这里看。

更现实的问题：当我们准备接 ArkTS 容器或离线包，`bridge.js` 这种「H5 专属胶水」根本搬不过去。「装配」这件事应该独立存在。

## 2. Runtime 解决什么问题？

Runtime 是 Mini Runtime 的**统一入口**。它把原来散落在 `bridge.js` 里的「装配 + 调度 + 观测 + 状态 + 事件」收拢成一个对象：

```js
var runtime = MiniRuntime.createRuntime({
  protocolVersion: '1.0.0',
  bridgeCore: BridgeCore,
  debugPanel: DebugPanel
});

runtime.registerAbilities([ /* 多个 ability，支持嵌套数组 */ ]);
runtime.start();

// 高阶入口：H5 Demo 只用这个
var { request, response } = await runtime.call('toast.show', { message: 'hi' });

// 低阶入口：兼容已有 window.ascfBridge.send 协议
window.ascfBridge = { send: request => runtime.dispatch(request) };
```

抽出来之后：

- `bridge.js` 只剩"读输入框 / 绑按钮 / 调 `runtime.call` / 展示 Request·Response"；
- 想换宿主（ArkTS 容器、Node 调试器、单测）只需重新组装一个 Runtime，不用动 H5 Demo。

## 3. Runtime 在架构中的位置

```txt
H5 Demo（h5-demo/bridge.js · UI 入口）
  └── Runtime（runtime/Runtime.js · 统一入口）
        ├── BridgeCore（protocol / dispatcher）
        ├── AbilityRegistry（action -> ability）
        ├── DebugPanel（旁路观测层）
        ├── RuntimeState（运行时状态）
        └── EventBus（runtime / request / ability 事件）
```

注意：Runtime 不是新加的"业务层"，而是**装配层**——它本身不实现协议、不实现能力、不渲染面板，只负责把现有几个模块组装成一个有清晰生命周期的对象。

## 4. RuntimeState 管什么？

`createRuntimeState(options)` 持有 runtime 的纯状态：

| 字段 | 含义 |
| --- | --- |
| `version` | 当前协议版本 |
| `started` | 是否已 start |
| `debugMode` | 是否开启调试 |
| `currentPage` | 当前页面（H5 入口） |
| `requestCount` | 累计请求数 |
| `abilityCount` | 已注册 ability 数 |
| `startedAt` | 启动时间戳 |
| `lastRequestAt` | 最近一次请求时间戳 |

它只暴露最小更新方法：`start` / `stop` / `increaseRequestCount` / `setAbilityCount` / `snapshot`（浅拷贝读取，避免外部直接持有引用乱改）。**不做 DOM 渲染，不调能力**。

## 5. EventBus 有什么用？

`createEventBus()` 是一个极简事件总线（普通对象按事件名存 handler 数组，触发时复制一份再遍历，单个 handler 抛错不影响其它）。当前约定的事件：

| 事件 | 触发时机 |
| --- | --- |
| `runtime:started` | `runtime.start()` 完成 |
| `runtime:stopped` | `runtime.stop()` 完成 |
| `request:created` | `runtime.createRequest` 后 |
| `request:finished` | `dispatch` 完成且 `code === 0` |
| `request:error` | `dispatch` 完成且 `code !== 0` |
| `ability:registered` | 注册一个新 ability |

这一步先把事件契约定下来，不接任何消费者。**真正的价值在下一阶段**：AbilityMonitor、PerformanceMonitor、Runtime Timeline 都只是 `events.on(...)` 的订阅者，不需要回头改 Runtime。

## 6. 本阶段做到了什么？

- Runtime 统一创建 request（`createRequest`）；
- Runtime 统一 dispatch（`dispatch` / `call`）；
- Runtime 统一记录 DebugPanel（不再在 `bridge.js` 里组装 entry）；
- Runtime 统一维护 RuntimeState（请求计数、ability 数、启动时间）；
- Runtime 统一广播事件（EventBus 五大事件已接入主链路）；
- `bridge.js` 回归 H5 Demo 组装层——文件只剩输入、按钮、`runtime.call`、渲染 Request/Response。

附带产物：浏览器控制台可以直接看运行时快照——

```js
MiniRuntimeDevtools.getState()  // RuntimeState 浅拷贝
MiniRuntimeDevtools.getLogs()   // DebugPanel 当前日志
MiniRuntimeDevtools.runtime     // runtime 实例本身
```

## 7. 后续可以扩展什么？

EventBus 已经把「扩展点」预留好了，不用回头改 Runtime：

- **AbilityMonitor**：订阅 `request:finished` / `request:error`，按 action 统计 QPS / 错误率。
- **PerformanceMonitor**：订阅 `request:created` 与 `request:finished`，画 duration 分布。
- **Runtime Timeline**：把所有事件按时间轴渲染，做"调用全景图"。
- **Offline Package**：在 `runtime:started` 前接入资源加载，启动失败时上报 `runtime:error`。
- **ArkTS WebView Container**：把 `bridgeCore.dispatchBridgeRequest` 换成走 `javaScriptProxy` 到 ArkTS 侧，H5 Demo 不动。
