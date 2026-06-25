# 00 · 项目路线图（Project Roadmap）

本文件说明 ASCF Mini Runtime Lab 的阶段计划与验收标准，是项目「从 0 到 1」的总纲。
详细开发约束见 [../skill.md](../skill.md)。

> 核心原则（来自 skill.md 第 16 节）：
> **先学架构，再接平台；先跑通链路，再处理环境；先做可演示闭环，再做工程扩展。**
> 因此前期用 H5 + JavaScript Mock 跑通核心链路，最后再迁移到 HarmonyOS WebView / ArkTS。

---

## 0. 状态图例

| 图例 | 含义 |
| --- | --- |
| ✅ | 已完成 |
| 🔄 | 进行中 |
| ⏳ | 待开始 |

---

## 1. 核心链路目标

整个项目围绕这一条链路展开，所有阶段都是为它服务：

```txt
H5 Button
  → window.ascfBridge.send(request)
  → Bridge Protocol（校验 / 统一结构）
  → Bridge Dispatcher（按 action 分发）
  → Ability Registry（查找能力）
  → Mock Native Ability（执行）
  → Response Protocol（统一响应）
  → H5 callback / Promise result
  → Debug Log（全链路记录）
```

最终要能稳定复现成功与错误场景：`SUCCESS` / `UNKNOWN_ACTION` / `PARAM_ERROR` / `TIMEOUT`。

---

## 2. 阶段计划（Stage 0 → Stage 7）

### Stage 0 · 项目初始化 — ✅ 已完成

- **目标**：初始化仓库、确定目录结构、写清楚「项目是什么 / 后续怎么做」。
- **产出**：`README.md`、`skill.md`、`docs/00-project-roadmap.md`、`docs/01-why-jsbridge.md`、`docs/diagrams/runtime-architecture.mmd`。
- **验收**：
  - README 能说明项目是什么；
  - skill.md 能约束后续开发；
  - 本路线图能说明阶段计划。

### Stage 1 · H5 Mock 跑通 — ✅ 已完成

- **目标**：`h5-demo/index.html` + `bridge.js` + `style.css`，模拟 `window.ascfBridge.send`，点击按钮返回 mock response。
- **验收**：浏览器打开 `index.html`，点 `toast.show` 显示 success，点 `unknown.action` 显示 `UNKNOWN_ACTION`。
- **进展**：已实现 `toast.show` / `device.info` / `unknown.action` 三个调用；统一 request/response 协议、`PARAM_ERROR`（toast 文案留空）与 `UNKNOWN_ACTION` 错误分支；Debug Log 记录 request / response / duration / code。逻辑集中在 `h5-demo/bridge.js`，纯前端、无依赖、可直接用浏览器打开。

### Stage 2 · Bridge Core — ✅ 已完成

- **目标**：实现协议类型、dispatcher、registry、error response。
- **验收**：action 存在调用成功；不存在返回 `UNKNOWN_ACTION`；params 非法返回 `PARAM_ERROR`；所有 response 格式统一。
- **进展**：已把 Stage 1 的单文件逻辑拆为分层架构——`bridge-core/`（protocol / errors / registry / dispatcher）+ `ability-plugins/`（toast / device）。`h5-demo/bridge.js` 退化为组装层。采用经典 script + 全局命名空间（`window.BridgeCore` / `window.AbilityPlugins`），保持浏览器直接打开 `index.html` 即可运行。配套文档：[01](01-why-jsbridge.md) 之后新增 [02](02-bridge-protocol.md) / [03](03-ability-registry.md) / [04](04-dispatch-flow.md)。

### Stage 3 · Ability Plugins — ✅ 已完成

- **目标**：`toast.show`、`storage.set`、`storage.get`、`device.info`、`network.status`。
- **验收**：每个 ability 独立文件 + 说明文档 + 错误场景。
- **进展**：在 Stage 2 分层上新增 `storage.set` / `storage.get`（localStorage Mock）、`network.status`、`clipboard.write`，连同既有 `toast.show` / `device.info` 共 6 个能力。全部只通过「新建 ability 文件 + 在组装层 `register`」接入，dispatcher / protocol / registry 未改动。`index.html` 按能力分类（基础 / 存储 / 系统 Mock / 错误场景）。配套文档 [05-ability-plugins.md](05-ability-plugins.md)。

### Stage 4 · Debug Panel — 🔄 进行中

- **目标**：展示 request / response / duration / 错误码，支持复制 request JSON。
- **验收**：页面能看到完整调用链路，清楚看到 H5 发了什么、Native Mock 返回了什么。
- **进展**：已把 Debug Log 从 `h5-demo/bridge.js` 抽成独立的旁路观测层 `debug-panel/debugPanel.js`（`window.DebugPanel`：init / record / clear / getLogs / render / setRegisteredActions）。新增 Debug Stats（总数/成功/失败/最近错误）、Registered Actions（由 `registry.listActions()` 喂入，不写死）、每条日志可复制 request/response。`bridge.js` 退为「产出 entry → DebugPanel.record」。配套文档 [06-debug-panel.md](06-debug-panel.md)。

### Stage 5 · ArkTS WebView Container — ⏳

- **目标**：HarmonyOS Web 组件加载 H5，`javaScriptProxy` 暴露 bridge，`runJavaScript` 回调 H5。
- **验收**：H5 点击 → ArkTS 收到 request → dispatch 返回 response → H5 展示 response。

### Stage 6 · Offline Package Demo — ⏳

- **目标**：模拟离线包加载、版本号展示、fallback 错误页。
- **验收**：正常加载本地页面；失败展示错误页；文档解释离线包解决的问题。

### Stage 7 · 文档与简历化 — ⏳

- **目标**：补充架构图、时序图、README 截图、博客与简历描述。
- **验收**：README 让陌生人看懂；docs 讲清架构；项目可作为求职展示。

---

## 3. 第一批任务（Stage 0 内拆解）

| 任务 | 内容 | 状态 |
| --- | --- | --- |
| **Task 1** | 初始化文档骨架：`README.md` / `docs/00-project-roadmap.md` / `docs/01-why-jsbridge.md` / `docs/diagrams/runtime-architecture.mmd` | ✅ 已完成 |
| Task 2 | 创建 H5 Demo：`h5-demo/index.html` / `bridge.js` / `style.css`，假的 `window.ascfBridge.send` | ✅ 已完成 |
| Task 3 | 抽出 Bridge Core：`protocol` / `registry` / `dispatcher` | ✅ 已完成 |
| Task 4 | 加 Debug Log：每次请求/响应生成日志、记录耗时、页面展示 | ✅ 已完成（升级为独立 Debug Panel） |
| Task 5 | 写第一篇文档：完善 `docs/01-why-jsbridge.md` | ⏳ |

> Task 1 仅写「项目构思与路线」，不写业务代码。

---

## 4. 文档配套计划

每完成一个核心模块，补充对应文档（模板见 skill.md 第 8 节：先讲为什么 → 是什么 → 怎么实现 → 调试踩坑）。

| 文档 | 主题 | 对应阶段 | 状态 |
| --- | --- | --- | --- |
| `01-why-jsbridge.md` | 为什么需要 JSBridge | Stage 1 | 🔄 骨架已建 |
| `02-bridge-protocol.md` | 协议设计 | Stage 2 | ✅ |
| `03-ability-registry.md` | 能力注册表 | Stage 2/3 | ✅ |
| `04-dispatch-flow.md` | 分发流程 | Stage 2 | ✅ |
| `05-ability-plugins.md` | 能力插件化（含常见错误） | Stage 3 | ✅ |
| `06-debug-panel.md` | Debug Panel | Stage 4 | ✅ |
| `07-offline-package.md` | 离线包 | Stage 6 | ⏳ |
| `diagrams/bridge-sequence.mmd` | 调用时序图 | Stage 2/4 | ⏳ |

---

## 5. 最终验收口径

项目不以功能数量验收，而以**架构表达能力**验收。
当 README + docs + 代码 + demo 能讲清 skill.md 第 15 节的 10 个问题时，项目即达成目标。
