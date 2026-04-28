import asyncio
import re
from TikTokApi import TikTokApi
from supabase import create_client, Client
from datetime import datetime

# --- CONFIGURACIÓN DE SUPABASE ---
SUPABASE_URL = "https://sydwaobtzkmentrsikok.supabase.co"
SUPABASE_KEY = "sb_publishable_PvI4jjhOG-ubNvjDvqJJhQ_5EfgVrM9"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def limpiar_comentario_tiktok(texto):
    if not texto or not isinstance(texto, str):
        return None

    comentario = " ".join(texto.split())

    if "[sticker]" in comentario.lower():
        return None

    texto_sin_menciones = re.sub(r'@[\w\.-]+', '', comentario).strip()
    if not texto_sin_menciones:
        return None

    if len(texto_sin_menciones) < 2:
        return None

    return texto_sin_menciones


def obtener_ids_existentes(video_id: str) -> set:
    ids = set()
    page = 0
    PAGE_SIZE = 1000
    while True:
        response = (
            supabase
            .table("corpus_v2")
            .select("id_comment")
            .eq("video_id", video_id)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
            .execute()
        )
        data = response.data or []
        for fila in data:
            ids.add(str(fila["id_comment"]))
        if len(data) < PAGE_SIZE:
            break
        page += 1
    return ids


def guardar_comentarios(comentarios: list, id_tema: int):
    if not comentarios:
        print("No hay comentarios válidos para guardar.")
        return

    registros = [
        {
            "id_comment": c["id_comment"],
            "video_id": c["video_id"],
            "texto_raw": c["texto_raw"],
            "id_tema": id_tema,
            "likes": c["likes"],
            "fecha": c["fecha"].isoformat(),
        }
        for c in comentarios
    ]

    total_intentados = len(registros)
    nuevos_insertados = 0
    errores = 0
    BATCH = 100

    for i in range(0, len(registros), BATCH):
        lote = registros[i: i + BATCH]
        try:
            response = supabase.table("corpus_v2").upsert(
                lote,
                on_conflict="id_comment",
                ignore_duplicates=True
            ).execute()

            if response.data:
                nuevos_insertados += len(response.data)

        except Exception as e:
            print(f"  Error técnico en lote {i // BATCH + 1}: {e}")
            errores += 1

    omitidos = total_intentados - nuevos_insertados

    print(f"\n" + "=" * 30)
    print(f"   REPORTE DE BASE DE DATOS V2")
    print(f"=" * 30)
    print(f" Filas enviadas:    {total_intentados}")
    print(f" NUEVOS guardados:  {nuevos_insertados} ✅")
    print(f" OMITIDOS (ya existían): {omitidos} ⏭️")
    if errores > 0:
        print(f" ERRORES técnicos:  {errores} ❌")
    print(f"=" * 30 + "\n")


async def descargar_comentarios(video_url: str, id_tema: int, ms_token: str, objetivo: int = 650):
    async with TikTokApi() as api:
        await api.create_sessions(ms_tokens=[ms_token], num_sessions=1, sleep_after=5, headless=True, timeout=60000)

        print(f"\nProcesando Video: {video_url}")
        video = api.video(url=video_url)
        video_id = str(video.id)

        ids_existentes = obtener_ids_existentes(video_id)

        comentarios_nuevos = []
        descartados = 0
        leidos_totales = 0

        # Iteramos sin un límite fijo de 'count' para filtrar hasta llegar al objetivo
        async for comment in video.comments(count=2000):  # Pedimos un margen alto para filtrar
            leidos_totales += 1
            c_dict = comment.as_dict
            id_comment = str(c_dict.get("cid"))

            if id_comment in ids_existentes:
                continue

            texto_limpio = limpiar_comentario_tiktok(c_dict.get("text"))

            if not texto_limpio:
                descartados += 1
                continue

            comentarios_nuevos.append({
                "id_comment": id_comment,
                "video_id": video_id,
                "texto_raw": texto_limpio,
                "likes": c_dict.get("digg_count", 0),
                "fecha": datetime.fromtimestamp(c_dict.get("create_time", 0)),
            })

            # SI YA LLEGAMOS AL OBJETIVO, PARAMOS
            if len(comentarios_nuevos) >= objetivo:
                print(f"¡Objetivo de {objetivo} comentarios alcanzado!")
                break

            if leidos_totales % 50 == 0:
                print(f"  ... Llevamos {len(comentarios_nuevos)} válidos (leídos {leidos_totales} en total)")

        print(
            f"\nFINALIZADO: Aptos {len(comentarios_nuevos)} | Basura filtrada {descartados} | Leídos {leidos_totales}")
        return comentarios_nuevos


async def main():
    # --- CONFIGURACIÓN DE LA BÚSQUEDA ---
    id_tema_v2 = 8
    url_video = "https://www.tiktok.com/@pavelorockstar/video/7588331288608673025?q=lenguaje%20inclusivo&t=1776241669965"
    ms_token = "Ul62PYmyzJN3zLQ1Wmd68II84G5CRSZT7mlxnMoirMoGpD53SsCk49k0VqjT3vwcwA2Gz9g9P-vaQ1li2kZYYsYbJDKWVHA1RbmVrJs8ib-ctgzZM-5RLyLXR53Wc2cGsrbDXfgdhUZzT3tgqbylv4I7"

    # Cambiamos 'limite' por 'objetivo'
    comentarios = await descargar_comentarios(url_video, id_tema_v2, ms_token, objetivo=650)

    if comentarios:
        guardar_comentarios(comentarios, id_tema_v2)

if __name__ == "__main__":
    asyncio.run(main())