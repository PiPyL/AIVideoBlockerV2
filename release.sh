#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Lấy version từ manifest.json
VERSION=$(grep '"version"' manifest.json | head -1 | awk -F '"' '{print $4}')
echo "🚀 Bắt đầu release phiên bản v$VERSION..."

# Cập nhật package.json version để đồng bộ
if [ -f "package.json" ]; then
  sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
  echo "✅ Đã đồng bộ version trong package.json"
fi

# Tên file zip
ZIP_NAME="safekid-v$VERSION.zip"

# Xóa file zip cũ nếu có
if [ -f "$ZIP_NAME" ]; then
    rm "$ZIP_NAME"
fi

# Đóng gói tiện ích
echo "📦 Đang đóng gói tiện ích vào $ZIP_NAME..."
zip -r "$ZIP_NAME" _locales background content icons popup styles utils manifest.json free_models.json -x "*.DS_Store"

echo "📝 Đang commit code..."
git add .
git commit -m "🔖 Release v$VERSION" || echo "Không có thay đổi nào để commit"

echo "🏷️ Đang tạo tag v$VERSION..."
# Nếu tag đã tồn tại thì xóa đi tạo lại hoặc bỏ qua
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo "Tag v$VERSION đã tồn tại, bỏ qua tạo tag."
else
    git tag -a "v$VERSION" -m "Release version $VERSION"
fi

echo "⬆️ Đang push code và tag lên GitHub..."
git push origin main
git push origin "v$VERSION"

echo "🌐 Đang tạo GitHub Release..."
if gh release view "v$VERSION" >/dev/null 2>&1; then
    echo "Release v$VERSION đã tồn tại. Đang upload lại file zip..."
    gh release upload "v$VERSION" "$ZIP_NAME" --clobber
else
    gh release create "v$VERSION" "$ZIP_NAME" --title "SafeKid v$VERSION" --notes "Release version $VERSION"
fi

echo "✅ Release hoàn tất thành công!"
