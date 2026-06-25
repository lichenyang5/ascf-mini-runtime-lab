# 04 · Dispatch Flow：一次调用的完整流程

> 对应代码：[bridge-core/dispatcher/bridgeDispatcher.js](../bridge-core/dispatcher/bridgeDispatcher.js)、[h5-demo/bridge.js](../h5-demo/bridge.js)

## 1. 为什么单独抽一个分发器

协议（02）管「形状」，注册表（03）管「有哪些能力」。但总得有人把它们串起来：拿到一个 request，校验它、找到对应能力、调用、再把结果包成统一响应。

这个「串起来」的角色就是 **Dispatcher（分发器）**。把它单独抽出来的目的，是让它成为唯一的中枢——所有调用都走同一条路，于是校验、错误包装、日志才有统一的落点。

一条铁律：**Dispatcher 不写具体业务**。它只做校验、查找、调用、包装四件事；业务永远在 ability 里。

## 2. 它是什么

分发器就一个函数：

```js
dispatchBridgeRequest(request, registry) -> response
```

输入一个 request 和一张注册表，输出一个**一定符合协议**的 response（无论成功还是失败）。

## 3. 完整流程

```txt
H5 按钮点击
  → createRequest(action, params)            // h5-demo/bridge.js：构造带 id 的 request
  → window.ascfBridge.send(request)           // 模拟 H5 -> Native 异步往返
  → dispatchBridgeRequest(request, registry)  // 进入中枢
      ├─ 1. validateBridgeRequest(request)
      │      校验失败 → createErrorResponse(400, PARAM_ERROR)
      ├─ 2. registry.get(request.action)
      │      找不到能力 → createErrorResponse(404, UNKNOWN_ACTION)
      ├─ 3. ability.handle(params, request)
      │      ├─ 返回 abilityError 信封 → createErrorResponse(信封里的 code/msg)
      │      ├─ 正常返回 data          → createSuccessResponse(data)
      │      └─ 抛异常                 → createErrorResponse(500, INTERNAL_ERROR)
  → response 回灌 H5
  → recordDebugLog(request, response, duration) // 全链路记录
  → 页面展示 response
```

用三个按钮对照看：

| 点击 | 走到哪一步 | 结果 |
| --- | --- | --- |
| `toast.show`（有文案） | 第 3 步，正常返回 | `code 0` / `data.shown = true` |
| `toast.show`（空文案） | 第 3 步，返回 abilityError | `code 400` / `PARAM_ERROR` |
| `device.info` | 第 3 步，正常返回 | `code 0` / `platform = "HarmonyOS Mock"` |
| `unknown.action` | 第 2 步，查不到 | `code 404` / `UNKNOWN_ACTION` |

## 4. 关键设计点

- **校验与包装分离**：`validateBridgeRequest` 只判断合不合法，「合法与否 → 什么响应」由 dispatcher 决定。
- **能力两种出错方式**：`handle` 可以「返回 `abilityError` 信封」（表达业务错误，如 PARAM_ERROR），也可以「抛异常」（表达意外故障，统一兜底成 500）。前者可控、后者兜底。
- **H5 永远只拿到协议化的 response**：四种路径（PARAM_ERROR / UNKNOWN_ACTION / 业务错误 / 成功）出来的都是同一种结构，H5 只看 `code`。

## 5. 小结

Dispatcher 是把协议、注册表、能力三者粘起来的中枢。它自己很「薄」——不碰业务，只负责让每一次调用都沿着 `校验 → 查找 → 调用 → 包装` 走完，从而把整条链路变得稳定、可观测、好扩展。
