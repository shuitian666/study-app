# 防风正式图库试用

2026-09-23 已按资料提供者授权，将防风资料导入本机正式图库 `server/data`，并发布为全部登录用户可见。登录后从 AI 中心进入「专业工具 → 求真」查看；本机应用地址为 `http://localhost:3001`。

导入前已备份原数据库到 `output/truth-library/before-apply-2026-09-23T06-31-28-803Z.sqlite`。来源目录原文件未被修改。导入后图库包含 690 张按内容去重的图片、332 份 PDF；其中 8 份文件夹 PDF 关联到同目录的 42 张照片。图片批次采用“待核对”标记，观察文字明确说明只是按目录与文件名整理，尚未人工确认真实实验批次和跨时间动物身份。

本机验证记录为 `output/truth-library/local-trial-verification.json`，截图为 `formal-gallery-390.png`、`formal-gallery-1440.png`、`formal-pdf-390.png`、`formal-pdf-1440.png`。普通账号可浏览 690 张，检索“防风 给药第三天 雌性 实验前”返回 24 张，原图和 PDF 可鉴权打开，上传被拒绝；浏览器控制台无错误。试用检查创建的短期会话在检查结束时已删除。

## 后续维护

以下命令要求显式指定真实数据目录；导入程序拒绝隔离测试库。再次执行导入会识别带有本次标记的同源图片，不重复创建资料。每次修改状态前都会生成新的数据库备份。

```powershell
# 只扫描并显示预计导入数量
node scripts/truth-import-fangfeng-library.mjs --plan --source 'C:\Users\35460\Desktop\防风\防风\原始数据' --data-dir 'server/data'

# 导入并发布到指定图库（首次导入已执行）
node scripts/truth-import-fangfeng-library.mjs --apply --source 'C:\Users\35460\Desktop\防风\防风\原始数据' --data-dir 'server/data'

# 试用不合适时，从图库撤下本次资料；已生成的报告仍保留历史依据
node scripts/truth-import-fangfeng-library.mjs --archive --data-dir 'server/data'

# 如需重新开放
node scripts/truth-import-fangfeng-library.mjs --restore --data-dir 'server/data'
```

当前试用数据位于这台电脑的 Git 忽略目录，**上传代码不会把图片和 PDF 带到线上服务器**。`main` 的 CI 通过后会自动部署阿里云；用户试用确认后，再合入 `main`，随后通过受控的数据传输将源资料导入服务器的独立数据目录。上线前要备份线上 SQLite 与 `truth-images`，确认服务器管理员身份和空间，并用普通账号复测检索、原图及 PDF。不要把 235 MB 的原始资料或数据库提交到 Git 仓库。
