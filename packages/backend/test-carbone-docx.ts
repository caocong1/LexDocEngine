import carbone from 'carbone';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const carboneRender = promisify(carbone.render);

async function testCarboneDocx() {
  console.log('🧪 Testing Carbone with .docx template...');

  const templatePath = path.join(process.cwd(), 'templates', 'legal-memo-carbone.docx');
  console.log('📄 Template path:', templatePath);

  // 检查模板是否存在
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template file not found!');
    return;
  }

  console.log('✅ Template file exists');

  // 准备测试数据 - 使用段落数组格式
  const testData = {
    client_name: '测试客户公司',
    case_title: '测试案件标题 - 关于航空服务合同纠纷的法律意见',
    law_firm: '国浩律师（北京）事务所',
    // 使用段落数组格式，每个对象包含一个 text 字段
    basic_facts: [
      { text: '2024年1月15日，委托人购买了国航CA1234航班的经济舱机票，计划从北京飞往上海参加重要商务会议。' },
      { text: '航班原定于当日14:00起飞，但因天气原因延误至18:00才起飞，导致委托人错过会议，造成经济损失约5万元。' },
      { text: '委托人多次与航空公司沟通赔偿事宜，但未能达成一致。现委托本所提供法律意见。' }
    ],
    legal_opinion: [
      { text: '（一）法律关系分析\n本案涉及的主要法律关系为航空服务合同关系。根据《中华人民共和国民法典》第四百七十条，合同是民事主体之间设立、变更、终止民事法律关系的协议。委托人购买机票即与国航建立了航空运输合同关系。' },
      { text: '（二）法律适用分析\n根据《中华人民共和国民用航空法》第一百二十六条，旅客、行李或者货物在航空运输中因延误造成的损失，承运人应当承担责任；但是，承运人证明本人或者其受雇人、代理人为了避免损失的发生，已经采取一切必要措施或者不可能采取此种措施的，不承担责任。' },
      { text: '（三）案件事实的法律定性\n本案中，航班延误4小时属于明显的运输延误。虽然航空公司主张天气原因导致延误，但根据相关司法实践，天气原因能否免责需要航空公司提供充分证据证明已采取一切必要措施。' },
      { text: '（四）法律责任分析\n如果航空公司不能证明已采取一切必要措施，应当承担违约责任。根据《民法典》第五百七十七条，当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。' },
      { text: '（五）风险提示与建议\n委托人需要收集并保存相关证据，包括机票、登机牌、会议通知、损失证明等。同时需要注意航空运输损失赔偿的法定限额规定，实际赔偿金额可能受到限制。' }
    ],
    recommendations: [
      { text: '建议委托人首先向航空公司发送正式的索赔函，明确列出损失项目和金额，要求在合理期限内给予答复。' },
      { text: '如协商不成，可以向民航局或消费者协会投诉，也可以考虑通过诉讼途径解决。' },
      { text: '以上意见仅供参考。' }
    ],
    date: '二〇二六年二月十六日',
  };

  console.log('📝 Test data prepared');

  try {
    console.log('🔄 Rendering .docx template with Carbone...');

    // 渲染模板
    const result = await carboneRender(templatePath, testData);

    console.log('✅ Carbone render successful!');
    console.log('📊 Result buffer size:', result.length);

    // 保存到测试文件
    const outputPath = path.join(process.cwd(), 'test-output-docx.docx');
    fs.writeFileSync(outputPath, result);

    console.log('✅ Test file saved to:', outputPath);
    console.log('');
    console.log('请用 Microsoft Word 打开以下文件：');
    console.log(outputPath);
    console.log('');
    console.log('✨ 本次测试使用段落数组格式：');
    console.log('  - basic_facts: 3 个段落');
    console.log('  - legal_opinion: 5 个段落（包含（一）到（五））');
    console.log('  - recommendations: 3 个段落');
    console.log('');
    console.log('⚠️  如果段落没有正确分隔，请按照 templates/模板更新指南.md 更新模板文件。');

  } catch (error: any) {
    console.error('❌ Carbone render failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  }
}

// 运行测试
testCarboneDocx().catch(console.error);
