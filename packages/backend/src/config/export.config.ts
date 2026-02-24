/**
 * 导出配置
 * 管理法律备忘录模板的固定值和默认值
 */

export const exportConfig = {
  /**
   * 默认律所名称
   * 如果在模板中使用 {d.law_firm}，这个值会被填充
   */
  defaultLawFirm: '国浩律师（北京）事务所',

  /**
   * 默认客户名称
   * 当没有提供客户名称时使用
   */
  defaultClientName: '委托方',

  /**
   * 模板文件配置
   */
  templates: {
    legalMemo: 'legal-memo-carbone.dotx',
    simple: 'simple-template.docx',
  },

  /**
   * 日期格式配置
   */
  dateFormat: {
    locale: 'zh-CN',
    options: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    } as Intl.DateTimeFormatOptions,
  },
};

/**
 * 获取律所名称
 * 可以从环境变量或配置文件读取
 */
export function getLawFirmName(): string {
  return process.env.LAW_FIRM_NAME || exportConfig.defaultLawFirm;
}

/**
 * 获取默认客户名称
 */
export function getDefaultClientName(): string {
  return process.env.DEFAULT_CLIENT_NAME || exportConfig.defaultClientName;
}
