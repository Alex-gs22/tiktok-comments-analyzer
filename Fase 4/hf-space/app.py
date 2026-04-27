import gradio as gr
from transformers import pipeline

# Load model once at startup
classifier = pipeline(
    "text-classification",
    model="FalexOne/robertuito-emociones-tiktok",
    top_k=6,
)

EMOTION_EMOJI = {
    "Alegría": "😊",
    "Confianza": "🤝",
    "Miedo": "😰",
    "Expectación": "😲",
    "Tristeza": "😢",
    "Rechazo": "😤",
}


def predict(text: str):
    """Classify emotion in a TikTok comment."""
    if not text or not text.strip():
        return {}
    results = classifier(text.strip())
    # results is [[{label, score}, ...]]
    preds = results[0] if isinstance(results[0], list) else results
    return {
        f"{EMOTION_EMOJI.get(p['label'], '')} {p['label']}": round(p["score"], 4)
        for p in preds
    }


demo = gr.Interface(
    fn=predict,
    inputs=gr.Textbox(
        label="Comentario de TikTok",
        placeholder="Ej: Que bonito video, me encantó! 😍",
        lines=2,
    ),
    outputs=gr.Label(num_top_classes=6, label="Emoción detectada"),
    title="🎭 Detector de Emociones — TikTok",
    description="Modelo RoBERTuito fine-tuneado para clasificar emociones en comentarios de TikTok en español.",
    examples=[
        ["Que bonito video, me encantó! 😍"],
        ["Eres el mejor creador de contenido, siempre confío en tus recomendaciones"],
        ["Me da miedo que esto pueda pasar en mi ciudad 😰"],
        ["No puedo creer lo que acabo de ver, no me lo esperaba!!"],
        ["Esto me pone muy triste, ojalá todo mejore pronto 😢"],
        ["Que asco de contenido, esto da mucho coraje 😤"],
    ],
    allow_flagging="never",
)

demo.launch()
