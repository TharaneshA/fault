"""
CCRE Explainer - Generates natural language explanations using Gemini.
"""
import os
import json
from typing import Optional
from pydantic import BaseModel
from loguru import logger

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("google-generativeai not installed. CCRE will return mock explanations.")

from config import CCREConfig


class ExplanationResult(BaseModel):
    """Structured explanation output."""
    root_cause_summary: str
    failure_chain: list[str]
    evidence: dict[str, list[str]]  # metrics, traces, logs
    recommendations: list[dict[str, str]]  # priority + text
    confidence_breakdown: dict[str, float]  # cmea, ingd, ccre percentages


class CCREExplainer:
    """Generates causal explanations using Gemini LLM."""

    def __init__(self, config: Optional[CCREConfig] = None):
        self.config = config or CCREConfig()
        self._model = None

        if GEMINI_AVAILABLE:
            api_key = os.environ.get("GEMINI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self._model = genai.GenerativeModel(self.config.model)
                logger.info(f"CCRE initialized with {self.config.model}")
            else:
                logger.warning("GEMINI_API_KEY not set. CCRE will return mock explanations.")

    def _build_prompt(self, analysis_result: dict) -> str:
        """Build the prompt for the LLM from analysis results."""
        root_causes = analysis_result.get("root_causes", [])
        causal_graph = analysis_result.get("causal_graph", {})

        # Format root causes
        root_cause_text = "\n".join([
            f"  {i+1}. {rc['node_name']} (confidence: {rc['confidence']:.2f}, anomaly: {rc['anomaly_score']:.2f})"
            for i, rc in enumerate(root_causes[:5])
        ])

        # Format causal edges
        edges = causal_graph.get("edges", [])
        edge_text = "\n".join([
            f"  - {e['source_name']} -> {e['target_name']} (weight: {e['weight']:.2f})"
            for e in edges[:15]
        ])

        prompt = f"""You are an expert Site Reliability Engineer analyzing a microservice failure.

Based on the following causal analysis results, provide a clear explanation of the root cause and failure propagation.

## Root Causes (ranked by confidence):
{root_cause_text}

## Causal Graph Edges (showing failure propagation):
{edge_text}

Provide your analysis in the following JSON format:
{{
  "root_cause_summary": "A 2-3 sentence summary of the primary root cause and what happened",
  "failure_chain": [
    "Step 1: What happened first",
    "Step 2: How it propagated",
    "Step 3: What services were affected",
    "Step 4: Final impact"
  ],
  "evidence": {{
    "metrics": ["Key metric observation 1", "Key metric observation 2"],
    "traces": ["Trace pattern 1", "Trace pattern 2"],
    "logs": ["Log pattern 1", "Log pattern 2"]
  }},
  "recommendations": [
    {{"priority": "high", "text": "Most important action to take"}},
    {{"priority": "high", "text": "Second important action"}},
    {{"priority": "medium", "text": "Medium priority action"}},
    {{"priority": "low", "text": "Nice to have improvement"}}
  ],
  "confidence_breakdown": {{
    "cmea": 0.35,
    "ingd": 0.45,
    "ccre": 0.20
  }}
}}

Important:
- Base your explanation on the actual services and weights provided
- The failure_chain should trace the actual propagation path
- Recommendations should be specific to the services involved
- Return ONLY valid JSON, no other text"""

        return prompt

    def _parse_response(self, response_text: str) -> ExplanationResult:
        """Parse LLM response into structured format."""
        try:
            # Clean up response - remove markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                # Remove first and last lines (```json and ```)
                lines = [l for l in lines if not l.strip().startswith("```")]
                cleaned = "\n".join(lines)

            data = json.loads(cleaned)
            return ExplanationResult(**data)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse LLM response: {e}")
            logger.debug(f"Raw response: {response_text}")
            return self._get_mock_explanation()

    def _get_mock_explanation(self, analysis_result: Optional[dict] = None) -> ExplanationResult:
        """Return a mock explanation when LLM is unavailable."""
        # Use actual data if available
        if analysis_result and analysis_result.get("root_causes"):
            rc = analysis_result["root_causes"][0]
            service = rc["node_name"]
        else:
            service = "ts-order-service"

        return ExplanationResult(
            root_cause_summary=f"The primary root cause is {service} experiencing resource saturation. "
                f"Analysis indicates high anomaly scores correlating with increased latency and error rates.",
            failure_chain=[
                f"{service} experienced resource constraints",
                "Downstream service calls began timing out",
                "Cascading failures propagated through dependent services",
                "End-user requests failed with increased error rates"
            ],
            evidence={
                "metrics": ["CPU utilization spike detected", "Memory pressure increased", "Latency percentiles elevated"],
                "traces": ["Increased span duration", "Timeout errors in traces", "Retry patterns detected"],
                "logs": ["Error rate increase", "Connection pool exhaustion", "Thread contention warnings"]
            },
            recommendations=[
                {"priority": "high", "text": f"Scale {service} horizontally to handle load"},
                {"priority": "high", "text": "Implement circuit breakers on critical paths"},
                {"priority": "medium", "text": "Add resource-based autoscaling policies"},
                {"priority": "low", "text": "Review and optimize connection pool settings"}
            ],
            confidence_breakdown={"cmea": 0.35, "ingd": 0.45, "ccre": 0.20}
        )

    async def explain(self, analysis_result: dict) -> ExplanationResult:
        """Generate explanation from analysis results."""
        if not self._model:
            logger.info("Using mock explanation (no LLM configured)")
            return self._get_mock_explanation(analysis_result)

        try:
            prompt = self._build_prompt(analysis_result)

            response = await self._model.generate_content_async(
                prompt,
                generation_config=genai.GenerationConfig(
                    max_output_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                )
            )

            return self._parse_response(response.text)

        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return self._get_mock_explanation(analysis_result)

    def explain_sync(self, analysis_result: dict) -> ExplanationResult:
        """Synchronous version of explain."""
        if not self._model:
            return self._get_mock_explanation(analysis_result)

        try:
            prompt = self._build_prompt(analysis_result)

            response = self._model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    max_output_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                )
            )

            return self._parse_response(response.text)

        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return self._get_mock_explanation(analysis_result)
