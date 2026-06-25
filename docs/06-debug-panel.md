# Debug Panel：为什么调试面板是框架维护的核心？

> 对应代码：[debug-panel/debugPanel.js](../debug-panel/debugPanel.js)、[h5-demo/bridge.js](../h5-demo/bridge.js)

## 1. 为什么只看页面结果不够？

H5 页面上点一个按钮，最后弹个 toast、显示一行结果——对**用户**够了，但对**维护框架的人**远远不够。

当一次调用「不对劲」时，你要回答的是：

- 这次发出去的 request 到底长什么样？`params` 带全了吗？
- Native 侧回了什么 response？`code` 是几？`msg` 是什么？
- 走的是哪个 `action`？这个 action 注册了吗？
- 这次调用花了多久？是不是某个能力变慢了？

光看页面那一行结果，这些全看不到。要维护一个 Bridge 框架，就必须把 **request / response / action / 错误码 / 耗时** 这些「过程」可视化。这正是 Debug Panel 的职责。

## 2. Debug Panel 在本项目中的位置

它是一条**旁路观测层**，挂在主链路之外：

```txt
H5 -> Bridge Protocol -> Dispatcher -> Registry -> Ability -> Response  （主链路）
                                  │
                                  └─（旁路）DebugPanel.record(entry)     （观测层）
```

关键点：**Debug Panel 不参与业务分发**。它不校验、不查找能力、不决定成功失败——它只是「在一旁看着」，把每次调用的事实记下来并展示。主链路即使没有 Debug Panel 也能跑通；有了它，只是变得可观测。

在代码上，它是一个独立模块 `window.DebugPanel`，由组装层 `bridge.js` 在 `send` 完成后调用 `DebugPanel.record(entry)`，并在初始化时通过 `DebugPanel.setRegisteredActions(registry.listActions())` 把当前已注册能力喂给它。

## 3. 它记录了什么？

每条日志（entry）包含：

| 字段 | 含义 |
| --- | --- |
| `id` | 请求唯一 id（request/response 配对凭据） |
| `action` | 调用的能力名 |
| `request` | 完整请求 JSON |
| `response` | 完整响应 JSON |
| `duration` | 本次调用耗时（ms） |
| `code` | 响应状态码 |
| `msg` | 响应描述 |
| `timestamp` | 调用发生时间 |

除单条日志外，面板还展示：**Debug Stats**（总调用 / 成功 / 失败 / 最近一次错误）和 **Registered Actions**（当前注册的所有 action）。每条日志还能一键复制 request / response JSON。

## 4. 它如何帮助定位问题？

Debug Panel 把「猜」变成「看」：

- **UNKNOWN_ACTION（404）**：看 **Registered Actions** 区里有没有这个 action。没有，就是没注册（漏了 `register` 或漏了 `<script>`）。
- **PARAM_ERROR（400）**：展开日志看 `request.params`，对照能力要求，是不是缺了字段（如 `storage.set` 缺 `value`）。
- **INTERNAL_ERROR（500）**：看 `response.data.reason`，那是能力内部抛出的异常信息。
- **耗时异常**：看 `duration`。某个 action 明显比别人慢，就知道从哪查起。

配合「复制 request / response」，还能把一次问题调用原样发给别人复现。

## 5. 为什么 Debug Panel 不应该写死在 bridge.js 里？

Stage 1–3 时，日志的记录和渲染都堆在 `bridge.js` 里。但 `bridge.js` 是**组装层**——它的职责是构造 request、装配 registry、暴露 `send`、绑定按钮。把「调试面板怎么渲染、怎么统计、怎么复制」也塞进去，会让组装层越来越胖，职责混乱。

所以这一阶段把它拆出来：

- `bridge.js`（组装层）只产出一条 `entry`，然后交给 `DebugPanel.record(entry)`；
- `debugPanel.js`（观测层）专心负责记录、统计、渲染、复制。

**组装层负责"让链路跑起来"，观测层负责"把链路看清楚"**，两者职责分离。这也呼应了整个项目的分层原则：每一层只做自己的事。
