# 探针：回合生命周期钩子

**只打日志，不干预。** 用来回答「DSH 的三个回合控制点到底什么时候触发」。

## 为什么需要它

官方文档说了 `agent/turn-stopping` / `agent/pre-step` / `agent/request-error` **能做什么**，
但没说清**什么时候触发、触发几次、payload 长什么样**。那些只能实测。

## 怎么跑（隔离沙箱，不碰你的 desktop profile）

```bash
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
SB=/tmp/dsh-sandbox

# 1. 建沙箱：以 headless 为模板，node_modules 软链到宿主（避免重装）
rm -rf "$SB"; mkdir -p "$SB/profiles"
cp -R ~/.dsh/profiles/headless "$SB/profiles/probe"
ln -s ~/.dsh/profiles/node_modules "$SB/profiles/node_modules"
ln -sfn "$(pwd)" "$SB/profiles/node_modules/dsh-probe-turn-hooks"

# 2. 把探针加进 bundles
#    （在 $SB/profiles/probe/package.json 的 dsh.profile.bundles 里加 dsh-probe-turn-hooks）

# 3. 验证挂载（不启动）
DSH_HOME="$SB" "$DSH" --profile probe --dump-config | grep -A3 probe-turn-hooks

# 4. 跑
DSH_HOME="$SB" MAGPIE_GATEWAY_KEY=<你的凭据> "$DSH" --profile probe "说三个字"
```

## 两个坑

1. **隔离的 `DSH_HOME` 里没有凭据。** profile 写的是 `apiKeyEnv: MAGPIE_GATEWAY_KEY`，
   但光复制 `.credentials.yaml` 不够 —— 凭据服务在沙箱里解析不出来。
   **直接注入环境变量就通。**
2. **凭据缺失时的报错有误导性** —— 可能表现为 `Cannot read properties of undefined (reading 'kind')`，
   看起来像插件搞坏了什么。**先确认凭据，再怀疑自己的代码。**

## 实测到的时序（一个完整回合）

```
 239ms  ★ pre-step            { messages, turn, step, signal, agent }
 244ms  assistant-stream      { frame, agent }
1791ms  assistant-stream ×8
1800ms  ★ turn-stopping       { turn: 1, signal, agent }
1800ms  agent/status
```

`pre-step` 和 `turn-stopping` **每回合各触发 1 次**，中间 1.56 秒就是模型调用。
