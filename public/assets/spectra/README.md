# 谱图图片目录

在此目录下放置谱图图片文件，支持格式：PNG、JPG、SVG

## 已定义的题目图片：

| 图片文件名 | 对应题目 | 说明 |
|------------|----------|------|
| ir-cyclohexanone.png | q-55 | 环己酮的红外光谱图 |
| nmr-toluene.png | q-56 | 甲苯的核磁共振氢谱图 |
| nmr-ethyl-acetate.png | q-57 | 乙酸乙酯的核磁共振氢谱图 |
| ir-ethanol.png | q-58 | 乙醇的红外光谱图 |
| ir-ester.png | q-59 | 酯类化合物的红外光谱图 |
| nmr-methyl-butanone.png | q-60 | 3-甲基-2-丁酮的核磁共振氢谱图 |

## 图片建议规格：

- 宽度：800-1200px
- 格式：PNG（推荐）或 JPG
- 背景：白色或透明
- 内容：清晰显示谱图的横坐标（波数/化学位移）和纵坐标（吸收强度）

## 如何添加新的谱图题目：

1. 在 `src/data/mock.ts` 的 `MOCK_QUESTIONS` 数组中添加新题目
2. 为题目添加 `imageUrl: '/assets/spectra/your-image.png'` 字段
3. 将图片文件放置到此目录
4. 确保图片文件名与 imageUrl 中指定的一致
