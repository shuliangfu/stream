#!/bin/bash

# 启动 SRS 流媒体服务器
# 用于视频推流示例

echo "正在启动 SRS 流媒体服务器..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo "❌ 错误: Docker 未运行，请先启动 Docker"
  exit 1
fi

# 检查 SRS 容器是否已存在
if docker ps -a | grep -q "srs"; then
  echo "发现已存在的 SRS 容器，正在启动..."
  docker start srs
else
  echo "创建新的 SRS 容器..."
  docker run -d \
    -p 1935:1935 \
    -p 8080:8080 \
    -p 1985:1985 \
    --name srs \
    ossrs/srs:latest
fi

# 等待 SRS 启动
echo "等待 SRS 服务器启动..."
sleep 3

# 检查 SRS 是否正常运行
if curl -s http://localhost:1985/api/v1/summaries > /dev/null 2>&1; then
  echo "✅ SRS 服务器已成功启动！"
  echo ""
  echo "服务地址:"
  echo "  - RTMP 推流/拉流: rtmp://localhost:1935/live/xxx"
  echo "  - HTTP API: http://localhost:1985"
  echo "  - HTTP 播放 (HLS): http://localhost:8080/live/xxx/playlist.m3u8"
  echo ""
  echo "现在可以运行推流示例了:"
  echo "  deno run -A examples/video-file-publish-srs.ts"
else
  echo "⚠️  警告: SRS 服务器可能还在启动中，请稍等片刻后再试"
  echo "查看日志: docker logs srs"
fi
