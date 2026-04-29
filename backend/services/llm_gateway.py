import httpx
import json
from typing import List, Dict, Optional, AsyncGenerator
from auth import decrypt_api_key


PROVIDER_ENDPOINTS = {
    "OpenAI": "https://api.openai.com/v1",
    "Anthropic": "https://api.anthropic.com/v1",
    "Google": "https://generativelanguage.googleapis.com/v1beta",
    "xAI": "https://api.x.ai/v1",
    "DeepSeek": "https://api.deepseek.com/v1",
    "Kimi": "https://api.moonshot.cn/v1",
    "智谱AI": "https://open.bigmodel.cn/api/paas/v4",
    "Minimax": "https://api.minimax.chat/v1",
    "阿里云": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "硅基流动": "https://api.siliconflow.cn/v1",
    "无问芯穹": "https://cloud.infini-ai.com/maas/v1",
    "模力方舟": "https://model-ark.cn-beijing.volces.com/v1",
}


class LLMGateway:
    def __init__(self, config):
        self.config = config
        self.api_key = decrypt_api_key(config.api_key_encrypted) if config.api_key_encrypted else ""
        self.model = config.model_name
        self.provider = config.provider
        self.endpoint = config.endpoint or PROVIDER_ENDPOINTS.get(config.provider, "")
        try:
            self.params = json.loads(config.params_json) if config.params_json else {}
        except json.JSONDecodeError:
            self.params = {}

    def _get_base_url(self):
        if self.endpoint:
            return self.endpoint.rstrip("/")
        return PROVIDER_ENDPOINTS.get(self.provider, "").rstrip("/")

    def _get_headers(self):
        if self.provider == "Anthropic":
            return {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_request_body(self, messages: List[Dict], stream: bool = False):
        temperature = self.params.get("temperature", 0.7)
        max_tokens = self.params.get("max_tokens", 2048)
        top_p = self.params.get("top_p", 1.0)

        if self.provider == "Anthropic":
            system_msg = ""
            chat_messages = []
            for m in messages:
                if m["role"] == "system":
                    system_msg = m["content"]
                else:
                    chat_messages.append(m)
            body = {
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "messages": chat_messages,
                "stream": stream,
            }
            if system_msg:
                body["system"] = system_msg
            return body

        if self.provider == "Google":
            contents = []
            system_msg = ""
            for m in messages:
                if m["role"] == "system":
                    system_msg = m["content"]
                elif m["role"] == "user":
                    contents.append({"role": "user", "parts": [{"text": m["content"]}]})
                elif m["role"] == "assistant":
                    contents.append({"role": "model", "parts": [{"text": m["content"]}]})
            body = {
                "contents": contents,
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                    "topP": top_p,
                },
            }
            if system_msg:
                body["systemInstruction"] = {"parts": [{"text": system_msg}]}
            return body

        return {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": stream,
        }

    def _get_chat_url(self):
        base = self._get_base_url()
        if self.provider == "Anthropic":
            return f"{base}/messages"
        if self.provider == "Google":
            return f"{base}/models/{self.model}:generateContent?key={self.api_key}"
        return f"{base}/chat/completions"

    def _get_stream_url(self):
        base = self._get_base_url()
        if self.provider == "Anthropic":
            return f"{base}/messages"
        if self.provider == "Google":
            return f"{base}/models/{self.model}:streamGenerateContent?alt=sse&key={self.api_key}"
        return f"{base}/chat/completions"

    async def generate(self, messages: List[Dict]) -> str:
        url = self._get_chat_url()
        headers = self._get_headers()
        body = self._build_request_body(messages, stream=False)

        async with httpx.AsyncClient(timeout=60.0) as client:
            if self.provider == "Google":
                resp = await client.post(url, json=body, headers={"Content-Type": "application/json"})
            else:
                resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if self.provider == "Anthropic":
            return data["content"][0]["text"]
        if self.provider == "Google":
            return data["candidates"][0]["content"]["parts"][0]["text"]
        return data["choices"][0]["message"]["content"]

    async def generate_stream(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        url = self._get_stream_url()
        headers = self._get_headers()
        body = self._build_request_body(messages, stream=True)

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=body, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        if self.provider == "Anthropic":
                            if data.get("type") == "content_block_delta":
                                delta = data.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    yield delta.get("text", "")
                        elif self.provider == "Google":
                            try:
                                text = data["candidates"][0]["content"]["parts"][0]["text"]
                                yield text
                            except (KeyError, IndexError):
                                continue
                        else:
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content

    async def test_connection(self) -> str:
        if not self.api_key:
            raise ValueError("未配置API Key，请先填写API Key后再测试")
        messages = [{"role": "user", "content": "Hello, respond with 'OK'."}]
        try:
            response = await self.generate(messages)
            return response[:100]
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            if status_code == 401:
                raise ValueError("API Key无效或已过期，请检查API Key是否正确")
            elif status_code == 403:
                raise ValueError("无权访问该模型，请检查API Key权限或模型名称")
            elif status_code == 404:
                raise ValueError(f"模型不存在或Endpoint地址错误，请检查模型名称和API Base URL")
            elif status_code == 429:
                raise ValueError("请求频率超限，请稍后重试")
            else:
                raise ValueError(f"HTTP错误 {status_code}: {e.response.text[:200]}")
        except httpx.ConnectError:
            raise ValueError("无法连接到服务器，请检查API Base URL是否正确")
        except httpx.TimeoutException:
            raise ValueError("连接超时，请检查网络或API Base URL")
