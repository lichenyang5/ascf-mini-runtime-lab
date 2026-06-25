# Ability Plugins：为什么能力要插件化？

> 对应代码：[ability-plugins/](../ability-plugins/)、[bridge-core/registry/abilityRegistry.js](../bridge-core/registry/abilityRegistry.js)、[h5-demo/bridge.js](../h5-demo/bridge.js)

## 1. 为什么不把所有 action 写在 dispatcher 里？

最直接的写法，是在 dispatcher 里用 `if / else` 按 action 分流：

```js
if (action === 'toast.show') { ... }
else if (action === 'device.info') { ... }
else if (action === 'storage.set') { ... }
else if (action === 'storage.get') { ... }
// ……每加一个能力，这里就长一截
```

问题很现实：

- dispatcher 会随能力数量不断膨胀，越来越难读；
- 加一个能力要回去改这段公共逻辑，容易碰坏已有能力；
- 「分发」和「业务」混在一起，职责不清。

本项目这一阶段一口气加了 4 个能力（storage.set / storage.get / network.status / clipboard.write），如果都堆进 dispatcher，它会立刻失控。所以正确做法是反过来：**让 dispatcher 保持极薄，把能力做成可插拔的插件。**

## 2. Ability Plugin 是什么？

一个 ability 就是一个最小对象，只关心自己的 `params` 和返回的 `data`：

```js
{
  action: 'storage.set',
  handle: function (params, request) {
    // 只做自己的事：校验 params -> 返回 data（或 abilityError 信封）
  }
}
```

它**不拼最终 response**，也**不认识 dispatcher**。成功就返回 data；参数不对就返回 `abilityError(...)` 信封；出了意外就抛异常。怎么包装成统一 response，是 dispatcher 的事（见 [04-dispatch-flow.md](04-dispatch-flow.md)）。

一个文件可以提供一个能力，也可以提供多个。例如 `storageAbility.js` 同时导出 `storage.set` 和 `storage.get`，以数组形式交给组装层注册。

## 3. Registry 如何让能力可扩展？

注册表（[03-ability-registry.md](03-ability-registry.md)）把「有哪些能力」变成一份**数据**，而不是写死的代码分支。新增能力只需 `register`，dispatcher 一个字都不用改：

```js
// h5-demo/bridge.js 组装层
registerAll([
  AbilityPlugins.toastAbility,        // toast.show
  AbilityPlugins.deviceAbility,       // device.info
  AbilityPlugins.storageAbilities,    // storage.set + storage.get（数组）
  AbilityPlugins.networkAbility,      // network.status
  AbilityPlugins.clipboardAbility     // clipboard.write
]);
```

dispatcher 始终只做四件事：校验 → 查表 → 调用 → 包装。能力是 0 个还是 100 个，它都长一个样。

## 4. 本项目已经支持哪些能力？

| action | 文件 | 说明 |
| --- | --- | --- |
| `toast.show` | `ability-plugins/toast/toastAbility.js` | 展示文案；缺 message → PARAM_ERROR |
| `device.info` | `ability-plugins/device/deviceAbility.js` | 返回 mock 设备信息 |
| `storage.set` | `ability-plugins/storage/storageAbility.js` | 写入 key/value（localStorage Mock）；缺 key/value → PARAM_ERROR |
| `storage.get` | `ability-plugins/storage/storageAbility.js` | 读取 key；key 不存在时 `code=0` 且 `value=null` |
| `network.status` | `ability-plugins/network/networkAbility.js` | 返回 mock 网络状态 |
| `clipboard.write` | `ability-plugins/clipboard/clipboardAbility.js` | 写剪贴板；不支持时返回 `mock:true` |

## 5. 新增一个能力需要几步？

1. **新建 ability 文件**：在 `ability-plugins/<name>/` 下建一个 js 文件；
2. **定义 action**：起一个唯一的 action 名，如 `storage.set`；
3. **实现 handle**：校验 `params`，返回 `data` 或 `abilityError(...)`；
4. **在 registry 注册**：在 `h5-demo/bridge.js` 的 `registerAll([...])` 里加一行；
5. **在 H5 页面增加测试入口**：在 `index.html` 加一个按钮，并在 `bindUi` 里绑定。

（浏览器直接打开方式下，第 1 步的新文件还要在 `index.html` 里加一行 `<script>` 引用——因为没有打包器，靠经典 script 顺序加载。）

全程**不需要改 dispatcher、protocol、registry**。这正是插件化的收益。

## 6. 常见错误

| 现象 | 根因 | 统一响应 |
| --- | --- | --- |
| action 未注册 | registry 里没有这个 action | `code 404` / `UNKNOWN_ACTION` |
| params 缺失 / 非法 | 能力校验不通过（返回 abilityError）或协议校验失败 | `code 400` / `PARAM_ERROR` |
| ability 内部异常 | `handle` 抛出未预期的错误 | `code 500` / `INTERNAL_ERROR` |

不论哪种错误，H5 拿到的都是同一种结构 `{ id, action, code, msg, data }`，只看 `code` 即可判断。
