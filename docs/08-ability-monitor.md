# Ability Monitor：为什么需要按能力统计调用？

> 对应代码：[runtime/AbilityMonitor.js](../runtime/AbilityMonitor.js)、[runtime/Runtime.js](../runtime/Runtime.js)

## 1. Debug Log 解决了什么，没解决什么？

Debug Panel（见 [06-debug-panel.md](06-debug-panel.md)）记录每一次调用——request、response、duration、code、msg 一条不漏。它擅长回答**单次**问题：

- 这次发出去的 request 长什么样？
- Native Mock 回了什么？
- 这一条慢了多少？

但它**按时间线展开**，于是有些问题它讲不清：

- 哪个 action 调用最多？
- 哪个 action 最容易失败？
- 哪个 action 平均耗时最高？

要回答这些，你得在脑子里把 100 条单次日志按 action 聚合一遍——这不该是人的工作。

## 2. Ability Monitor 是什么？

Ability Monitor 是一个**按 action 维度的累计统计器**。它做的事和 Debug Panel 完全不一样：

- DebugPanel 是「**账单**」：一笔一笔，时间序；
- AbilityMonitor 是「**报表**」：按 action 聚合，跨时间。

实现上它是 Runtime EventBus 的一个**订阅者**，不参与主链路分发——和 DebugPanel 一样属于旁路观测层：

```txt
H5 → Protocol → Dispatcher → Registry → Ability → Response   主链路
                  │
                  └─ events.emit('request:finished' | 'request:error')
                          ├─ DebugPanel.record   单次账单
                          └─ AbilityMonitor      按 action 聚合
```

## 3. 它监听哪些事件？

只两个，都来自 EventBus：

- `request:finished`（`code === 0`，由 Runtime.dispatch 在成功时 emit）
- `request:error`（`code !== 0`，由 Runtime.dispatch 在失败时 emit）

payload 都是 `{ request, response, duration }`。Monitor 不区分 finished / error，只看 `response.code` 决定计入 success 还是 failure。

## 4. 它统计什么？

对每个 action 维护一份状态：

| 字段 | 含义 |
| --- | --- |
| `action` | 能力名 |
| `total` | 累计调用次数 |
| `success` | `code === 0` 的次数 |
| `failure` | `code !== 0` 的次数 |
| `avgDuration` | 累计耗时 / total（毫秒，保留两位） |
| `maxDuration` | 历次耗时的最大值 |
| `lastCode` | 最近一次 response.code |
| `lastMsg` | 最近一次 response.msg |
| `lastCalledAt` | 最近一次记录时间戳 |

读取方式：

```js
MiniRuntimeDevtools.runtime.getAbilityMonitor().getStats()        // 全量数组
MiniRuntimeDevtools.runtime.getAbilityMonitor().getStatsByAction('toast.show')
MiniRuntimeDevtools.runtime.getAbilityMonitor().reset()
```

## 5. 它和 DebugPanel 的区别

| 维度 | DebugPanel | AbilityMonitor |
| --- | --- | --- |
| 视角 | 单次调用账单 | 按 action 累计报表 |
| 数据形态 | 日志数组（时间序） | action -> 状态对象（聚合） |
| 主要回答 | "这次出了什么？" | "哪个能力最忙 / 最容易出错 / 最慢？" |
| 接入方式 | Runtime.dispatch 直接 `record(entry)` | EventBus 订阅 `request:finished/error` |
| 清空 | `clear()` 清空日志 | `reset()` 重置统计 |

两者职责互补：单次定位用 DebugPanel，趋势/瓶颈分析用 AbilityMonitor。

## 6. 后续能扩展什么？

EventBus 已经把订阅口子开好了——下面这些都不需要回头改 Runtime：

- **PerformanceMonitor**：订阅同样的事件，做 duration 分布（P50 / P95 / P99）。
- **Runtime Timeline**：把所有事件按时间轴渲染，做"调用全景图"。
- **README 自动生成能力统计**：用 `getStats()` 在构建时生成能力使用情况快照。
- **异常能力报警**：监听 `failure` 增量，超过阈值时 `console.warn` 或上报。
