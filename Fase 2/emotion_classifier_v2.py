from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from textwrap import shorten

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parent / "runs" / "robertuito_emociones_v1.1" / "best_model"
)


class EmotionClassifier:
    def __init__(
        self,
        model_path: str,
        device: str | None = None,
        max_length: int = 128,
        return_logits: bool = False,
    ) -> None:
        self.model_path = Path(model_path).expanduser().resolve()
        if not self.model_path.exists():
            raise FileNotFoundError(f"No se encontro el modelo local en: {self.model_path}")

        self.device = self._resolve_device(device)
        self.max_length = max_length
        self.return_logits = return_logits
        self._preprocess_fn = self._load_preprocess_fn()

        self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_path), use_fast=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_path))
        self.model.to(self.device)
        self.model.eval()

        self.id2label = self._load_id2label()
        self.label2id = {label: label_id for label_id, label in self.id2label.items()}

    def predict(self, text: str, top_k: int = 3) -> dict[str, Any]:
        if not isinstance(text, str):
            raise TypeError("`text` debe ser un string.")

        results = self.predict_batch([text], top_k=top_k)
        return results[0]

    def predict_batch(self, texts: list[str], top_k: int = 3) -> list[dict[str, Any]]:
        if not isinstance(texts, list) or any(not isinstance(text, str) for text in texts):
            raise TypeError("`texts` debe ser una lista de strings.")
        if not texts:
            return []

        top_k = max(1, min(top_k, self.model.config.num_labels))
        processed_texts = [self._preprocess_text(text) for text in texts]

        encoded = self.tokenizer(
            processed_texts,
            truncation=True,
            padding=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        encoded = {name: tensor.to(self.device) for name, tensor in encoded.items()}

        with torch.inference_mode():
            outputs = self.model(**encoded)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=-1)
            top_scores, top_indices = torch.topk(probabilities, k=top_k, dim=-1)

        logits_cpu = logits.detach().cpu()
        probabilities_cpu = probabilities.detach().cpu()
        top_scores_cpu = top_scores.detach().cpu()
        top_indices_cpu = top_indices.detach().cpu()

        results: list[dict[str, Any]] = []
        for idx, original_text in enumerate(texts):
            predicted_label_id = int(torch.argmax(probabilities_cpu[idx]).item())
            predicted_label = self.id2label[predicted_label_id]
            confidence = float(probabilities_cpu[idx, predicted_label_id].item())

            top_k_results = []
            for score, label_id in zip(top_scores_cpu[idx].tolist(), top_indices_cpu[idx].tolist()):
                label_id = int(label_id)
                top_k_results.append(
                    {
                        "label": self.id2label[label_id],
                        "label_id": label_id,
                        "score": float(score),
                    }
                )

            result: dict[str, Any] = {
                "text": original_text,
                "processed_text": processed_texts[idx],
                "predicted_label": predicted_label,
                "predicted_label_id": predicted_label_id,
                "confidence": confidence,
                "top_k": top_k_results,
            }

            if self.return_logits:
                result["logits"] = [float(value) for value in logits_cpu[idx].tolist()]

            results.append(result)

        return results

    def get_model_info(self) -> dict[str, Any]:
        config = self.model.config
        return {
            "model_path": str(self.model_path),
            "device": str(self.device),
            "max_length": self.max_length,
            "return_logits": self.return_logits,
            "model_type": getattr(config, "model_type", None),
            "architectures": list(getattr(config, "architectures", [])),
            "num_labels": int(config.num_labels),
            "id2label": {str(label_id): label for label_id, label in self.id2label.items()},
            "label2id": dict(self.label2id),
        }

    def _preprocess_text(self, text: str) -> str:
        normalized_text = text.strip()
        return self._preprocess_fn(normalized_text)

    def _load_preprocess_fn(self):
        try:
            from pysentimiento.preprocessing import preprocess_tweet
        except ImportError as exc:
            raise ImportError(
                "EmotionClassifier requiere `pysentimiento` para aplicar `preprocess_tweet`. "
                "Instala la dependencia con `pip install pysentimiento`."
            ) from exc

        return preprocess_tweet

    def _load_id2label(self) -> dict[int, str]:
        config_mapping = self._normalize_id2label(getattr(self.model.config, "id2label", None))
        json_mapping = self._load_id2label_from_json()

        if config_mapping:
            merged_mapping = dict(json_mapping)
            merged_mapping.update(config_mapping)
            return merged_mapping

        if json_mapping:
            return json_mapping

        return {label_id: f"LABEL_{label_id}" for label_id in range(int(self.model.config.num_labels))}

    def _load_id2label_from_json(self) -> dict[int, str]:
        for mapping_path in self._candidate_mapping_paths():
            if not mapping_path.exists():
                continue

            with open(mapping_path, "r", encoding="utf-8") as file:
                payload = json.load(file)

            if isinstance(payload, dict):
                return self._normalize_id2label(payload.get("id2label"))

        return {}

    def _candidate_mapping_paths(self) -> list[Path]:
        return [
            self.model_path / "label_mapping.json",
            self.model_path.parent / "label_mapping.json",
        ]

    @staticmethod
    def _normalize_id2label(mapping: Any) -> dict[int, str]:
        if not isinstance(mapping, dict):
            return {}

        normalized: dict[int, str] = {}
        for key, value in mapping.items():
            try:
                normalized[int(key)] = str(value)
            except (TypeError, ValueError):
                continue

        return dict(sorted(normalized.items()))

    @staticmethod
    def _resolve_device(device: str | None) -> torch.device:
        if device:
            return torch.device(device)

        if torch.cuda.is_available():
            return torch.device("cuda")

        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")

        return torch.device("cpu")


def _build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Inferencia local de emociones con un modelo fine-tuned de RoBERTuito."
    )
    parser.add_argument(
        "--model-path",
        default=str(DEFAULT_MODEL_PATH),
        help="Ruta local al modelo fine-tuned. Default: runs/robertuito_emociones_v1.1/best_model",
    )
    parser.add_argument(
        "--text",
        action="append",
        dest="texts",
        help="Texto a clasificar. Repite --text varias veces para inferencia por lote.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="Numero de emociones a devolver por prediccion.",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="Dispositivo a usar: cpu, cuda, mps. Si se omite, se detecta automaticamente.",
    )
    parser.add_argument(
        "--max-length",
        type=int,
        default=128,
        help="Longitud maxima de tokenizacion.",
    )
    parser.add_argument(
        "--return-logits",
        action="store_true",
        help="Incluye logits en la salida JSON.",
    )
    parser.add_argument(
        "--format",
        choices=("table", "json"),
        default="table",
        help="Formato de salida en terminal.",
    )
    parser.add_argument(
        "--info",
        action="store_true",
        help="Muestra informacion del modelo cargado.",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Abre un prompt interactivo para clasificar textos uno tras otro.",
    )
    return parser


def _stringify_cell(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.4f}"
    if value is None:
        return ""
    return str(value).replace("\n", " ")


def _render_table(headers: list[str], rows: list[list[Any]]) -> str:
    normalized_headers = [_stringify_cell(header) for header in headers]
    normalized_rows = [[_stringify_cell(cell) for cell in row] for row in rows]

    if not normalized_rows:
        normalized_rows = [["" for _ in normalized_headers]]

    widths = []
    for col_idx, header in enumerate(normalized_headers):
        cell_lengths = [len(row[col_idx]) for row in normalized_rows]
        widths.append(max(len(header), *cell_lengths))

    def format_row(row: list[str]) -> str:
        return "| " + " | ".join(cell.ljust(widths[idx]) for idx, cell in enumerate(row)) + " |"

    separator = "+-" + "-+-".join("-" * width for width in widths) + "-+"
    lines = [separator, format_row(normalized_headers), separator]
    lines.extend(format_row(row) for row in normalized_rows)
    lines.append(separator)
    return "\n".join(lines)


def _format_confidence(score: float) -> str:
    return f"{score:.4f} ({score * 100:.2f}%)"


def _format_top_k_inline(top_k_items: list[dict[str, Any]]) -> str:
    return " | ".join(
        f"{item['label']} ({float(item['score']) * 100:.2f}%)" for item in top_k_items
    )


def _format_model_info_table(model_info: dict[str, Any]) -> str:
    metadata_rows = [
        ["Ruta modelo", model_info["model_path"]],
        ["Dispositivo", model_info["device"]],
        ["Max length", model_info["max_length"]],
        ["Return logits", model_info["return_logits"]],
        ["Tipo modelo", model_info["model_type"]],
        ["Arquitecturas", ", ".join(model_info["architectures"])],
        ["Numero de labels", model_info["num_labels"]],
    ]
    labels_rows = [
        [label_id, label]
        for label_id, label in model_info["id2label"].items()
    ]
    return "\n".join(
        [
            "Modelo cargado",
            _render_table(["Campo", "Valor"], metadata_rows),
            "",
            "Etiquetas",
            _render_table(["Label ID", "Label"], labels_rows),
        ]
    )


def _format_prediction_table(result: dict[str, Any]) -> str:
    summary_rows = [
        ["Texto", shorten(result["text"], width=88, placeholder="...")],
        ["Texto procesado", shorten(result["processed_text"], width=88, placeholder="...")],
        ["Etiqueta predicha", result["predicted_label"]],
        ["Label ID", result["predicted_label_id"]],
        ["Confianza", _format_confidence(float(result["confidence"]))],
    ]
    sections = [
        "Prediccion",
        _render_table(["Campo", "Valor"], summary_rows),
        "",
        "Top emociones",
        _render_table(
            ["Rank", "Label", "Label ID", "Score"],
            [
                [
                    rank,
                    item["label"],
                    item["label_id"],
                    _format_confidence(float(item["score"])),
                ]
                for rank, item in enumerate(result["top_k"], start=1)
            ],
        ),
    ]

    if "logits" in result:
        logits_text = ", ".join(f"{float(value):.4f}" for value in result["logits"])
        sections.extend(
            [
                "",
                "Logits",
                _render_table([f"Valores ({len(result['logits'])})"], [[logits_text]]),
            ]
        )

    return "\n".join(sections)


def _format_batch_table(results: list[dict[str, Any]]) -> str:
    rows = []
    for index, result in enumerate(results, start=1):
        rows.append(
            [
                index,
                shorten(result["text"], width=42, placeholder="..."),
                result["predicted_label"],
                _format_confidence(float(result["confidence"])),
                shorten(_format_top_k_inline(result["top_k"]), width=70, placeholder="..."),
            ]
        )

    return "\n".join(
        [
            "Predicciones por lote",
            _render_table(
                ["#", "Texto", "Prediccion", "Confianza", "Top-K"],
                rows,
            ),
        ]
    )


def _print_output(output: Any, output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return

    if isinstance(output, list):
        print(_format_batch_table(output))
        return

    print(_format_prediction_table(output))


def _print_model_info(model_info: dict[str, Any], output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(model_info, ensure_ascii=False, indent=2))
        return

    print(_format_model_info_table(model_info))


def _run_interactive_mode(
    classifier: EmotionClassifier,
    top_k: int,
    output_format: str,
) -> None:
    print("Modo interactivo activo. Escribe un texto y presiona Enter.")
    print("Comandos: /info, /help, /exit")

    while True:
        try:
            text = input("texto> ")
        except (EOFError, KeyboardInterrupt):
            print("\nSaliendo.")
            return

        stripped_text = text.strip()
        if not stripped_text:
            continue

        lowered = stripped_text.lower()
        if lowered in {"/exit", "/quit", "exit", "quit"}:
            print("Saliendo.")
            return
        if lowered in {"/help", "help"}:
            print("Escribe cualquier texto para clasificarlo.")
            print("Usa /info para ver el modelo cargado y /exit para salir.")
            continue
        if lowered == "/info":
            _print_model_info(classifier.get_model_info(), output_format)
            print()
            continue

        result = classifier.predict(stripped_text, top_k=top_k)
        _print_output(result, output_format)
        print()


def main() -> None:
    parser = _build_cli_parser()
    args = parser.parse_args()

    classifier = EmotionClassifier(
        model_path=args.model_path,
        device=args.device,
        max_length=args.max_length,
        return_logits=args.return_logits,
    )

    if args.info:
        _print_model_info(classifier.get_model_info(), args.format)

    if args.interactive:
        if args.info:
            print()
        _run_interactive_mode(
            classifier=classifier,
            top_k=args.top_k,
            output_format=args.format,
        )
        return

    texts = args.texts or []
    if not texts:
        if args.info:
            return
        parser.error("Debes pasar al menos un `--text`, usar `--interactive` o usar `--info`.")

    if len(texts) == 1:
        output: Any = classifier.predict(texts[0], top_k=args.top_k)
    else:
        output = classifier.predict_batch(texts, top_k=args.top_k)

    _print_output(output, args.format)


if __name__ == "__main__":
    main()
