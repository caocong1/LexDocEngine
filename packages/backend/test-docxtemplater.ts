import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';

async function testDocxtemplater() {
  console.log('🧪 Testing docxtemplater export...');

  const templatePath = path.join(process.cwd(), 'templates', 'legal-memo-carbone.dotx');
  console.log('📄 Template path:', templatePath);

  // 检查模板是否存在
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template file not found!');
    return;
  }

  console.log('✅ Template file exists');

  // 读取模板
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);

  // 创建 docxtemplater 实例
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // 准备测试数据（使用 Carbone 的占位符语法：{d.xxx}）
  const testData = {
    d: {
      client_name: '测试客户公司',
      case_title: '测试案件标题',
      law_firm: '国浩律师（北京）事务所',
      basic_facts: '这是基本事实的测试内容。\n包含一些中文文字，用于测试模板是否正常工作。',
      legal_opinion: '这是法律意见的测试内容。\n我们认为根据相关法律规定，应当如何如何处理。\n这只是一个简单的测试文本。',
      recommendations: '以上意见仅供参考。',
      date: '二〇二六年二月十六日',
    },
  };

  console.log('📝 Test data prepared');

  try {
    // 渲染模板
    doc.render(testData);

    console.log('✅ Docxtemplater render successful!');

    // 生成文件
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    console.log('📊 Result buffer size:', buf.length);

    // 保存到测试文件
    const outputPath = path.join(process.cwd(), 'test-output-docxtemplater.docx');
    fs.writeFileSync(outputPath, buf);

    console.log('✅ Test file saved to:', outputPath);
    console.log('');
    console.log('请用 Microsoft Word 打开以下文件：');
    console.log(outputPath);
    console.log('');
    console.log('如果能正常打开，说明 docxtemplater 生成的文件兼容 Microsoft Word。');

  } catch (error: any) {
    console.error('❌ Docxtemplater render failed:', error);
    console.error('Error details:', error.message);
    if (error.properties && error.properties.errors) {
      console.error('Template errors:', error.properties.errors);
    }
  }
}

// 运行测试
testDocxtemplater().catch(console.error);
