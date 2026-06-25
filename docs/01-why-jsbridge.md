# 01 · 为什么需要 JSBridge

> 📌 本文是 Stage 1 的配套文档**初稿（骨架）**。概念部分已可阅读，标注「关键代码」的部分会在 H5 Demo / Bridge Core 落地后（Task 2–3）补全真实代码。完整打磨在 Task 5。

---

## 1. 为什么需要它？

设想一个最朴素的需求：H5 页面上有个按钮，点一下要弹一个系统级 toast、读一条本地存储、拿一下设备信息。

在普通浏览器里，这件事做不到。原因是 **浏览器是一个沙箱**：

- 出于安全考虑，网页 JS 只能访问受限的 Web API（DOM、`fetch`、`localStorage` 等）；
- 它**无法直接调用操作系统/宿主 App 的原生能力**（弹原生 toast、读系统剪贴板、查设备型号、调相机……）；
- 网页本身也不知道自己是不是跑在一个 App 里。

所以问题不是「H5 不想调 Native」，而是「H5 **没有通道**调 Native」。
JSBridge 要解决的，就是**在 H5 世界和 Native 世界之间架一条受控的通道**。

---

## 2. 它解决了什么问题？

JSBridge 解决三件事：

1. **打通通道**：让 H5 能把「我要调用某个能力」这件事，传递给 Native。
2. **统一协议**：H5 不需要知道 Native 怎么实现，只需按约定结构发 `action` + `params`，按约定结构收 `code` / `msg` / `data`。
3. **可控可调试**：所有调用走同一个入口，于是可以统一鉴权、统一错误码、统一日志，从而**可观测、可复现、可维护**。

一句话：**JSBridge 把「H5 调 Native」从「不可能」变成「一次受协议约束的、可被调试的远程调用」。**

---

## 3. 它在架构中的位置

JSBridge 不是单点，而是横跨「容器 + 协议 + 分发 + 能力」的一整条链路。
在本项目分层中（架构图见 [diagrams/runtime-architecture.mmd](diagrams/runtime-architecture.mmd)）：

```txt
H5 Demo Layer        发请求 / 收结果（只关心 action 和 params）
        │
Bridge Protocol      定义并校验 request / response，统一错误码  ← JSBridge 的「契约」
        │
Bridge Dispatcher    按 action 找到能力、调用、包装响应         ← JSBridge 的「中枢」
        │
Ability Registry     谁能处理哪个 action
        │
Ability Plugins      具体能力实现（toast/storage/device/...）
```

WebView 容器是这条链路的「物理载体」：它把 H5 装进来，并在 H5 与 Native 之间提供最底层的两个原语——
**H5 → Native** 的调用入口，和 **Native → H5** 的回调入口。JSBridge 就建立在这两个原语之上。

---

## 4. 核心流程：H5 → Native → H5 的闭环

JSBridge 的精髓是一个**闭环**，而不是单向调用。关键在于用 `id` 把「请求」和「响应」配对。

```txt
1. H5 构造 request：{ id, version, action, params }
2. H5 通过容器入口把 request 交给 Native（H5 → Native）
3. Protocol 校验 request 结构是否合法（缺字段 → PARAM_ERROR）
4. Dispatcher 按 action 去 Registry 查能力（查不到 → UNKNOWN_ACTION）
5. 命中的 Ability 执行，产出业务 data
6. Dispatcher 把结果包装成统一 response：{ id, action, code, msg, data }
7. Native 通过回调入口把 response 交还 H5（Native → H5）
8. H5 用 response.id 找到当初的调用方，兑现 callback / Promise
```

为什么 `id`（requestId）如此重要？因为这是一条**异步**链路：H5 可能同时发出多个请求，响应回来的顺序也不保证。
没有 `id`，H5 就无法知道「这条回来的响应」对应「当初哪一次调用」。`id` 是把异步结果重新对上号的唯一凭据。

> 一个常见误解：以为 H5 和 Native「天然」就能双向通信。
> 其实双向通信是**约定**出来的——约定方法名、约定请求结构、约定回调方式、约定 requestId，四者共同构成闭环。

---

## 5. 关键代码（目标形态）

> ⏳ 以下为**目标契约**，真实实现随 Stage 1 / Stage 2 落地后回填。

H5 侧发起调用（Promise 化）：

```js
// 目标形态：send 返回 Promise，由 id 匹配回调
const res = await window.ascfBridge.send({
  id: "req_001",
  version: "1.0.0",
  action: "toast.show",
  params: { message: "Hello ASCF Mini Runtime" }
})
// res => { id: "req_001", action: "toast.show", code: 0, msg: "success", data: { shown: true } }
```

统一响应结构（成功 / 失败同构）：

```json
{ "id": "req_001", "action": "toast.show", "code": 0,   "msg": "success",        "data": { "shown": true } }
{ "id": "req_002", "action": "unknown.action", "code": 404, "msg": "UNKNOWN_ACTION", "data": null }
```

---

## 6. 常见错误

| 现象 | 根因 | 归属层 / 错误码 |
| --- | --- | --- |
| H5 发完请求收不到响应 | request 没带 `id`，或回调没按 `id` 匹配 | H5 / Protocol |
| 调用任意能力都「无反应」 | 容器没正确暴露 H5 → Native 入口 | WebView 容器 |
| 某能力名调用返回 404 | action 未在 Registry 注册 | Registry → `UNKNOWN_ACTION` |
| 参数对了却报错 | 必填 `params` 缺失/类型不对 | Protocol/Ability → `PARAM_ERROR` |
| 响应格式五花八门 | 各 ability 自己拼 response | 违反统一协议（必须由 Protocol 统一包装） |

---

## 7. 小结

- 普通 H5 跑在沙箱里，**没有通道**直接调用 Native 能力。
- WebView 容器提供最底层的两个原语：H5 → Native 调用、Native → H5 回调。
- **JSBridge 在这两个原语之上建立统一协议**，把「H5 调 Native」变成一次受约束、可分发、可调试的远程调用。
- 闭环靠 `id` 把异步请求与响应配对；能力靠 Registry + Dispatcher 解耦分发；错误靠统一错误码定位。
- 这正是本项目要用最小代价跑通并讲清楚的核心链路。

> 下一篇（规划中）：`02-bridge-protocol.md` —— 把「契约」写成可校验的协议。
