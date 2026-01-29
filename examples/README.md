# 示例说明

## 视频文件推流示例

### 1. video-file-publish.ts（FFmpeg 适配器）

**⚠️ 需要先启动 RTMP 服务器**

此示例使用 FFmpeg 适配器，但需要先启动一个 RTMP 服务器（如 SRS 或
nginx-rtmp）才能正常工作。

**启动 SRS 服务器（推荐）：**

**方式 1：使用启动脚本（最简单）**

```bash
# 运行启动脚本
./examples/start-srs.sh
```

**方式 2：手动启动 Docker 容器**

```bash
# 使用 Docker 启动 SRS
docker run -d \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 1985:1985 \
  --name srs \
  ossrs/srs:latest

# 如果容器已存在，只需启动它
docker start srs
```

**方式 3：使用本地安装的 SRS**

参考: https://github.com/ossrs/srs

**验证 SRS 是否运行：**

```bash
# 检查容器状态
docker ps | grep srs

# 或访问 API
curl http://localhost:1985/api/v1/summaries
```

**运行示例：**

```bash
# Deno
deno run -A examples/video-file-publish.ts

# Bun
bun run examples/video-file-publish.ts
```

### 2. video-file-publish-srs.ts（SRS 适配器，推荐）

此示例使用 SRS 适配器，会自动连接到已运行的 SRS 服务器，并生成 HLS 播放地址。

**前提条件：**

- 需要先启动 SRS 服务器（见上方）

**运行示例：**

```bash
# Deno
deno run -A examples/video-file-publish-srs.ts

# Bun
bun run examples/video-file-publish-srs.ts
```

**优势：**

- 自动生成 HLS 播放地址，可在浏览器中直接播放
- 支持多种播放协议（RTMP、HLS、FLV、WebRTC）
- 更好的流管理和统计功能

## 播放流

### 使用 mpv 播放 RTMP 流

```bash
# 确保 RTMP 服务器已启动，并且推流已开始
mpv rtmp://localhost:1935/live/stream-xxx
```

### 使用 VLC 播放 RTMP 流

```bash
vlc rtmp://localhost:1935/live/stream-xxx
```

### 在浏览器中播放 HLS 流（使用 SRS 适配器）

打开浏览器访问：

```
http://localhost:8080/live/stream-xxx/playlist.m3u8
```

或在 HTML 中使用：

```html
<video src="http://localhost:8080/live/stream-xxx/playlist.m3u8" controls>
</video>
```

## 常见问题

### 1. 连接被拒绝（Connection refused）

**原因：** RTMP 服务器未启动

**解决：** 先启动 SRS 服务器（见上方）

### 2. 推流失败

**原因：**

- RTMP 服务器未启动
- 推流地址不正确
- 视频文件不存在

**解决：**

- 检查 SRS 服务器是否运行：`docker ps | grep srs`
- 检查推流地址是否正确
- 确认视频文件路径正确

### 3. 无法播放流

**原因：**

- 推流还未开始
- 播放地址不正确
- RTMP 服务器未运行

**解决：**

- 等待推流开始后再播放
- 使用示例输出的播放地址
- 确保 RTMP 服务器正在运行
