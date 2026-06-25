# 01 · 为什么需要 JSBridge

> 📌 文章骨架（初稿）。先把脉络写清楚，细节与真实代码随 H5 Demo / Bridge Core 落地后补全。
> 行文遵循：先讲为什么，再讲是什么，最后讲怎么做。

---

## 1. 为什么普通 H5 不能直接调用 Native 能力

设想一个最朴素的需求：H5 页面上有个按钮，点一下要弹一个**系统级 toast**、读一条本地存储、拿一下设备信息。

在普通浏览器里，这件事做不到。原因是浏览器是一个**沙箱**：出于安全，网页 JS 只能访问受限的 Web API（DOM、`fetch`、`localStorage`……），**无法直接调用宿主系统的原生能力**——弹原生 toast、读系统剪贴板、查设备型号、调相机都不行。

所以问题不是「H5 不想调」，而是「H5 **没有通道**调」。

## 2. WebView 容器解决了什么问题

小程序 / Hybrid App 不在系统浏览器里跑 H5，而是把 H5 装进一个由 App 自己控制的 **WebView 容器**。

容器的价值在于：它在 H5 和 Native 之间提供了最底层的两个原语——

- **H5 → Native**：H5 能把「我要调用某个能力」交给宿主；
- **Native → H5**：宿主能把结果回灌给 H5。

容器还负责加载页面、白名单、生命周期管理。但要注意：容器只给了「能互相喊话」的能力，**还没有规定「怎么喊」**。

## 3. JSBridge 是什么

JSBridge 就是建立在这两个原语之上的一套**约定（协议）**。它规定：

- H5 怎么发请求：`{ id, version, action, params }`
- Native 怎么回响应：`{ id, action, code, msg, data }`
- 出错怎么表达：统一错误码（`PARAM_ERROR` / `UNKNOWN_ACTION` / `TIMEOUT` ……）

一句话：**容器给了通道，JSBridge 给了协议。** 有了协议，H5 不必关心 Native 怎么实现，只按结构发 `action`、收 `data`。

## 4. H5 → Native → H5 的基本闭环

JSBridge 的精髓是一个**闭环**，而不是单向调用：

```txt
H5 构造 request（带 id）
  → 容器把 request 交给 Native
  → Native 校验 / 按 action 分发 / 执行能力
  → Native 包装 response（带同一个 id）
  → 容器把 response 回灌给 H5
  → H5 用 id 找到当初的调用，兑现 callback / Promise
```

关键在 `id`：这是一条**异步**链路，多个请求可能同时在飞，响应回来的顺序也不保证。没有 `id`，H5 就无法把「回来的响应」对上「当初哪一次调用」。

> 常见误解：以为 H5 和 Native「天然」就能双向通信。其实双向是**约定**出来的——约定方法名、请求结构、回调方式、requestId，共同构成闭环。

## 5. 本项目如何模拟这个过程

本项目先不接真实平台，用最小代价把闭环跑通：

1. 前期用 **H5 + JavaScript Mock** 模拟 `window.ascfBridge.send` 与 Native 侧分发；
2. 把**协议 / 注册表 / 分发器 / 能力插件**分层实现（架构见 [diagrams/runtime-architecture.mmd](diagrams/runtime-architecture.mmd)）；
3. 用 **Debug Panel** 把每次 request / response / 耗时 / 错误码记录下来，让链路可观测；
4. 链路清楚后，再迁移到 **HarmonyOS WebView / ArkTS**（`javaScriptProxy` 暴露 bridge + `runJavaScript` 回调 H5）。

> 下一篇（规划中）：`02-bridge-protocol.md` —— 把这套约定写成可校验的协议。
