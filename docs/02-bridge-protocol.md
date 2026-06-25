# 02 · Bridge Protocol：统一协议

> 对应代码：[bridge-core/protocol/bridgeProtocol.js](../bridge-core/protocol/bridgeProtocol.js)、[bridge-core/errors/bridgeErrors.js](../bridge-core/errors/bridgeErrors.js)

## 1. 为什么需要统一协议

Stage 1 时，能力直接自己拼返回值：toast 返回一种结构、device 返回另一种结构、出错时又是第三种结构。

调用方（H5）会很痛苦：每加一个能力，就要为它写一套「怎么读结果、怎么判断成功、怎么读错误」的代码。能力越多，H5 越乱。

根因是：**没有约定**。所以第一步不是写能力，而是先把「请求长什么样、响应长什么样、错误怎么表达」钉死。这就是 Bridge Protocol。

## 2. 它是什么

一句话：协议是 H5 与 Native 之间的**契约**。它只规定「形状」，不关心任何具体业务。

**Request 结构**（由 H5 侧构造，见 `h5-demo/bridge.js` 的 `createRequest`）：

```txt
id        请求唯一 id，response 必须原样带回，用于配对
version   协议版本
action    要调用的能力名，如 "toast.show"
params    请求参数，可为空，但必须是对象
```

**Response 结构**（成功与失败同构）：

```json
{ "id": "req_001", "action": "toast.show", "code": 0,   "msg": "success",        "data": { "shown": true } }
{ "id": "req_002", "action": "toast.show", "code": 400, "msg": "PARAM_ERROR",    "data": { "reason": "params.message is required" } }
```

成功与失败**字段完全一样**，区别只在 `code`。H5 只需判断 `code === 0`，无需为每个能力写不同的解析逻辑。

**统一错误码**（`bridgeErrors.js`）：

| code | msg | 含义 |
| --- | --- | --- |
| `0` | `SUCCESS` | 成功 |
| `400` | `PARAM_ERROR` | 参数缺失 / 非法 |
| `404` | `UNKNOWN_ACTION` | action 未注册 |
| `408` | `TIMEOUT` | 调用超时 |
| `500` | `INTERNAL_ERROR` | 能力内部异常 |

## 3. 怎么做（本项目实现）

协议层只暴露四个纯函数，不持有任何状态：

```js
// 校验请求结构；返回 { valid, reason }，不抛错（交给 dispatcher 决定如何包装）
validateBridgeRequest(request)

// 成功响应：code = 0, msg = "success"
createSuccessResponse(request, data)

// 错误响应：code / msg / data 由调用方传入
createErrorResponse(request, code, msg, data)

// 给 ability 表达"业务级错误"用的信封：{ __bridgeError, code, msg, data }
abilityError(code, msg, data)
```

几个关键约定：

- **`validateBridgeRequest` 不抛错**：它只回报「合不合法」，由 dispatcher 统一转成 `400 PARAM_ERROR`。校验与包装分离。
- **`params` 默认成对象**：缺失时校验函数会把它补成 `{}`，能力里就不用到处判空。
- **错误也走协议**：能力不能自己拼错误结构。它要么正常返回 data，要么返回 `abilityError(...)` 信封，最终都由 `createErrorResponse` 统一包装（见 [04-dispatch-flow.md](04-dispatch-flow.md)）。

## 4. 小结

协议是整条链路的地基。先把 request / response / 错误码钉死，后面的注册表、分发器、能力才能各司其职，而 H5 永远只面对同一种响应结构。
