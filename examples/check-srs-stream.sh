#!/bin/bash

# 检查 SRS 流状态和 HLS 文件

echo "=== 检查 SRS 流状态 ==="

# 检查 SRS API
echo "1. 检查 SRS API 连接..."
if curl -s http://localhost:1985/api/v1/summaries > /dev/null 2>&1; then
  echo "   ✅ SRS API 可访问"
else
  echo "   ❌ SRS API 不可访问，请检查 SRS 是否运行"
  exit 1
fi

# 获取当前流列表
echo ""
echo "2. 当前活跃的流:"
STREAMS=$(curl -s "http://localhost:1985/api/v1/streams/" 2>/dev/null)
if echo "$STREAMS" | grep -q '"streams":\[\]' || echo "$STREAMS" | grep -q '"code":0'; then
  echo "   ⚠️  当前没有活跃的流"
  echo "   请先运行推流示例: deno run -A examples/video-file-publish-srs.ts"
else
  echo "$STREAMS" | python3 -m json.tool 2>/dev/null || echo "$STREAMS"
fi

# 检查 HLS 文件
echo ""
echo "3. 检查 HLS 文件目录:"
if docker ps | grep -q srs; then
  echo "   检查容器内的 HLS 文件..."
  docker exec srs find /usr/local/srs/objs/nginx/html/live -name "*.m3u8" -o -name "*.ts" 2>/dev/null | head -10
  if [ $? -eq 0 ] && [ -n "$(docker exec srs find /usr/local/srs/objs/nginx/html/live -name '*.m3u8' 2>/dev/null)" ]; then
    echo "   ✅ 找到 HLS 文件"
  else
    echo "   ⚠️  未找到 HLS 文件"
    echo "   可能原因："
    echo "     - 推流还未开始或已停止"
    echo "     - 需要等待几秒让 SRS 生成 HLS 文件"
    echo "     - 推流格式不支持 HLS（需要 H.264 + AAC）"
  fi
else
  echo "   ⚠️  SRS 容器未运行"
fi

echo ""
echo "=== 检查完成 ==="
