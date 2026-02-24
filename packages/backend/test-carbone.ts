import carbone from 'carbone';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const carboneRender = promisify(carbone.render);

async function testCarboneExport() {
  console.log('🧪 Testing Carbone export...');

  const templatePath = path.join(process.cwd(), 'templates', 'legal-memo-carbone.dotx');
  console.log('📄 Template path:', templatePath);

  // 检查模板是否存在
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template file not found!');
    return;
  }

  console.log('✅ Template file exists');

  // 准备最简单的测试数据
  const testData = {
    client_name: '测试客户公司',
    case_title: '测试案件标题',
    law_firm: '国浩律师（北京）事务所',
    basic_facts: '这是基本事实的测试内容。包含一些中文文字，用于测试模板是否正常工作。',
    legal_opinion: '这是法律意见的测试内容。我们认为根据相关法律规定，应当如何如何处理。这只是一个简单的测试文本。',
    recommendations: '以上意见仅供参考。',
    date: '二〇二六年二月十六日',
  };

  console.log('📝 Test data:', JSON.stringify(testData, null, 2));

  try {
    console.log('🔄 Rendering template with Carbone...');

    // 渲染模板
    const result = await carboneRender(templatePath, testData);

    console.log('✅ Carbone render successful!');
    console.log('📊 Result buffer size:', result.length);

    // 保存到测试文件
    const outputPath = path.join(process.cwd(), 'test-output.docx');
    fs.writeFileSync(outputPath, result);

    console.log('✅ Test file saved to:', outputPath);
    console.log('');
    console.log('请用 Microsoft Word 打开以下文件：');
    console.log(outputPath);
    console.log('');
    console.log('如果能正常打开，说明模板和 Carbone 配置正常。');
    console.log('如果仍然损坏，说明可能是模板文件本身有问题。');

  } catch (error: any) {
    console.error('❌ Carbone render failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  }
}

// 运行测试
testCarboneExport().catch(console.error);
