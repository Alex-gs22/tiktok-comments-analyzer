export default {
  async fetch(request, env, ctx) {
    // 1. Manejo de CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. Extraer URL del parámetro
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get("url");

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Falta el parámetro 'url'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      // 3. Obtener metadatos del video usando TikWM API (gratuita, sin signatures)
      const metaResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`);
      const metaData = await metaResponse.json();

      if (metaData.code !== 0 || !metaData.data) {
        throw new Error("No se pudo obtener la información del video. Verifica que la URL sea pública.");
      }

      const videoInfo = metaData.data;
      const title = videoInfo.title || "";
      
      // Auto-detección básica de temas (heurística)
      const detectTopic = (text) => {
        const t = text.toLowerCase();
        if (t.includes('checo') || t.includes('f1') || t.includes('formula 1') || t.includes('red bull')) return 'Checo Pérez';
        if (t.includes('migrante') || t.includes('ice') || t.includes('deportación') || t.includes('frontera')) return 'Desalojo de Migrantes';
        if (t.includes('boleto') || t.includes('reventa') || t.includes('ticketmaster') || t.includes('estafa')) return 'Estafas de Boletos (Reventa)';
        if (t.includes('lenguaje inclusivo') || t.includes('pronombre') || t.includes('elle')) return 'Lenguaje Inclusivo';
        if (t.includes('amlo') || t.includes('sheinbaum') || t.includes('gobierno') || t.includes('política')) return 'Política MX';
        if (t.includes('tesla') || t.includes('elon') || t.includes('spacex')) return 'Tesla';
        return 'Tema Desconocido'; // Fallback
      };

      const detectedTopic = detectTopic(title);

      // 4. Extraer Comentarios (paginación hasta 500)
      let allComments = [];
      let cursor = 0;
      let hasMore = true;
      const targetCount = 500;
      let attempts = 0;

      while (hasMore && allComments.length < targetCount && attempts < 10) {
        attempts++;
        const commentUrl = `https://www.tikwm.com/api/comment/list/?url=${encodeURIComponent(videoUrl)}&count=50&cursor=${cursor}`;
        const commentResponse = await fetch(commentUrl);
        const commentData = await commentResponse.json();

        if (commentData.code !== 0 || !commentData.data || !commentData.data.comments) {
          break; // Error o no hay más
        }

        const validComments = commentData.data.comments
          .filter(c => c.text && c.text.length >= 2 && !c.text.includes("[sticker]"))
          .map(c => ({
            id_comment: c.id,
            texto_raw: c.text,
            likes: c.digg_count || 0,
            fecha: c.create_time ? new Date(c.create_time * 1000).toISOString() : new Date().toISOString()
          }));

        allComments = allComments.concat(validComments);
        hasMore = commentData.data.has_more === 1;
        cursor = commentData.data.cursor;
        
        // Pequeño delay para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Limitar a 500 exactos si se pasó
      if (allComments.length > targetCount) {
        allComments = allComments.slice(0, targetCount);
      }

      // 5. Retornar JSON
      const responsePayload = {
        video_id: videoInfo.id,
        author: videoInfo.author?.nickname || 'Desconocido',
        title: title,
        play_count: videoInfo.play_count || 0,
        digg_count: videoInfo.digg_count || 0,
        detected_topic: detectedTopic,
        comments_extracted: allComments.length,
        comments: allComments
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
