import httpx
import json
from auth import decrypt_api_key


SEARCH_PROVIDERS = {
    "tavily": {
        "name": "Tavily",
        "url": "https://api.tavily.com/search",
        "key_label": "Tavily API Key",
    },
    "serper": {
        "name": "Serper",
        "url": "https://google.serper.dev/search",
        "key_label": "Serper API Key",
    },
    "bing": {
        "name": "Bing Search",
        "url": "https://api.bing.microsoft.com/v7.0/search",
        "key_label": "Bing API Key",
    },
    "google": {
        "name": "Google Programmable Search",
        "url": "https://www.googleapis.com/customsearch/v1",
        "key_label": "Google API Key",
    },
    "searxng": {
        "name": "SearXNG (自建)",
        "url": "",
        "key_label": "无需API Key",
    },
}


class SearchClient:
    def __init__(self, config):
        self.config = config
        self.provider = getattr(config, 'provider', 'tavily') or 'tavily'
        self.api_key = decrypt_api_key(config.api_key_encrypted) if config.api_key_encrypted else ""
        self.max_results = config.max_results or 5
        self.summary_length = config.summary_length or 500
        self.endpoint = getattr(config, 'endpoint', '') or ''
        self.cx = getattr(config, 'cx', '') or ''

    async def search(self, query: str) -> list:
        if self.provider == "tavily":
            return await self._search_tavily(query)
        elif self.provider == "serper":
            return await self._search_serper(query)
        elif self.provider == "bing":
            return await self._search_bing(query)
        elif self.provider == "google":
            return await self._search_google(query)
        elif self.provider == "searxng":
            return await self._search_searxng(query)
        else:
            return await self._search_tavily(query)

    async def _search_tavily(self, query: str) -> list:
        if not self.api_key:
            return []
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": self.api_key,
            "query": query,
            "max_results": self.max_results,
            "include_answer": True,
            "search_depth": "basic",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        results = []
        answer = data.get("answer", "")
        if answer:
            results.append({"title": "AI Summary", "content": answer[:self.summary_length], "url": ""})
        for r in data.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "content": r.get("content", "")[:self.summary_length],
                "url": r.get("url", ""),
            })
        return results

    async def _search_serper(self, query: str) -> list:
        if not self.api_key:
            return []
        url = "https://google.serper.dev/search"
        headers = {"X-API-KEY": self.api_key, "Content-Type": "application/json"}
        payload = {"q": query, "num": self.max_results}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        results = []
        if data.get("answerBox"):
            ab = data["answerBox"]
            results.append({"title": "Answer Box", "content": (ab.get("snippet") or ab.get("answer", ""))[:self.summary_length], "url": ""})
        for r in data.get("organic", []):
            results.append({
                "title": r.get("title", ""),
                "content": r.get("snippet", "")[:self.summary_length],
                "url": r.get("link", ""),
            })
        return results

    async def _search_bing(self, query: str) -> list:
        if not self.api_key:
            return []
        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {"Ocp-Apim-Subscription-Key": self.api_key}
        params = {"q": query, "count": self.max_results}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for r in data.get("webPages", {}).get("value", []):
            results.append({
                "title": r.get("name", ""),
                "content": r.get("snippet", "")[:self.summary_length],
                "url": r.get("url", ""),
            })
        return results

    async def _search_google(self, query: str) -> list:
        if not self.api_key:
            return []
        if not self.cx:
            return []
        url = "https://www.googleapis.com/customsearch/v1"
        params = {"key": self.api_key, "q": query, "num": self.max_results, "cx": self.cx}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for r in data.get("items", []):
            results.append({
                "title": r.get("title", ""),
                "content": r.get("snippet", "")[:self.summary_length],
                "url": r.get("link", ""),
            })
        return results

    async def _search_searxng(self, query: str) -> list:
        base_url = self.endpoint or "http://localhost:8080"
        url = f"{base_url.rstrip('/')}/search"
        params = {"q": query, "format": "json", "categories": "general"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for r in data.get("results", [])[:self.max_results]:
            results.append({
                "title": r.get("title", ""),
                "content": r.get("content", "")[:self.summary_length],
                "url": r.get("url", ""),
            })
        return results


class TavilySearchClient(SearchClient):
    pass
