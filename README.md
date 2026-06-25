# ASCF Mini Runtime Lab

> ⚠️ 公开学习实验项目，**不是 ASCF 官方实现**，不包含任何公司内部闭源代码。

## 项目介绍

ASCF Mini Runtime Lab 是一个用于学习**小程序容器、WebView JSBridge、H5 调 Native 能力、能力注册分发、协议封装、错误处理与调试链路**的公开学习项目。

它不是 ASCF 官方实现，而是一个公开、安全、最小化的学习模型，用来帮助理解 Hybrid Runtime（小程序容器 / WebView 混合运行时）的核心架构。

## 为什么做这个项目

普通 H5 页面跑在浏览器沙箱里，**没有通道直接调用系统能力**（toast、存储、设备信息……）。小程序 / Hybrid App 的通用做法是：把 H5 放进 WebView 容器，再用 JSBridge 把「H5 世界」和「Native 世界」连起来。

这个项目想用最小代价把这件事讲清楚——不是堆功能，而是能回答这些问题：

- 为什么 H5 不能直接调用 Native？
- JSBridge 在容器里到底起什么作用？
- `requestId` / `action` / 注册表 / 分发器各自解决什么问题？
- `UNKNOWN_ACTION`、`PARAM_ERROR`、`TIMEOUT` 这些错误从哪一层产生？
- 调试链路为什么对框架维护很重要？

> 展开见 [docs/01-why-jsbridge.md](docs/01-why-jsbridge.md)。

## 核心调用链路

整个项目围绕这一条链路展开：

```txt
H5 页面点击按钮
  → window.ascfBridge.send(request)
  → Bridge Protocol（校验请求结构 / 统一协议）
  → Bridge Dispatcher（按 action 分发）
  → Ability Registry（查找已注册能力）
  → Mock Native Ability（执行能力）
  → Response Protocol（统一响应 / 错误码）
  → H5 callback / Promise result
  → Debug Log（全链路记录）
```

最小示例（目标形态）：

```js
window.ascfBridge.send({
  id: "req_001",
  version: "1.0.0",
  action: "toast.show",
  params: { message: "Hello ASCF Mini Runtime" }
})
// → { id: "req_001", action: "toast.show", code: 0, msg: "success", data: { shown: true } }
```

## 架构图

![ASCF Mini Runtime 运行时分层架构图](./docs/assets/runtime-architecture.png)

> 图片由 [docs/diagrams/runtime-architecture.mmd](docs/diagrams/runtime-architecture.mmd) 渲染导出。
> 修改架构时请改 `.mmd` 源文件并重新导出 PNG，保持图文一致。

## 当前阶段目标

当前处于 **Stage 0：项目初始化**。本阶段只做文档与目录骨架，**不写业务代码**。已完成：

- 项目门面 README（本文件）
- 阶段路线 [docs/00-project-roadmap.md](docs/00-project-roadmap.md)
- 首篇文档骨架 [docs/01-why-jsbridge.md](docs/01-why-jsbridge.md)
- 架构图源码与导出图（`docs/diagrams/` + `docs/assets/`）
- 各模块目录骨架：`h5-demo/`、`bridge-core/`、`ability-plugins/`、`debug-panel/`、`examples/`

下一步是 **Stage 1**：用 H5 + JavaScript Mock 把上面的调用链路真正跑通。

## 目录结构

```txt
ascf-mini-runtime-lab/
├── README.md                 项目门面
├── skill.md                  开发约束 / AI 协作规范
├── docs/                     学习文档
│   ├── 00-project-roadmap.md 阶段路线
│   ├── 01-why-jsbridge.md    为什么需要 JSBridge（骨架）
│   ├── assets/               架构图等静态资源
│   │   └── runtime-architecture.png
│   └── diagrams/             图源码
│       └── runtime-architecture.mmd
├── h5-demo/                  H5 演示页（规划中）
├── bridge-core/              协议 / 注册表 / 分发器 / 错误码（规划中）
├── ability-plugins/          toast / storage / device / network（规划中）
├── debug-panel/              调试面板（规划中）
└── examples/                 basic-call / unknown-action / param-error（规划中）
```

## 开发路线

| 阶段 | 主题 | 状态 |
| --- | --- | --- |
| Stage 0 | 项目初始化（文档 + 目录骨架） | 🔄 进行中 |
| Stage 1 | H5 Mock 跑通 | ⏳ |
| Stage 2 | Bridge Core（协议 / 注册表 / 分发器） | ⏳ |
| Stage 3 | Ability Plugins | ⏳ |
| Stage 4 | Debug Panel | ⏳ |
| Stage 5 | ArkTS WebView Container | ⏳ |
| Stage 6 | Offline Package Demo | ⏳ |
| Stage 7 | 文档与简历化 | ⏳ |

详见 [docs/00-project-roadmap.md](docs/00-project-roadmap.md)。

## 免责声明

- 本项目**不是 ASCF 官方实现，不包含任何公司内部闭源代码**。
- 不包含任何公司内部真实名称、真实 action、真实日志、内网地址、token 或真实用户数据。
- 所有命名（`ascfBridge`、`MiniRuntime`、`MockToastAbility` 等）均为公开学习用 mock 名称。
- 仅用于理解 WebView 容器、JSBridge 与小程序运行时架构。
