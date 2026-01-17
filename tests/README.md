# 测试文档

## 测试结构

```
tests/
├── utils/              # 工具函数测试
│   ├── errors.test.ts
│   ├── protocol.test.ts
│   ├── state.test.ts
│   ├── cache.test.ts
│   ├── queue.test.ts
│   ├── connection-pool.test.ts
│   ├── stream-cache.test.ts
│   ├── batch-operations.test.ts
│   ├── reconnect.test.ts
│   ├── id.test.ts
│   └── url.test.ts
├── adapters/           # 适配器测试
│   └── ffmpeg.test.ts
├── integration/        # 集成测试
│   └── stream-lifecycle.test.ts
└── manager.test.ts     # 管理器测试
```

## 运行测试

### 运行所有测试
```bash
deno test tests/
```

### 运行特定测试文件
```bash
deno test tests/utils/errors.test.ts
```

### 运行测试并显示覆盖率
```bash
deno test --coverage=cov_profile tests/
deno coverage cov_profile
```

### 运行测试并监听文件变化
```bash
deno test --watch tests/
```

## 测试覆盖范围

### ✅ 已覆盖

1. **工具函数**
   - ✅ 错误类（所有错误类型）
   - ✅ 协议检测和验证
   - ✅ 状态转换和验证
   - ✅ LRU 缓存
   - ✅ 数据队列
   - ✅ 连接池
   - ✅ 流信息缓存
   - ✅ 批量操作
   - ✅ 重连管理器
   - ✅ ID 生成
   - ✅ URL 生成

2. **适配器**
   - ✅ FFmpeg 适配器（基本操作）

3. **管理器**
   - ✅ StreamManager（流和房间管理）

4. **集成测试**
   - ✅ 流生命周期
   - ✅ 房间和流关联
   - ✅ 批量操作

### ⚠️ 待补充

1. **客户端功能**
   - ⚠️ ClientPublisher 测试
   - ⚠️ ClientSubscriber 测试
   - ⚠️ WebRTC 功能测试

2. **服务端功能**
   - ⚠️ ServerPublisher 测试
   - ⚠️ ServerSubscriber 测试
   - ⚠️ Socket.io 集成测试

3. **适配器**
   - ⚠️ SRS 适配器测试
   - ⚠️ 其他适配器测试

4. **高级功能**
   - ⚠️ 录制功能测试
   - ⚠️ 转码功能测试
   - ⚠️ 性能测试

## 测试最佳实践

1. **单元测试**：每个工具函数和类都应该有对应的测试
2. **集成测试**：测试多个组件协同工作
3. **错误处理**：测试各种错误情况
4. **边界条件**：测试边界值和极端情况
5. **异步操作**：确保异步操作正确测试

## 注意事项

- 某些测试可能需要实际的流媒体服务器（如 SRS）
- WebRTC 测试需要在浏览器环境中运行
- 某些测试可能需要模拟外部依赖（如 FFmpeg）
