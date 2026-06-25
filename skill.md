# ASCF Mini Runtime Lab - Project Skill

## 1. 项目定位

本项目是一个用于学习和演示 **小程序容器 / WebView / JSBridge / H5 调 Native 能力 / 能力注册分发 / 协议封装 / 离线包 / 调试链路** 的实验项目。

本项目不是 ASCF 官方实现，也不包含任何公司内部闭源代码。
本项目只做公开可展示的最小化学习模型，用来帮助理解类似 ASCF、小程序容器、Hybrid Runtime 的核心思想。

项目核心目标：

```txt
H5 页面
  ↓
window.ascfBridge.send(request)
  ↓
Bridge Protocol
  ↓
Bridge Dispatcher
  ↓
Ability Registry
  ↓
Native Ability Mock / Biz / Imp
  ↓
Response Protocol
  ↓
H5 callback / Promise result
```

这个项目最终应该能做到：

1. H5 页面点击按钮，可以通过 JSBridge 调用 Native Mock 能力。
2. Native 侧根据 action 分发到不同能力实现。
3. 所有请求和响应都走统一协议。
4. 错误场景可以被稳定复现，例如 UNKNOWN_ACTION、PARAM_ERROR、TIMEOUT。
5. 项目有清晰的架构文档、时序图、调试说明和演示截图。
6. 项目可以写进简历，用来说明自己理解 WebView 容器、JSBridge 和小程序运行时架构。

---

## 2. 项目原则

### 2.1 不追求大而全

本项目不追求完整实现小程序框架，不做复杂页面系统，不做真实商业能力。

优先做清楚这些核心问题：

```txt
为什么需要 JSBridge？
H5 如何调用 Native？
Native 如何注册能力？
请求如何分发？
响应协议如何统一？
错误如何定位？
调试链路如何设计？
离线包加载解决什么问题？
```

### 2.2 每个功能必须能讲清楚架构价值

不要为了堆功能而写功能。
每新增一个模块，都必须能回答：

```txt
它解决什么问题？
它在架构中处于哪一层？
它和其他模块如何通信？
它如何被调试？
它如何出错？
它如何写进文档？
```

### 2.3 小步提交

每次改动尽量控制在一个明确目标内。

推荐提交粒度：

```txt
feat: initialize project structure
feat: add bridge protocol definition
feat: add ability registry
feat: add bridge dispatcher
feat: add h5 demo page
feat: add mock toast ability
feat: add unknown action error handling
docs: add bridge sequence diagram
docs: explain h5 to native flow
```

不要一次性生成大量无关代码。

### 2.4 公开安全

禁止写入任何公司内部信息，包括但不限于：

```txt
公司内部 ASCF 源码
真实业务 action 名称
真实客户信息
真实日志
内网地址
公司私有包名
公司截图
闭源实现细节
```

所有命名必须使用公开学习用的 mock 名称。

可以使用：

```txt
ascfBridge
MiniRuntime
NativeAbility
MockDeviceAbility
MockStorageAbility
MockToastAbility
```

不要使用公司内部真实类名、真实协议名、真实 action 名称。

---

## 3. 技术目标

本项目优先围绕以下技术点展开。

### 3.1 JSBridge

核心能力：

```txt
H5 -> Native
Native -> H5
requestId 匹配
Promise 化调用
统一响应格式
错误码设计
```

H5 调用示例：

```js
window.ascfBridge.send({
  id: "req_001",
  version: "1.0.0",
  action: "toast.show",
  params: {
    message: "Hello ASCF Mini Runtime"
  }
})
```

Native 响应示例：

```json
{
  "id": "req_001",
  "action": "toast.show",
  "code": 0,
  "msg": "success",
  "data": {
    "shown": true
  }
}
```

错误响应示例：

```json
{
  "id": "req_002",
  "action": "unknown.action",
  "code": 404,
  "msg": "UNKNOWN_ACTION",
  "data": null
}
```

---

## 4. 推荐目录结构

项目初期建议使用如下结构：

```txt
ascf-mini-runtime-lab/
├── README.md
├── SKILL.md
├── docs/
│   ├── 00-project-roadmap.md
│   ├── 01-why-jsbridge.md
│   ├── 02-bridge-protocol.md
│   ├── 03-ability-registry.md
│   ├── 04-dispatch-flow.md
│   ├── 05-error-handling.md
│   ├── 06-offline-package.md
│   └── diagrams/
│       ├── bridge-sequence.mmd
│       └── runtime-architecture.mmd
├── h5-demo/
│   ├── index.html
│   ├── bridge.js
│   └── style.css
├── harmony-container/
│   └── README.md
├── bridge-core/
│   ├── protocol/
│   ├── dispatcher/
│   ├── registry/
│   └── errors/
├── ability-plugins/
│   ├── toast/
│   ├── storage/
│   ├── device/
│   └── network/
├── debug-panel/
│   └── README.md
└── examples/
    ├── basic-call/
    ├── unknown-action/
    └── param-error/
```

如果当前阶段还没有 HarmonyOS 代码，可以先用 Web / TypeScript / Node.js Mock 实现核心链路。
等核心链路跑通后，再逐步接入 ArkTS WebView 容器。

---

## 5. 架构分层

本项目建议按以下架构分层实现。

### 5.1 H5 Demo Layer

职责：

```txt
展示按钮
构造 bridge request
调用 window.ascfBridge.send
展示响应结果
展示错误信息
```

不应该负责：

```txt
能力分发
错误码判断
Native 能力实现
协议转换
```

### 5.2 Bridge Protocol Layer

职责：

```txt
定义 request 结构
定义 response 结构
定义错误码
校验必要字段
保证协议稳定
```

核心字段：

```txt
id        请求唯一 ID
version   协议版本
action    能力名称
params    请求参数
code      响应状态码
msg       响应描述
data      响应数据
```

### 5.3 Bridge Dispatcher Layer

职责：

```txt
接收 request
校验 request
根据 action 查找 ability
调用 ability
包装 response
处理异常
```

Dispatcher 是核心中枢，不应该直接写具体业务能力。

### 5.4 Ability Registry Layer

职责：

```txt
注册 ability
注销 ability
查找 ability
输出已注册 action 列表
```

示例：

```txt
registry.register("toast.show", ToastAbility)
registry.register("storage.get", StorageAbility)
registry.register("device.info", DeviceAbility)
```

### 5.5 Ability Plugin Layer

职责：

```txt
实现具体能力
处理 params
返回业务 data
```

推荐先实现这些 mock 能力：

```txt
toast.show
storage.set
storage.get
device.info
network.status
clipboard.write
```

### 5.6 Debug Panel Layer

职责：

```txt
记录请求日志
记录响应日志
显示 action
显示耗时
显示 code/msg
显示 params/data
支持复制测试用例
```

调试面板是本项目的重要亮点，不是附属功能。

---

## 6. 错误码设计

初期统一使用以下错误码：

```txt
0      SUCCESS
400    PARAM_ERROR
404    UNKNOWN_ACTION
408    TIMEOUT
500    INTERNAL_ERROR
```

错误响应必须统一格式：

```json
{
  "id": "req_xxx",
  "action": "toast.show",
  "code": 400,
  "msg": "PARAM_ERROR",
  "data": {
    "reason": "message is required"
  }
}
```

禁止不同 ability 返回不同格式。

---

## 7. 开发路线

### Stage 0: 项目初始化

目标：

```txt
初始化仓库
添加 README.md
添加 SKILL.md
添加 docs/00-project-roadmap.md
确定目录结构
```

验收标准：

```txt
README 能说明项目是什么
SKILL 能约束后续开发
docs/00-project-roadmap.md 能说明阶段计划
```

### Stage 1: H5 Mock 跑通

目标：

```txt
写一个 index.html
写一个 bridge.js
模拟 window.ascfBridge.send
点击按钮后返回 mock response
```

验收标准：

```txt
浏览器打开 h5-demo/index.html
点击 toast.show 按钮
页面能显示 success response
点击 unknown.action 按钮
页面能显示 UNKNOWN_ACTION
```

### Stage 2: Bridge Core

目标：

```txt
实现协议类型
实现 dispatcher
实现 registry
实现 error response
```

验收标准：

```txt
action 存在时可以调用成功
action 不存在时返回 UNKNOWN_ACTION
params 不合法时返回 PARAM_ERROR
所有 response 格式统一
```

### Stage 3: Ability Plugins

目标：

```txt
新增 toast.show
新增 storage.set
新增 storage.get
新增 device.info
新增 network.status
```

验收标准：

```txt
每个 ability 有独立文件
每个 ability 有说明文档
每个 ability 有错误场景
```

### Stage 4: Debug Panel

目标：

```txt
展示请求日志
展示响应日志
展示耗时
展示错误码
支持复制 request JSON
```

验收标准：

```txt
页面上能看到完整调用链路
能清楚看到 H5 发了什么
能清楚看到 Native Mock 返回了什么
```

### Stage 5: ArkTS WebView Container

目标：

```txt
使用 HarmonyOS Web 组件加载 H5 页面
通过 javaScriptProxy 暴露 bridge 对象
H5 可以调用 ArkTS bridge 方法
ArkTS 可以通过 runJavaScript 回调 H5
```

验收标准：

```txt
H5 按钮点击后，ArkTS 侧能收到 request
ArkTS 侧 dispatch 后能返回 response
H5 页面能展示 response
```

### Stage 6: Offline Package Demo

目标：

```txt
模拟离线包加载
支持加载本地 h5-demo
支持版本号展示
支持 fallback 错误页
```

验收标准：

```txt
正常加载本地页面
加载失败时展示错误页
文档解释离线包解决的问题
```

### Stage 7: 文档和简历化

目标：

```txt
补充架构图
补充时序图
补充 README 截图
补充博客文章
补充简历描述
```

验收标准：

```txt
README 能让陌生人看懂项目
docs 能讲清楚架构
项目能作为求职展示项目
```

---

## 8. 文档规范

每完成一个核心模块，必须补充文档。

文档风格参考：

```txt
先讲为什么需要
再讲它是什么
然后讲怎么实现
最后讲调试和踩坑
```

不要一上来堆概念。

推荐文档模板：

```md
# xxx 模块说明

## 1. 为什么需要它？

说明问题背景。

## 2. 它解决了什么问题？

说明职责边界。

## 3. 它在架构中的位置

用简单图说明。

## 4. 核心流程

用步骤说明。

## 5. 关键代码

只贴关键代码，不贴大段无意义代码。

## 6. 常见错误

列出错误场景。

## 7. 小结

说明这个模块带来的架构价值。
```

---

## 9. README 要求

README 不是简单介绍项目，而是项目门面。

README 至少包含：

```txt
项目介绍
为什么做这个项目
核心架构图
功能列表
目录结构
快速开始
调用链路示例
错误码说明
调试面板截图
开发路线
学习笔记链接
免责声明
```

README 第一段建议：

```md
ASCF Mini Runtime Lab 是一个用于学习小程序容器、WebView JSBridge、H5 调 Native 能力、能力注册分发、离线包加载与调试链路的实验项目。

它不是 ASCF 官方实现，而是一个公开、安全、最小化的学习模型，用来帮助理解 Hybrid Runtime 的核心架构。
```

---

## 10. 代码风格

### 10.1 命名清晰

推荐命名：

```txt
BridgeRequest
BridgeResponse
BridgeDispatcher
AbilityRegistry
NativeAbility
BridgeError
ErrorCode
DebugLog
```

不推荐命名：

```txt
utils
common
handler
manager
test1
demo2
xxx
```

### 10.2 单一职责

一个文件尽量只做一件事。

例如：

```txt
protocol.ts       只定义协议
errors.ts         只定义错误码
registry.ts       只做注册表
dispatcher.ts     只做分发
toastAbility.ts   只做 toast 能力
```

### 10.3 不要过度封装

本项目是学习型架构项目，不要为了看起来高级而过度设计。

不要一开始就引入：

```txt
复杂依赖注入
复杂构建系统
复杂 monorepo
复杂状态管理
复杂权限系统
```

先让链路跑通，再逐步抽象。

---

## 11. 每次让 AI 开发时的工作方式

当使用 Claude Code / GPT / Cursor 开发本项目时，必须遵循以下流程：

```txt
1. 先读取 SKILL.md
2. 说明本次要做的目标
3. 说明会改哪些文件
4. 小步修改代码
5. 给出验证方式
6. 给出建议 commit message
7. 如有架构变化，更新 docs
```

每次任务输出格式建议：

```txt
本次目标：
修改文件：
核心思路：
验证方式：
建议提交：
后续下一步：
```

禁止行为：

```txt
不读项目结构就直接生成大量代码
一次性引入很多依赖
删除已有文档
修改无关文件
把 mock 项目写成真实公司项目
```

---

## 12. 给 AI 的通用开发提示词

后续可以使用这个提示词启动每次开发：

```txt
请先阅读项目根目录的 SKILL.md，然后基于当前仓库状态继续开发。

本次只做一个小目标：{这里填写目标}

要求：
1. 不要一次性生成过多代码。
2. 不要修改无关文件。
3. 所有新增模块必须符合 SKILL.md 的分层设计。
4. 如果新增了架构概念，请同步更新 docs。
5. 最后给出验证步骤和建议 commit message。
```

---

## 13. 第一阶段推荐任务

项目刚创建时，推荐第一批任务按下面顺序做。

### Task 1: 初始化文档骨架

目标：

```txt
创建 README.md
创建 docs/00-project-roadmap.md
创建 docs/01-why-jsbridge.md
创建 docs/diagrams/runtime-architecture.mmd
```

不要写代码，只写项目构思和路线。

### Task 2: 创建 H5 Demo

目标：

```txt
创建 h5-demo/index.html
创建 h5-demo/bridge.js
创建 h5-demo/style.css
实现一个假的 window.ascfBridge.send
```

验收：

```txt
浏览器打开 index.html
点击按钮能看到 response
```

### Task 3: 抽出 Bridge Core

目标：

```txt
创建 bridge-core/protocol
创建 bridge-core/registry
创建 bridge-core/dispatcher
```

验收：

```txt
toast.show 能正常返回
unknown.action 能返回 404
```

### Task 4: 加 Debug Log

目标：

```txt
每次请求生成一条 log
每次响应更新 log
记录耗时
页面展示日志
```

验收：

```txt
页面能看到 request / response / duration / code
```

### Task 5: 写第一篇文档

目标：

```txt
docs/01-why-jsbridge.md
```

文章结构：

```txt
从普通 H5 无法直接调用系统能力开始
引出 WebView 容器
引出 JSBridge
解释 H5 -> Native -> H5 的闭环
最后对应本项目实现
```

---

## 14. 简历表达方向

项目成熟后，可以这样写进简历：

```txt
ASCF Mini Runtime Lab：设计并实现一个迷你 Hybrid Runtime 实验项目，模拟小程序容器中的 H5 调 Native 能力链路。项目包含 JSBridge 协议设计、能力注册与分发、统一错误码、请求响应日志、调试面板、离线包加载实验和架构文档，用于沉淀 WebView 容器和小程序运行时架构理解。
```

更工程化的表达：

```txt
基于 WebView + JSBridge 思路实现 H5 与 Native Mock 的双向通信链路，抽象 Bridge Protocol、Ability Registry、Dispatcher、Ability Plugin 等模块，支持 UNKNOWN_ACTION、PARAM_ERROR、TIMEOUT 等异常场景复现，并提供 Debug Panel 展示 request、response、duration 和错误码，提升对 Hybrid Runtime 调试链路的理解。
```

---

## 15. 项目最终验收标准

这个项目不是以功能数量验收，而是以架构表达能力验收。

最终应该能回答这些问题：

```txt
1. 为什么 H5 不能直接调用 Native 能力？
2. JSBridge 在 WebView 容器里起什么作用？
3. requestId 为什么重要？
4. action 为什么要走注册表？
5. Dispatcher 和 Ability 为什么要分开？
6. UNKNOWN_ACTION 是怎么产生的？
7. PARAM_ERROR 应该在哪一层处理？
8. Native 如何主动回调 H5？
9. 离线包解决了什么问题？
10. 调试面板为什么对框架维护重要？
```

如果这些问题都能通过 README、docs、代码和 demo 讲清楚，这个项目就有价值。

---

## 16. 当前阶段最高优先级

现在不要急着写 ArkTS。
第一阶段先把核心链路用最简单方式跑通。

推荐当前目标：

```txt
先用 H5 + JavaScript Mock 实现完整链路：
H5 Button -> Bridge Request -> Dispatcher -> Registry -> Mock Ability -> Response -> Debug Log
```

等这个链路完全清楚后，再迁移到 HarmonyOS WebView / ArkTS。

原因：

```txt
先学架构，再接平台。
先跑通链路，再处理环境。
先做可演示闭环，再做工程扩展。
```

这是本项目从 0 到 1 的核心原则。
