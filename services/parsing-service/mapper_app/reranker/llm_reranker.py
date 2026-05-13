import ast
import json
import re
from dataclasses import dataclass
from typing import Sequence

import httpx

from mapper_app.config import settings
from mapper_app.schemas import MappingCandidate


@dataclass
class LLMRerankDecision:
    selected_rank: int | None = None
    confidence: float | None = None
    decision: str | None = None
    reason: str | None = None
    provider: str | None = None


class LLMReranker:
    """
    Optional LLM fallback used when the rule-based decision is ambiguous.
    """

    def __init__(self, provider: str | None = None):
        self.provider = str(provider or settings.llm_provider).strip().lower()
        self._groq_client = None

    def is_available(self) -> bool:
        if self.provider == "groq":
            return bool(settings.groq_api_key)
        if self.provider == "ollama":
            return bool(settings.ollama_host and settings.ollama_model)
        return False

    def rerank(
        self,
        *,
        raw_text: str,
        entity_types: Sequence[str] | None,
        candidates: Sequence[MappingCandidate],
    ) -> LLMRerankDecision:
        if not candidates:
            return LLMRerankDecision(
                selected_rank=0,
                confidence=0.0,
                decision="reject",
                reason="No candidates provided to LLM fallback.",
                provider=self.provider,
            )

        if not self.is_available():
            raise RuntimeError(f"Provider LLM indisponible: {self.provider}")

        prompt = self._build_prompt(
            raw_text=raw_text,
            entity_types=entity_types,
            candidates=candidates,
        )

        if self.provider == "groq":
            content = self._call_groq(prompt)
        elif self.provider == "ollama":
            content = self._call_ollama(prompt)
        else:
            raise ValueError(f"Provider LLM non supporte: {self.provider}")

        try:
            decision = self._parse_response(content)
        except ValueError:
            if self.provider == "groq":
                repaired = self._repair_groq_response(raw_response=content)
                decision = self._parse_response(repaired)
            else:
                raise
        decision.provider = self.provider
        return decision

    def _call_groq(self, prompt: str) -> str:
        if self._groq_client is None:
            from groq import Groq

            self._groq_client = Groq(
                api_key=settings.groq_api_key,
                timeout=settings.groq_timeout,
                max_retries=settings.groq_max_retries,
            )

        response = self._groq_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You rerank RTMC taxonomy candidates. "
                        "Return one compact JSON object only. "
                        "Do not use markdown fences. "
                        "Do not add commentary before or after the JSON."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content or ""

    def _repair_groq_response(self, raw_response: str) -> str:
        if self._groq_client is None:
            raise RuntimeError("Client Groq non initialise.")

        repair_prompt = (
            "Convert the following model answer into one compact JSON object only.\n"
            "Do not add markdown.\n"
            "Do not add explanations.\n"
            'Expected schema: {"selected_rank": 0, "confidence": 0.0, "decision": "accept|review|reject", "reason": "short reason"}\n'
            "If the answer does not clearly select a candidate, return selected_rank=0 and decision=reject.\n"
            "Model answer:\n"
            f"{raw_response}"
        )

        response = self._groq_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "Return one compact JSON object only.",
                },
                {
                    "role": "user",
                    "content": repair_prompt,
                },
            ],
            max_tokens=180,
        )
        return response.choices[0].message.content or ""

    @staticmethod
    def _is_unsupported_reasoning_error(exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "reasoning_effort" in message
            or "reasoning_format" in message
            or "include_reasoning" in message
        ) and "not supported" in message

    def _groq_chat_completion(self, *, messages, max_tokens: int):
        if self._groq_client is None:
            raise RuntimeError("Client Groq non initialise.")

        base_kwargs = {
            "model": settings.groq_model,
            "temperature": 0,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }

        try:
            return self._groq_client.chat.completions.create(
                **base_kwargs,
                reasoning_effort="none",
                reasoning_format="hidden",
            )
        except Exception as exc:
            if not self._is_unsupported_reasoning_error(exc):
                raise
            return self._groq_client.chat.completions.create(**base_kwargs)

    def _call_ollama(self, prompt: str) -> str:
        response = httpx.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0,
                },
            },
            timeout=settings.ollama_timeout,
        )
        response.raise_for_status()
        payload = response.json()
        return str(payload.get("response") or "")

    @staticmethod
    def _build_prompt(
        *,
        raw_text: str,
        entity_types: Sequence[str] | None,
        candidates: Sequence[MappingCandidate],
    ) -> str:
        lines = []
        for idx, candidate in enumerate(candidates, start=1):
            lines.append(
                (
                    f"{idx}. "
                    f"type={candidate.entity_type} | "
                    f"code={candidate.entity_code or '-'} | "
                    f"label={candidate.label} | "
                    f"lexical={candidate.lexical_score if candidate.lexical_score is not None else '-'} | "
                    f"vector={candidate.vector_score if candidate.vector_score is not None else '-'} | "
                    f"source={candidate.source or '-'}"
                )
            )

        allowed_types = ", ".join(entity_types) if entity_types else "ALL"

        return (
            "Task: choose the best RTMC candidate for the user query.\n"
            f"Query: {raw_text}\n"
            f"Allowed entity types: {allowed_types}\n"
            "Rules:\n"
            "- Prefer the closest occupational or skill match, not just a related domain.\n"
            "- For technical/software queries, prefer informatics/development candidates over unrelated development meanings.\n"
            "- Choose 0 if no candidate is acceptable.\n"
            "- Be conservative.\n"
            "Candidates:\n"
            + "\n".join(lines)
            + "\nReturn one compact JSON object only with this schema:\n"
            + '{"selected_rank": 0, "confidence": 0.0, "decision": "accept|review|reject", "reason": "short reason"}'
            + "\nIf you fail to return JSON, return exactly this single-line fallback format:\n"
            + "selected_rank=0; confidence=0.0; decision=reject; reason=short reason"
        )

    @staticmethod
    def _normalize_response_text(text: str) -> str:
        content = str(text or "").strip()
        if not content:
            raise ValueError("Reponse LLM vide.")
        content = re.sub(r"<think>.*?</think>", " ", content, flags=re.I | re.S)
        return content.strip()

    @classmethod
    def _iter_json_candidates(cls, text: str):
        content = cls._normalize_response_text(text)
        yield content

        for block in re.findall(r"```(?:json)?\s*(.*?)```", content, flags=re.I | re.S):
            clean = str(block or "").strip()
            if clean:
                yield clean

        depth = 0
        start = None
        for idx, char in enumerate(content):
            if char == "{":
                if depth == 0:
                    start = idx
                depth += 1
            elif char == "}":
                if depth <= 0:
                    continue
                depth -= 1
                if depth == 0 and start is not None:
                    blob = content[start : idx + 1].strip()
                    if blob:
                        yield blob
                    start = None

    @staticmethod
    def _coerce_payload_from_blob(blob: str) -> dict | None:
        for loader in (json.loads, ast.literal_eval):
            try:
                payload = loader(blob)
            except (json.JSONDecodeError, SyntaxError, ValueError):
                continue
            if isinstance(payload, dict):
                return payload
        return None

    @classmethod
    def _extract_json_payload(cls, text: str) -> dict:
        content = cls._normalize_response_text(text)

        for candidate in cls._iter_json_candidates(content):
            payload = cls._coerce_payload_from_blob(candidate)
            if payload is not None:
                return payload

        raise ValueError("Impossible d'extraire un JSON depuis la reponse LLM.")

    @classmethod
    def _extract_fallback_payload(cls, text: str) -> dict | None:
        content = cls._normalize_response_text(text)

        patterns = [
            r"selected[_ ]?rank\s*[:=]\s*(\d+)",
            r"best\s+candidate\s*[:=]?\s*#?(\d+)",
            r"candidate(?:\s+rank)?\s*[:=]?\s*#?(\d+)",
            r"\brank\s*[:=]\s*(\d+)",
        ]
        selected_rank = None
        for pattern in patterns:
            match = re.search(pattern, content, flags=re.I)
            if match:
                selected_rank = int(match.group(1))
                break

        confidence = None
        confidence_match = re.search(
            r"confidence\s*[:=]\s*(\d+(?:\.\d+)?)\s*(%?)",
            content,
            flags=re.I,
        )
        if confidence_match:
            confidence = float(confidence_match.group(1))
            if confidence_match.group(2) == "%" or confidence > 1.0:
                confidence = confidence / 100.0
            confidence = max(0.0, min(1.0, confidence))

        decision = None
        decision_match = re.search(r"\b(accept|review|reject)\b", content, flags=re.I)
        if decision_match:
            decision = decision_match.group(1).lower()

        reason = None
        reason_match = re.search(r"reason\s*[:=]\s*(.+)", content, flags=re.I | re.S)
        if reason_match:
            reason = reason_match.group(1).strip()
        elif content:
            reason = content.strip()

        if selected_rank is None and confidence is None and decision is None:
            return None

        payload = {}
        if selected_rank is not None:
            payload["selected_rank"] = selected_rank
        if confidence is not None:
            payload["confidence"] = confidence
        if decision is not None:
            payload["decision"] = decision
        if reason:
            payload["reason"] = reason
        return payload

    def _parse_response(self, text: str) -> LLMRerankDecision:
        try:
            payload = self._extract_json_payload(text)
        except ValueError:
            payload = self._extract_fallback_payload(text)
            if payload is None:
                preview = self._normalize_response_text(text)[:240]
                raise ValueError(
                    "Impossible d'extraire un JSON depuis la reponse LLM. "
                    f"Preview: {preview!r}"
                )

        selected_rank = payload.get("selected_rank")
        if selected_rank is not None:
            try:
                selected_rank = int(selected_rank)
            except (TypeError, ValueError):
                selected_rank = None

        confidence = payload.get("confidence")
        if confidence is not None:
            try:
                confidence = max(0.0, min(1.0, float(confidence)))
            except (TypeError, ValueError):
                confidence = None

        decision = str(payload.get("decision") or "").strip().lower() or None
        if decision not in {None, "accept", "review", "reject"}:
            decision = None

        reason = str(payload.get("reason") or "").strip() or None

        return LLMRerankDecision(
            selected_rank=selected_rank,
            confidence=confidence,
            decision=decision,
            reason=reason,
            provider=self.provider,
        )
