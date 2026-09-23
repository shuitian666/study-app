# 求真图库：实现与验收

本次提供全部登录用户可浏览的已发布图库、结构化筛选与自然语言条件提示、分页、原图缩放、2–4 图对照、PDF 附件、历史报告及引用原图查看。没有新增 AI 读图、自动测温或 PDF 内容提取。报告继续依据已确认元数据生成。

## 权限与数据

- 普通用户仅可访问已发布资料；管理员和超级管理员发布、归档；副管理员上传、编辑与提交审核。
- 上传无论传入什么状态都创建草稿。已发布及归档资料编辑形成独立待审核修订，发布后原子切换并增加版本；待发布 PDF 不向普通用户暴露。
- `truth_assets` 增加实验分组、实验前后、图片类型、相对来源路径、采集编号、版本和待审核修订。新增 `truth_asset_versions` 与 `truth_attachments`，迁移为增量建表/加列。历史缺失字段保持未知；不恢复或猜测旧流程清空过的对照组时间。
- 已生成报告保留生成时的元数据版本、附件引用。原图文件不被编辑替换。归档资料仅管理者及确实引用过它的报告所有者可读取；报告之间按账号隔离。
- 采集 PDF 跨图片关联要求采集编号、批次、分组、性别、动物编号、阶段、观察时间和实验前后全部一致。另经资料提供者确认，非动物编号目录中的 `images.pdf` 适用于其所在文件夹的所有照片；导入时只按同一直接目录关联，并在发布前让附件保持草稿状态。一份 PDF 只保存一次，通过关联表从各照片查看。
- 修复登录及账号恢复接口遗漏会话令牌的问题，避免切换账号后请求继续携带上一账号的令牌。图库和报告状态按账号重置。

## 接口

- `GET /api/truth/library`：登录后可用；支持 `query`、`limit`（默认 48、最大 200）、`offset` 及平铺的筛选参数。返回 `assets,total,limit,offset,hasMore,filter,recognizedConditions,unrecognizedTerms,warnings,clarification,availableValues`。空查询浏览全部已发布资料；不能识别的查询不能伪装成“完全匹配”。
- `GET /api/truth/assets`：继续要求管理权限，支持分页及总数。普通用户不借用管理接口。
- `POST /api/truth/assets/:id/attachments`：有上传权限的账号使用 multipart `attachments` 上传 PDF；可附 `metadata.sourcePaths`，返回逐文件成功、重复、失败结果。仅合法 PDF 类型、头尾标识和每份 64 MB 限额内文件被接受。目录级多图关联仅在隔离导入、资料为草稿且源路径为同一直接目录时建立，不通过上传参数自动扩大关联范围。
- `GET /api/truth/attachments/:id/preview`、`download`：按关联资料及报告引用校验访问。图片、PDF 和报告文件均经客户端的认证请求转成临时 URL；查看器卸载或账号变化时中止请求并释放 URL。
- 现有报告接口兼容；生成可传 `assetVersions`，资料版本变化时返回 409，要求重新选择。报告历史支持原图及其历史记录查看。

## 防风测试与复跑

源目录：`C:\Users\35460\Desktop\防风\防风\原始数据`。原文件仅被读取和复制，未修改。隔离测试验收完成后，资料提供者授权将同一批资料导入本机正式图库供试用；详见 `docs/truth-library-trial.md`。线上服务器尚未导入。

```powershell
# 仅扫描、SHA 去重、生成来源及待核对清单
node scripts/truth-import-fangfeng.mjs --source 'C:\Users\35460\Desktop\防风\防风\原始数据'

# 构建后启动独立测试服务（自动选择空闲端口，可用 TRUTH_VERIFY_PORT 指定）
npm run build
node scripts/truth-verification-server.mjs --source 'C:\Users\35460\Desktop\防风\防风\原始数据'

# 另一个终端执行；自动从忽略目录读取本次服务和测试账号
node scripts/verify-truth.mjs
node scripts/verify-truth-recovery.mjs

# 回归检查
node --test server/truth.test.mjs server/admin-mail.test.mjs server/ai-v2.test.mjs scripts/truth-import-fangfeng.test.mjs
npm run lint -- --ignore-pattern 'android/app/build/**'
```

测试导入强制使用操作系统临时目录中带 `.truth-test-only` 标记的独立数据目录。复制件使用本次导入时间，避免历史资料的旧时间戳影响临时目录回收；源文件保持不变。测试账号密码和令牌仅保存在被 Git 忽略的 `output/truth-verification/connection.local.json`，不提交、不输出到控制台。测试服务没有配置实际模型密钥，报告使用现有资料整理兜底。

| 防风资料核对 | 结果 |
| --- | ---: |
| 源 JPG / PDF | 786 / 596 |
| 独立图片 / 独立 PDF | 690 / 332 |
| 图片副本 / PDF 副本 | 96 / 264 |
| 可明确配对的 IRI / VIS 采集 | 324 |
| 已关联 PDF / 待核对 PDF | 332 / 0 |
| 经确认的目录级 PDF / 覆盖图片 | 8 / 42 |
| 缺少阶段仍保留的图片 | 42 |
| 给药第三天、雌性、实验前 | 24 |
| 给药第三天、雌性、实验后 | 24 |
| 空白组、给药第三天 | 24 |

来源完整清单、导入结果、待核对清单分别保存在 `output/truth-verification/manifest.json`、`summary.json`、`review.json`。此前 8 份待核对 PDF 已由资料提供者确认按同目录全部照片关联，其中 `文本记录/images.pdf` 约 40 MB；PDF 待核对项现为 0。批次使用明确的 TEST 标识，各时间目录不自动当作同一真实实验批次；图片身份等其他候选元数据正式入库前仍需管理员核对。

验收证据为同目录下 `verification.json`、`recovery-verification.json` 和 390/768/1440 宽度的图库、查看器、对照截图，以及 `report.png`、`admin-review.png`。检查包括全部原图及已关联 PDF 的 SHA-256 内容核对、8 份目录 PDF 仅出现在同目录 42 张照片、40 MB PDF 的令牌访问、无 Cookie 认证、全部 690 图可达、角色及报告归属、实际登录切换账号、发布隔离、文件查看和下载、键盘焦点、错误恢复及零非预期控制台错误。37 项相关自动测试通过。

当前 ESLint 配置已排除 Android 构建产物，默认 `npm run lint` 通过。Android 真机的 PDF 内嵌预览与原生下载未验证；移动浏览器通过并不能替代真机验收。

## 发布与排查

部署前备份数据库与 `truth-images` 目录，先在预发布环境验证普通账号与副管理员流程，再按既有发布流程上线。`TRUTH_MODE_ENABLED=false` 可关闭整个求真功能，增量表和原图无需删除。此次未进行线上部署。

后端对图库检索、图片与附件读取失败记录状态和资料 ID；前端对加载与解码失败给出重试或重新登录入口。排查顺序为访问权限、文件是否存在、元数据是否已发布、筛选条件及未识别提示。日志不记录登录令牌或原始文件内容。

Figma 布局与交互状态说明： https://www.figma.com/design/KvtmF76z2xvHnN55GDXSKB 。实际响应式效果以本次浏览器截图为准。
