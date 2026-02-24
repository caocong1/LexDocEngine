# 法律备忘录模板使用说明

## 模板文件

- `legal-memo-template.dotx` - 原始完整模板（包含 Logo、页眉页脚等）
- `simple-template.dotx` - 简化模板（待创建，用于快速测试）

## Carbone 占位符语法

Carbone 使用 `{d.变量名}` 作为占位符：

```
{d.title}              - 文档标题
{d.client_name}        - 客户名称
{d.case_title}         - 案件标题
{d.date}               - 日期
{d.basic_facts}        - 基础事实
{d.legal_opinion}      - 法律意见（AI生成的主要内容）
{d.recommendations}    - 建议
{d.law_firm}           - 律所名称
```

## 方案 A：简化模板结构（当前使用）

```
法律意见

基础事实：
{d.basic_facts}

法律分析：
{d.legal_opinion}

生成时间：{d.date}
```

## 方案 B：完整专业模板结构

```
致：{d.client_name}
关于 {d.case_title} 之法律备忘录

敬启者：

我们接受委托，就 {d.case_title} 相关事宜，根据相关法律法规及司法实践，出具本法律备忘录，供参考。

一、基本事实

{d.basic_facts}

二、法律分析意见

{d.legal_opinion}

三、后续建议

{d.recommendations}

以上意见仅供参考。

{d.law_firm}
{d.date}
```

## 如何修改现有模板添加占位符

1. 用 Microsoft Word 打开 `legal-memo-template.dotx`
2. 删除具体案例内容（保留格式）
3. 在需要插入内容的位置输入占位符，例如 `{d.legal_opinion}`
4. 保存为新模板文件
5. 更新后端代码使用新模板

## 当前实现状态

目前后端使用的是 HTML 直接转 DOCX 的方式（`exportToSimpleDocx`），不使用模板。

要使用模板导出，需要：
1. 修改 `packages/backend/src/services/export.ts`
2. 使用 `exportToDocx()` 函数并传入模板路径
