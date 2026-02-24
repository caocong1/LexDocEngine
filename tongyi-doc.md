通义法睿是以通义千问为基座经法律行业数据和知识专门训练的法律行业大模型产品，综合运用了模型精调、强化学习、 RAG检索增强、法律Agent及司法专属小模型技术，具有回答法律问题、推理法律适用、推荐裁判类案、辅助案情分析、生成法律文书、检索法律知识、审查合同条款等功能。

模型具备的能力包括但不限于：

1. 法律问答
2. 要素抽取
3. 案情摘要
4. 文书生成
5. 案由识别
6. 法条预测
7. 争议焦点识别

# 快速开始

## 前提条件

1. 已开通服务并获得API-KEY:[如何获取API-KEY_大模型服务平台百炼(Model Studio)-阿里云帮助中心](https://help.aliyun.com/zh/model-studio/developer-reference/get-api-key)
2. 已安装最新版SDK:[安装阿里云百炼SDK_大模型服务平台百炼(Model Studio)-阿里云帮助中心](https://help.aliyun.com/zh/model-studio/developer-reference/install-sdk)。

## 示例代码

**说明**

需要使用您的API-KEY替换示例中的YOUR_DASHSCOPE_API_KEY，代码才能正常运行。

python sdk version: dashscope>=1.10.0

java sdk version: >=2.5.0

设置API-KEY

```bash
export DASHSCOPE_API_KEY=YOUR_DASHSCOPE_API_KEY
```

### 通过messages调用（推荐）

**Python**

```python
from http import HTTPStatus
import dashscope

def call_with_messages():
    messages = [{'role': 'system',
                 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': '我哥欠我10000块钱，给我生成起诉书。'}]
    response = dashscope.Generation.call(
        "farui-plus",
        messages=messages,
        result_format='message',  # set the result to be "message" format.
    )
    if response.status_code == HTTPStatus.OK:
        print(response)
    else:
        print('Request id: %s, Status code: %s, error code: %s, error message: %s' % (
            response.request_id, response.status_code,
            response.code, response.message
        ))

if __name__ == '__main__':
    call_with_messages()
```

**Java**

```java
import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.aigc.generation.models.QwenParam;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.MessageManager;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;

public class Example {
    public static void callWithMessage()
            throws NoApiKeyException, ApiException, InputRequiredException {
        Generation gen = new Generation();
        MessageManager msgManager = new MessageManager(10);
        Message systemMsg =
                Message.builder().role(
                        Role.SYSTEM.getValue())
                        .content("You are a helpful assistant.")
                        .build();
        Message userMsg = Message.builder().role(
                        Role.USER.getValue())
                        .content("我哥欠我10000块钱，给我生成起诉书。")
                        .build();
        msgManager.add(systemMsg);
        msgManager.add(userMsg);
        QwenParam param =
                QwenParam.builder().model("farui-plus").messages(msgManager.get())
                        .resultFormat(QwenParam.ResultFormat.MESSAGE)
                        .apiKey("xxx")
                        .build();
        GenerationResult result = gen.call(param);
        System.out.println(result);
    }

    public static void main(String[] args){
        try {
            callWithMessage();
        } catch (ApiException | NoApiKeyException | InputRequiredException e) {
            System.out.println(e.getMessage());
        }
        System.exit(0);
    }
}
```

python调用成功，将输出如下结果

```json
{
    "status_code": 200,
    "request_id": "0bcab0eb-ee6b-983d-9479-9814cff59096",
    "code": "",
    "message": "",
    "output": {
        "text": null,
        "finish_reason": null,
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、要求被告归还原告借款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n原告与被告系兄弟关系。2019年9月10日，被告因急需用钱向原告借款10000元，并出具借条一份，约定借款期限为一个月。然而，借款期限届满后，被告并未按约定归还借款，原告多次催讨均无果。\n\n证据清单：\n1. 借条1份；\n2. 转账记录1份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。\n\n请注意，这只是一个模板，具体情况可能需要根据实际情况进行调整。在实际操作中，建议您咨询专业律师或者法律工作者，以确保起诉书的准确性和合法性。"
                }
            }
        ]
    },
    "usage": {
        "input_tokens": 56,
        "output_tokens": 284,
        "total_tokens": 340
    }
}
```

### 通过prompt调用

**Python**

```python
# For prerequisites running the following sample, visit https://help.aliyun.com/document_detail/611472.html
from http import HTTPStatus
import dashscope

def call_with_prompt():
    response = dashscope.Generation.call(
        model="farui-plus",
        prompt='我哥欠我10000块钱，给我生成起诉书。'
    )
    # The response status_code is HTTPStatus.OK indicate success,
    # otherwise indicate request is failed, you can get error code
    # and message from code and message.
    if response.status_code == HTTPStatus.OK:
        print(response.output)  # The output text
        print(response.usage)  # The usage information
    else:
        print(response.code)  # The error code.
        print(response.message)  # The error message.

if __name__ == '__main__':
    call_with_prompt()
```

**Java**

```java
package com.alibaba.judicial.ai;

import java.util.concurrent.Semaphore;
import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.aigc.generation.models.QwenParam;
import com.alibaba.dashscope.common.ResultCallback;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.alibaba.dashscope.utils.JsonUtils;

public class Example8 {

    private final static String PROMPT = "我哥欠我10000块钱，给我生成起诉书。";
    public static void qwenQuickStart()
            throws NoApiKeyException, ApiException, InputRequiredException {
        Generation gen = new Generation();
        QwenParam param = QwenParam.builder()
                .model("farui-plus")
                .apiKey("xxxx")
                .prompt(PROMPT).build();
        GenerationResult result = gen.call(param);
        System.out.println(JsonUtils.toJson(result));
    }

    public static void qwenQuickStartCallback()
            throws NoApiKeyException, ApiException, InputRequiredException, InterruptedException {
        Generation gen = new Generation();
        QwenParam param = QwenParam.builder()
                .model("farui-plus")
                .apiKey("xxxxx")
                .prompt(PROMPT)
                .build();
        Semaphore semaphore = new Semaphore(0);
        gen.call(param, new ResultCallback<GenerationResult>() {

            @Override
            public void onEvent(GenerationResult message) {
                System.out.println(message);
            }
            @Override
            public void onError(Exception ex){
                System.out.println(ex.getMessage());
                semaphore.release();
            }
            @Override
            public void onComplete(){
                System.out.println("onComplete");
                semaphore.release();
            }

        });
        semaphore.acquire();
    }

    public static void main(String[] args) {
        try {
            qwenQuickStart();
            qwenQuickStartCallback();
        } catch (ApiException | NoApiKeyException | InputRequiredException | InterruptedException e) {
            System.out.println(String.format("Exception %s", e.getMessage()));
        }
        System.exit(0);
    }
}
```

调用成功后，将会返回如下示例结果。

```json
{"text": "【民事起诉状】\n\n原告：（你的姓名、性别、年龄、民族、职业、工作单位、住址、联系方式）\n\n被告：（你哥哥的姓名、性别、年龄、民族、职业、工作单位、住址、联系方式）\n\n诉讼请求：\n一、判令被告归还原告借款本金10000元；\n二、判令被告支付自借款之日起至实际清偿之日止的利息（根据相关法律规定计算）；\n三、由被告承担本案全部诉讼费用。\n\n事实与理由：\n原告与被告系兄弟关系。2021年1月1日，被告因个人需要向原告借款10000元，并出具借条一份，约定借款期限为6个月，月利率为1%。原告于当日通过银行转账方式将借款本金10000元交付给被告。然而，借款到期后，被告未按约定归还借款本金及利息。原告多次催讨未果，现借款已逾期，被告的行为已构成违约。\n\n证据清单：\n1. 借条原件1份；\n2. 银行转账记录1份。\n\n此致\n\nXXX人民法院\n\n起诉人：（你的签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。", "finish_reason": "stop", "choices": null}
{"input_tokens": 16, "output_tokens": 274, "total_tokens": 290}
```

# API详情

通义法睿是以通义千问为基座经法律行业数据和知识专门训练的法律行业大模型产品，综合运用了模型精调、强化学习、RAG检索增强、法律Agent及司法专属小模型等技术，具有回答法律问题、推理法律适用、推荐裁判类案、辅助案情分析、生成法律文书、检索法律知识、审查合同条款等功能。

## 模型概览

| **模型名称** | **上下文长度** | **最大输入** | **最大输出** | **输入成本** | **输出成本** |
| --- | --- | --- | --- | --- | --- |
|  | **（Token数）** |  |  | **（每千Token）** |  |
| farui-plus | 12k | 12k | 2k | 0.02元 |  |

关于模型的限流条件，请参见[限流_大模型服务平台百炼(Model Studio)-阿里云帮助中心](https://help.aliyun.com/zh/model-studio/developer-reference/rate-limit)。

## SDK使用

您可以通过SDK实现单轮对话、多轮对话、流式输出等多种功能。

### 前提条件

1. DashScope SDK提供了Python和Java两个版本，请确保您已安装最新版SDK：[安装DashScope SDK_模型服务灵积(DashScope)-阿里云帮助中心](https://help.aliyun.com/zh/dashscope/developer-reference/install-dashscope-sdk)。
2. 已开通服务并获得API-KEY：[如何获取通义千问API的KEY_模型服务灵积(DashScope)-阿里云帮助中心](https://help.aliyun.com/zh/dashscope/developer-reference/acquisition-and-configuration-of-api-key)。
3. 推荐您将API-KEY配置到环境变量中以降低API-KEY的泄露风险，详情请参见[如何获取通义千问API的KEY_模型服务灵积(DashScope)-阿里云帮助中心](https://help.aliyun.com/zh/dashscope/developer-reference/configure-api-key-through-environment-variables)。您也可以在代码中配置API-KEY，但是泄露风险会提高。

**说明**

当您使用DashScope Java SDK时，为了效率您应该尽可能复用Generation以及其他请求对象，但对象（如Generation）不是线程安全的，您应该采取一定的措施，如及时关闭进程、管理同步机制等，来确保对象安全。

### 单轮对话

您可以将通义法睿应用在法律咨询、文书生成、争议焦点识别等场景。您可以运行以下示例代码，体验通义法睿大模型的单轮对话能力。

**Python**

```python
import random
from http import HTTPStatus
import dashscope
from dashscope import Generation

def call_with_messages():
    messages = [{'role': 'system',
                 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': '我哥欠我10000块钱，给我生成起诉书。'}]
    response = dashscope.Generation.call(
        "farui-plus",
        messages=messages,
        result_format='message',  # set the result to be "message" format.
    )
    if response.status_code == HTTPStatus.OK:
        print(response)
    else:
        print('Request id: %s, Status code: %s, error code: %s, error message: %s' % (
            response.request_id, response.status_code,
            response.code, response.message
        ))

if __name__ == '__main__':
    call_with_messages()
```

**Java**

```java
import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.aigc.generation.models.QwenParam;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.MessageManager;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;

public class CallWithMessages {
    public static void callWithMessage()
            throws NoApiKeyException, ApiException, InputRequiredException {
        Generation gen = new Generation();
        MessageManager msgManager = new MessageManager(10);
        Message systemMsg =
                Message.builder().role(
                                Role.SYSTEM.getValue())
                        .content("You are a helpful assistant.")
                        .build();
        Message userMsg = Message.builder().role(
                        Role.USER.getValue())
                .content("我哥欠我10000块钱，给我生成起诉书。")
                .build();
        msgManager.add(systemMsg);
        msgManager.add(userMsg);
        QwenParam param =
                QwenParam.builder().model("farui-plus").messages(msgManager.get())
                        .resultFormat(QwenParam.ResultFormat.MESSAGE)
                        .apiKey("xxxx")
                        .build();
        GenerationResult result = gen.call(param);
        System.out.println(result);
    }

    public static void main(String[] args){
        try {
            callWithMessage();
        } catch (ApiException | NoApiKeyException | InputRequiredException e) {
            System.out.println(e.getMessage());
        }
        System.exit(0);
    }
}
```

运行结果的示例如下所示：

```json
{
    "status_code": 200,
    "request_id": "32880e8b-dc0f-95e4-b88f-2ca0c41e8c7b",
    "code": "",
    "message": "",
    "output": {
        "text": null,
        "finish_reason": null,
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、判令被告归还原告借款10000元及利息；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n原告与被告是兄弟关系，被告于XXXX年XX月XX日向原告借款10000元，原告以现金形式交付给被告。被告承诺于XXXX年XX月XX日归还，但到期后并未归还。原告多次催要，被告以各种理由推脱，至今未归还借款。\n\n证据清单：\n1. 借条1份；\n2. 催要记录。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。"
                }
            }
        ]
    },
    "usage": {
        "input_tokens": 22,
        "output_tokens": 274,
        "total_tokens": 269
    }
}
```

### 多轮对话

您可以运行以下示例代码，体验通义法睿大模型的多轮对话能力。

**Python**

```python
import random
from http import HTTPStatus
import dashscope
from dashscope import Generation

def multi_round():
    messages = [{'role': 'system',
                 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': '我哥欠我10000块钱，给我生成起诉书。'}]
    response = Generation.call("farui-plus",
                               messages=messages,
                               # 将输出设置为"message"格式
                               result_format='message')
    if response.status_code == HTTPStatus.OK:
        print(response)
        # 将assistant的回复添加到messages列表中
        messages.append({'role': response.output.choices[0]['message']['role'],
                         'content': response.output.choices[0]['message']['content']})
    else:
        print('Request id: %s, Status code: %s, error code: %s, error message: %s' % (
            response.request_id, response.status_code,
            response.code, response.message
        ))
        # 如果响应失败，将最后一条user message从messages列表里删除，确保user/assistant消息交替出现
        messages = messages[:-1]
    # 将新一轮的user问题添加到messages列表中
    messages.append({'role': 'user', 'content': '如果借款利率是4%，再重新生成一份起诉书'})
    # 进行第二轮模型的响应
    response = Generation.call("farui-plus",
                               messages=messages,
                               result_format='message',  # 将输出设置为"message"格式
                               )
    if response.status_code == HTTPStatus.OK:
        print(response)
    else:
        print('Request id: %s, Status code: %s, error code: %s, error message: %s' % (
            response.request_id, response.status_code,
            response.code, response.message
        ))

if __name__ == '__main__':
    multi_round()
```

**Java**

```java
import java.util.ArrayList;
import java.util.List;
import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.alibaba.dashscope.utils.JsonUtils;

public class MultiRound {
    public static GenerationParam createGenerationParam(List<Message> messages) {
        return GenerationParam.builder()
                .model("farui-plus")
                .apiKey("xxx")
                .messages(messages)
                .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                .build();
    }

    public static GenerationResult callGenerationWithMessages(GenerationParam param) throws ApiException, NoApiKeyException, InputRequiredException {
        Generation gen = new Generation();
        return gen.call(param);
    }

    public static void main(String[] args) {
        try {
            List<Message> messages = new ArrayList<>();
            messages.add(createMessage(Role.SYSTEM, "You are a helpful assistant."));
            messages.add(createMessage(Role.USER, "我哥欠我10000块钱，给我生成起诉书。"));

            GenerationParam param = createGenerationParam(messages);
            GenerationResult result = callGenerationWithMessages(param);
            printResult(result);

            // 添加assistant返回的消息到列表
            messages.add(result.getOutput().getChoices().get(0).getMessage());

            // 添加新的用户消息
            messages.add(createMessage(Role.USER, "如果借款利率是4%，再重新生成一份起诉书"));

            result = callGenerationWithMessages(param);
            printResult(result);
            printResultAsJson(result);
        } catch (ApiException | NoApiKeyException | InputRequiredException e) {
            e.printStackTrace();
        }
        System.exit(0);
    }

    private static Message createMessage(Role role, String content) {
        return Message.builder().role(role.getValue()).content(content).build();
    }

    private static void printResult(GenerationResult result) {
        System.out.println(result);
    }

    private static void printResultAsJson(GenerationResult result) {
        System.out.println(JsonUtils.toJson(result));
    }
}
```

运行结果的示例如下所示：

```json
{
    "status_code": 200,
    "request_id": "0851caa1-232c-9b97-853f-be7810ecd36c",
    "code": "",
    "message": "",
    "output": {
        "text": null,
        "finish_reason": null,
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、要求被告归还原告借款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n原告与被告系兄弟关系。2019年9月10日，被告因急需用钱向原告借款10000元，并出具借条一份，约定借款期限为一个月。然而，借款期限届满后，被告并未按约定归还借款，原告多次催讨均无果。\n\n证据清单：\n1. 借条1份；\n2. 转账记录1份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。\n\n请注意，这只是一个模板，具体情况可能需要根据实际情况进行调整。在实际操作中，建议您咨询专业律师或者法律工作者，以确保起诉书的准确性和合法性。"
                }
            }
        ]
    },
    "usage": {
        "input_tokens": 56,
        "output_tokens": 284,
        "total_tokens": 340
    }
}
{
    "status_code": 200,
    "request_id": "0d922f48-c975-965a-aab5-a3ec19191038",
    "code": "",
    "message": "",
    "output": {
        "text": null,
        "finish_reason": null,
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、要求被告归还原告借款本金10000元；\n二、要求被告支付原告借款利息，以10000元为基数，按照年利率4%计算，从2019年9月10日起至实际清偿之日止；\n三、由被告承担本案全部诉讼费用。\n\n事实与理由：\n原告与被告系兄弟关系。2019年9月10日，被告因急需用钱向原告借款10000元，并出具借条一份，约定借款期限为一个月，借款利率为年利率4%。然而，借款期限届满后，被告并未按约定归还借款，原告多次催讨均无果。\n\n证据清单：\n1. 借条1份；\n2. 转账记录1份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。\n\n请注意，这只是一个模板，具体情况可能需要根据实际情况进行调整。在实际操作中，建议您咨询专业律师或者法律工作者，以确保起诉书的准确性和合法性。"
                }
            }
        ]
    },
    "usage": {
        "input_tokens": 22,
        "output_tokens": 338,
        "total_tokens": 690
    }
}
```

### 流式输出

大模型并不是一次性生成最终结果，而是逐步地生成中间结果，最终结果由中间结果拼接而成。非流式输出方式等待模型生成结束后再将生成的中间结果拼接后返回，而流式输出可以实时地将中间结果返回，您可以在模型进行输出的同时进行阅读，减少等待模型回复的时间。使用流式输出需要您进行一些配置，DashScope Python SDK中需要设置stream为True，DashScope Java SDK中需要使用streamCall接口调用。

**Python**

```python
import random
from http import HTTPStatus
import dashscope
from dashscope import Generation

def call_with_stream():
    messages = [{'role': 'system',
                 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': '我哥欠我10000块钱，给我生成起诉书。'}]
    responses = Generation.call("farui-plus",
                                messages=messages,
                                result_format='message',  # 设置输出为'message'格式
                                stream=True,  # 设置输出方式为流式输出
                                incremental_output=True  # 增量式流式输出
                                )
    for response in responses:
        if response.status_code == HTTPStatus.OK:
            print(response.output.choices[0]['message']['content'], end='')
        else:
            print('Request id: %s, Status code: %s, error code: %s, error message: %s' % (
                response.request_id, response.status_code,
                response.code, response.message
            ))

if __name__ == '__main__':
    call_with_stream()
```

**Java**

```java
import java.util.Arrays;
import java.util.concurrent.Semaphore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.concurrent.Semaphore;
import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.ResultCallback;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.alibaba.dashscope.utils.JsonUtils;
import io.reactivex.Flowable;

public class CallStream {

    private static final Logger logger = LoggerFactory.getLogger(CallStream.class);

    private static void handleGenerationResult(GenerationResult message, StringBuilder fullContent) {
        fullContent.append(message.getOutput().getChoices().get(0).getMessage().getContent());
        logger.info("Received message: {}", JsonUtils.toJson(message));
    }

    public static void streamCallWithMessage(Generation gen, Message userMsg)
            throws NoApiKeyException, ApiException, InputRequiredException {
        GenerationParam param = buildGenerationParam(userMsg);
        Flowable<GenerationResult> result = gen.streamCall(param);
        StringBuilder fullContent = new StringBuilder();

        result.blockingForEach(message -> handleGenerationResult(message, fullContent));

        logger.info("Full content: \n{}", fullContent.toString());
    }

    public static void streamCallWithCallback(Generation gen, Message userMsg)
            throws NoApiKeyException, ApiException, InputRequiredException, InterruptedException {
        GenerationParam param = buildGenerationParam(userMsg);
        Semaphore semaphore = new Semaphore(0);
        StringBuilder fullContent = new StringBuilder();

        gen.streamCall(param, new ResultCallback<GenerationResult>() {
            @Override
            public void onEvent(GenerationResult message) {
                handleGenerationResult(message, fullContent);
            }

            @Override
            public void onError(Exception err) {
                logger.error("Exception occurred: {}", err.getMessage());
                semaphore.release();
            }

            @Override
            public void onComplete() {
                logger.info("Completed");
                semaphore.release();
            }
        });

        semaphore.acquire();
        logger.info("Full content: \n{}", fullContent.toString());
    }

    private static GenerationParam buildGenerationParam(Message userMsg) {
        return GenerationParam.builder()
                .model("farui-plus")
                .apiKey("xxxx")
                .messages(Arrays.asList(userMsg))
                .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                .incrementalOutput(true)
                .build();
    }

    public static void main(String[] args) {
        try {
            Generation gen = new Generation();
            Message userMsg = Message.builder().role(Role.USER.getValue()).content("我哥欠我10000块钱，给我生成起诉书。").build();

            streamCallWithMessage(gen, userMsg);
            streamCallWithCallback(gen, userMsg);
        } catch (ApiException | NoApiKeyException | InputRequiredException | InterruptedException e) {
            logger.error("An exception occurred: {}", e.getMessage());
        }
    }
}
```

流式输出示例如下所示：

```plain
【民事起诉状】

原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。
委托诉讼代理人：XXX，（律所名称）。

被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。

诉讼请求：
一、要求被告归还原告借款10000元；
二、由被告承担本案全部诉讼费用。

事实与理由：
原告与被告系兄弟关系。2019年9月10日，被告因急需用钱向原告借款10000元，并出具借条一份，约定借款期限为一个月。然而，借款期限届满后，被告并未按约定归还借款，原告多次催讨均无果。

证据清单：
1. 借条1份；
2. 转账记录1份。

此致

XXX人民法院

起诉人：（原告签名）

XXXX年XX月XX日

附：1.本诉状副本XXX份。
  2.证据目录。

请注意，这只是一个模板，具体情况可能需要根据实际情况进行调整。在实际操作中，建议您咨询专业律师或者法律工作者，以确保起诉书的准确性和合法性。
```

### 输入参数配置

| **参数** | **类型** | **默认值** | **说明** |
| --- | --- | --- | --- |
| model | string | 无 | 用于指定对话的通义法睿大模型名称，目前可选择farui-plus，输入输出之和最大限制为14000 tokens。 |
| messages | array | 无 | + messages：用户与模型的对话历史。list中的每个元素形式为{"role":角色, "content": 内容}，角色当前可选值：system、user、assistant。 + system：表示系统级消息，只能位于对话历史的第一条（messages[0]）。是否使用system角色是可选的，如果使用则必须位于列表的最开始。 + user和assistant：表示用户和模型的消息。它们应交替出现在对话中，模拟实际对话流程。 + prompt：用户当前输入的期望模型执行指令，用于指导模型生成回复。 **说明** messages和prompt任选一个参数使用即可，仅依赖prompt指令会限制模型进行有记忆的对话能力。 messages参数允许模型参考历史对话，从而更准确地解析用户的意图，确保对话的流程性和连续性，因此在多轮对话场景下推荐您优先使用messages参数。 |
| prompt | string | 无 |  |
| max_tokens（可选） | int | 2000 | 指定模型可生成的最大token个数。例如模型最大输出长度为2k，您可以设置为1k，防止模型输出过长的内容。 不同的模型有不同的输出上限，具体请参见[模型列表](https://help.aliyun.com/zh/model-studio/getting-started/models)。 |
| top_p（可选） | float | 0.8 | 生成过程中的核采样方法概率阈值，例如，取值为0.8时，仅保留概率加起来大于等于0.8的最可能token的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。 |
| top_k（可选） | int | None | 生成时，采样候选集的大小。例如，取值为50时，仅将单次生成中得分最高的50个token组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。默认不传递该参数，取值为None或当top_k大于100时，表示不启用top_k策略，此时，仅有top_p策略生效。 |
| stream（可选） | bool | False | 是否使用流式输出。当以stream模式输出结果时，接口返回结果为generator，需要通过迭代获取结果，默认每次输出为当前生成的整个序列，最后一次输出为最终全部生成结果。 |
| result_format（可选） | string | text | [text |

### 返回结果

当您将result_format设置为`message`时的结果示例：

```json
{
    "status_code": 200,
    "request_id": "0bcab0eb-ee6b-983d-9479-9814cff59096",
    "code": "",
    "message": "",
    "output": {
        "text": null,
        "finish_reason": null,
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住所地：XXX市XXX区XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、要求被告归还原告借款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n原告与被告系兄弟关系。2019年9月10日，被告因急需用钱向原告借款10000元，并出具借条一份，约定借款期限为一个月。然而，借款期限届满后，被告并未按约定归还借款，原告多次催讨均无果。\n\n证据清单：\n1. 借条1份；\n2. 转账记录1份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。\n\n请注意，这只是一个模板，具体情况可能需要根据实际情况进行调整。在实际操作中，建议您咨询专业律师或者法律工作者，以确保起诉书的准确性和合法性。"
                }
            }
        ]
    },
    "usage": {
        "input_tokens": 56,
        "output_tokens": 284,
        "total_tokens": 340
    }
}
```

## HTTP调用接口

### 功能描述

通义法睿大模型同时支持HTTP调用来完成客户的响应，目前提供普通HTTP和HTTP SSE两种协议，您可根据自己的需求自行选择。

### 前提条件

已开通服务并获得API-KEY：[如何获取API-KEY_大模型服务平台百炼(Model Studio)-阿里云帮助中心](https://help.aliyun.com/zh/model-studio/developer-reference/get-api-key)。

### 提交接口调用

```plain
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
```

### 入参描述

| **传参方式** | **字段** | **类型** | **必选** | **描述** | **示例值** |
| --- | --- | --- | --- | --- | --- |
| Header | Content-Type | string | 是 | 请求类型：application/json | application/json |
|  | Accept | string | 否 | /，选择text/event-stream则会开启 SSE 响应，默认无设置 | text/event-stream |
|  | Authorization | string | 是 | API-Key，例如：Bearer d1**2a | Bearer d1**2a |
|  | X-DashScope-WorkSpace | string | 否 | 指明本次调用需要使用的workspace；需要注意的是，对于子账号Apikey调用，此参数为必选项，子账号必须归属于某个workspace才能调用；对于主账号Apikey此项为可选项，添加则使用对应的workspace身份，不添加则使用主账号身份。 | ws_QTggmeAxxxxx |
| Body | model | string | 是 | 指定用于对话的通义法睿大模型名称，目前可选择farui-plus | farui-plus |
|  | input.prompt | string | 否 | 用户当前输入的期望模型执行指令，支持中英文。 | 我哥欠我10000块钱，给我生成起诉书。 |
|  | input.messages | list | 否 | 用户与模型的对话历史，对话接口未来都会有message传输，不过prompt持续兼容，list中的每个元素形式为{"role":角色, "content": 内容}。角色当前可选值：system、user、assistant。未来可以扩展到更多role。 | [{'role': 'system', 'content': 'You are a helpful assistant.'}, {'role': 'user', 'content': '我哥欠我10000块钱，给我生成起诉书。'}] |
|  | input.messages.role | string | message存在的时候不能缺省 |  |  |
|  | input.messages.content | string |  |  |  |
|  | parameters.result_format | string | 否 | "text"表示旧版本的text "message"表示兼容openai的message | "text" |
|  | parameters.max_tokens | integer | 否 | 指定模型可生成的最大token个数。例如模型最大输出长度为2k，您可以设置为1k，防止模型输出过长的内容。 不同的模型有不同的输出上限，具体请参见[模型列表](https://help.aliyun.com/zh/model-studio/getting-started/models)。 | 2000 |
|  | parameters.top_p | float | 否 | 生成时，核采样方法的概率阈值。例如，取值为0.8时，仅保留累计概率之和大于等于0.8的概率分布中的token，作为随机采样的候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的随机性越低。默认值为0.8。注意，取值不要大于等于1。 | 0.8 |
|  | parameters.top_k | float | 否 | 生成时，采样候选集的大小。例如，取值为50时，仅将单次生成中得分最高的50个token组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。注意：如果top_k参数为空或者top_k的值大于100，表示不启用top_k策略，此时仅有top_p策略生效，默认为空。 | 50 |

### 出参描述

| **字段** | **类型** | **输出格式** | **描述** | **示例值** |
| --- | --- | --- | --- | --- |
| output.text | string | 入参result_format=text时候的返回值 | 包含本次请求的算法输出内容。 |  |
| output.finish_reason | string |  | 有三种情况：正在生成时为null，生成结束时如果由于停止token导致则为stop，生成结束时如果因为生成长度过长导致则为length。 | stop |
| output.choise[list] | list | 入参result_format=message时候的返回值 | 入参result_format=message时候的返回值。 | {"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、判令被告偿还欠款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n我哥XXX因经济困难，于XXXX年XX月XX日向我借款10000元，并写下借条，承诺于XXXX年XX月XX日前归还。然而，借款到期后，我哥并未按约还款，尽管我多次催促，他始终以各种理由推脱。\n\n证据清单：\n1. 借条1份；\n2. 催款记录若干份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n 2.证据目录。"}}]} |
| output.choise[x].finish_reason | string |  | 停止原因。 + null：生成过程中 + stop：stop token导致结束 + length：生成长度导致结束 |  |
| output.choise[x].message | string |  | message每个元素形式为{"role":角色, "content": 内容}。角色按当前可选值：system、user、assistant。未来可以扩展到更多role，content则包含本次请求算法输出的内容 |  |
| output.choise[x].message.role | string |  |  |  |
| output.choise[x].message.content | string |  |  |  |
| usage.output_tokens | integer | 通用 | 本次请求算法输出内容的 token 数目。 | 236 |
| usage.input_tokens | integer |  | 本次请求输入内容的 token 数目。 | 56 |
| usage.total_tokens | integer |  | 本次请求内容的总token数目。 | 292 |
| request_id | string |  | 本次请求的系统唯一码。 | 2ae6671b-9373-9c7d-a407-af2029b51659 |

### 请求示例（SSE 关闭）

以下示例展示通过CURL命令来调用通义法睿大模型的脚本（SSE 关闭）。

```bash
curl --location 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' \
--header 'Authorization: Bearer xxxx' \
--header 'Content-Type: application/json' \
--data '{
    "model": "farui-plus",
    "input": {
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "我哥欠我10000块钱，给我生成起诉书。"
            }
        ]
    },
    "parameters": {
        "seed": 65535,
        "result_format": "message"
    }
}'
```

### 响应示例（SSE关闭）

**result_format参数为text的时候的输出结果**

```json
{
    "output": {
        "finish_reason": "stop",
        "text": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、判令被告偿还欠款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n我哥XXX因经济困难，于XXXX年XX月XX日向我借款10000元，并写下借条，承诺于XXXX年XX月XX日前归还。然而，借款到期后，我哥并未按约还款，尽管我多次催促，他始终以各种理由推脱。\n\n证据清单：\n1. 借条1份；\n2. 催款记录若干份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。"
    },
    "usage": {
        "total_tokens": 292,
        "output_tokens": 236,
        "input_tokens": 56
    },
    "request_id": "f2b1c50e-9af4-9d57-b2c6-ef6ad96d51cc"
}
```

**result_format参数为message的时候的输出结果**

```json
{
    "output": {
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、判令被告偿还欠款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n我哥XXX因经济困难，于XXXX年XX月XX日向我借款10000元，并写下借条，承诺于XXXX年XX月XX日前归还。然而，借款到期后，我哥并未按约还款，尽管我多次催促，他始终以各种理由推脱。\n\n证据清单：\n1. 借条1份；\n2. 催款记录若干份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。"
                }
            }
        ]
    },
    "usage": {
        "total_tokens": 292,
        "output_tokens": 236,
        "input_tokens": 56
    },
    "request_id": "2ae6671b-9373-9c7d-a407-af2029b51659"
}
```

### 请求示例（SSE开启）

以下示例展示通过CURL命令来调用通义法睿模型的脚本（SSE 开启）。

```bash
curl --location 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' \
--header 'Authorization: Bearer xxxx' \
--header 'Content-Type: application/json' \
--header 'X-DashScope-SSE: enable' \
--data '{
    "model": "farui-plus",
    "input": {
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "我哥欠我10000块钱，给我生成起诉书。"
            }
        ]
    },
    "parameters": {
        "result_format": "message"
    }
}'
```

### 响应示例（SSE开启）

```json
id:1
event:result
:HTTP_STATUS/200
data:{"output":{"choices":[{"message":{"content":"【民事起诉","role":"assistant"},"finish_reason":"null"}]},"usage":{"total_tokens":59,"input_tokens":56,"output_tokens":3},"request_id":"a074989b-d320-908a-9f87-fd597426933f"}

id:2
event:result
:HTTP_STATUS/200
data:{"output":{"choices":[{"message":{"content":"【民事起诉状】\n\n原告：XXX，男/女，","role":"assistant"},"finish_reason":"null"}]},"usage":{"total_tokens":69,"input_tokens":56,"output_tokens":13},"request_id":"a074989b-d320-908a-9f87-fd597426933f"}

... ... ... ...
... ... ... ...
id:27
event:result
:HTTP_STATUS/200
data:{"output":{"choices":[{"message":{"content":"【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、判令被告偿还欠款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n我哥XXX因经济困难，于XXXX年XX月XX日向我借款10000元，并写下借条，承诺于XXXX年XX月XX日前归还。然而，借款到期后，我哥并未按约还款，尽管我多次催促，他始终以各种理由推脱。\n\n证据清单：\n1. 借条1份；\n2. 催款记录若干份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。","role":"assistant"},"finish_reason":"null"}]},"usage":{"total_tokens":292,"input_tokens":56,"output_tokens":236},"request_id":"a074989b-d320-908a-9f87-fd597426933f"}

id:28
event:result
:HTTP_STATUS/200
data:{"output":{"choices":[{"message":{"content":"【民事起诉状】\n\n原告：XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n委托诉讼代理人：XXX，（律所名称）。\n\n被告： XXX，男/女，XXXX年XX月XX日出生，XXX族，住XXX市XXX路XXX号，联系方式：XXX。\n\n诉讼请求：\n一、判令被告偿还欠款10000元；\n二、由被告承担本案全部诉讼费用。\n\n事实与理由：\n我哥XXX因经济困难，于XXXX年XX月XX日向我借款10000元，并写下借条，承诺于XXXX年XX月XX日前归还。然而，借款到期后，我哥并未按约还款，尽管我多次催促，他始终以各种理由推脱。\n\n证据清单：\n1. 借条1份；\n2. 催款记录若干份。\n\n此致\n\nXXX人民法院\n\n起诉人：（原告签名）\n\nXXXX年XX月XX日\n\n附：1.本诉状副本XXX份。\n  2.证据目录。","role":"assistant"},"finish_reason":"stop"}]},"usage":{"total_tokens":292,"input_tokens":56,"output_tokens":236},"request_id":"a074989b-d320-908a-9f87-fd597426933f"}
```

### 异常响应示例

在访问请求出错的情况下，输出的结果中会通过 code 和 message 指明错误原因。

```json
{
    "code":"InvalidApiKey",
    "message":"Invalid API-key provided.",
    "request_id":"fb53c4ec-1c12-4fc4-a580-cdb7c3261fc1"
}
```

## 状态码说明

大模型服务平台通用状态码详情，请参见[状态码说明_大模型服务平台百炼(Model Studio)-阿里云帮助中心](https://help.aliyun.com/zh/model-studio/developer-reference/status-codes)。
