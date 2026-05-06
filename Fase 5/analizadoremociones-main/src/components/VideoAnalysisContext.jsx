"use client";
import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { classifyBatch } from '../lib/inferenceService';
import { insertPrediction, insertSession, insertVideo, getExistingVideoAnalysis } from '../lib/dataService';

const VideoAnalysisContext = createContext(null);

export function VideoAnalysisProvider({ children }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [autoTopic, setAutoTopic] = useState(true);
  const [step, setStep] = useState('idle');
  const [errorMsg, setErrorMsg] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [videoInfo, setVideoInfo] = useState(null);
  const [results, setResults] = useState(null);
  const isRunningRef = useRef(false);

  const handleReset = useCallback(() => {
    isRunningRef.current = false;
    setVideoUrl('');
    setTopic('');
    setAutoTopic(true);
    setStep('idle');
    setErrorMsg(null);
    setProgress({ current: 0, total: 0 });
    setVideoInfo(null);
    setResults(null);
  }, []);

  const handleScrapeAndAnalyze = useCallback(async () => {
    if (!videoUrl || isRunningRef.current) return;
    isRunningRef.current = true;
    setStep('scraping');
    setErrorMsg(null);
    setResults(null);
    setVideoInfo(null);

    const startTime = Date.now();

    try {
      const match = videoUrl.match(/\/(?:video|v)\/(\d+)/);
      const videoIdTiktok = match ? match[1] : null;

      if (videoIdTiktok) {
        setStep('checking_db');
        const existingData = await getExistingVideoAnalysis(videoIdTiktok);

        if (existingData && existingData.predicciones && existingData.predicciones.length > 0) {
          const { video, predicciones } = existingData;
          let totalInciertos = 0;
          let totalConfianza = 0;
          const emotionCounts = {};
          const commentResults = predicciones.map(p => {
            if (p.esIncierto) totalInciertos++;
            totalConfianza += p.confianza;
            emotionCounts[p.emocion] = (emotionCounts[p.emocion] || 0) + 1;
            return { texto: p.texto, emocion: p.emocion, confianza: p.confianza, likes: p.likes };
          });
          const emocionDominante = Object.entries(emotionCounts)
            .filter(([k]) => k !== 'Incierto')
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Incierto';
          const summary = {
            total: predicciones.length, totalInciertos, emocionDominante,
            confianzaPromedio: totalConfianza / predicciones.length,
            duracionMs: 0,
            distribution: Object.entries(emotionCounts).map(([emotion, count]) => ({
              emotion, count, pct: ((count / predicciones.length) * 100).toFixed(1),
            })).sort((a, b) => b.count - a.count),
            comments: commentResults.sort((a, b) => b.confianza - a.confianza),
          };
          setVideoInfo({
            video_id: video.video_id_tiktok, title: video.titulo,
            play_count: 0, digg_count: 0, author: 'Recuperado de DB',
            detected_topic: video.temas_produccion?.nombre || 'Tema General',
            comments_extracted: video.total_analizados, comments: []
          });
          setTopic(prev => autoTopic ? (video.temas_produccion?.nombre || '') : prev);
          setResults(summary);
          setStep('complete');
          isRunningRef.current = false;
          return;
        }
      }

      setStep('scraping');
      const metaResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`);
      const metaData = await metaResponse.json();
      if (metaData.code !== 0 || !metaData.data) {
        throw new Error(`Error de TikWM: ${metaData.msg || 'No se pudo obtener el video'}.`);
      }

      const videoData = metaData.data;
      const title = videoData.title || '';

      const detectTopic = (text) => {
        const t = text.toLowerCase();
        if (t.includes('checo') || t.includes('f1') || t.includes('formula 1') || t.includes('red bull')) return 'Checo Pérez';
        if (t.includes('migrante') || t.includes('ice') || t.includes('deportación') || t.includes('frontera')) return 'Desalojo de Migrantes';
        if (t.includes('boleto') || t.includes('reventa') || t.includes('ticketmaster') || t.includes('estafa')) return 'Estafas de Boletos (Reventa)';
        if (t.includes('lenguaje inclusivo') || t.includes('pronombre') || t.includes('elle')) return 'Lenguaje Inclusivo';
        if (t.includes('amlo') || t.includes('sheinbaum') || t.includes('gobierno') || t.includes('política')) return 'Política MX';
        if (t.includes('tesla') || t.includes('elon') || t.includes('spacex')) return 'Tesla';
        return 'Tema Desconocido';
      };

      const detectedTopic = detectTopic(title);
      let allComments = [];
      let cursor = 0;
      let attempts = 0;
      let consecutiveEmpty = 0;

      while (allComments.length < 800 && attempts < 40 && consecutiveEmpty < 3) {
        attempts++;
        try {
          const commentResponse = await fetch(`https://www.tikwm.com/api/comment/list/?url=${encodeURIComponent(videoUrl)}&count=50&cursor=${cursor}`);
          const commentData = await commentResponse.json();
          if (commentData.code !== 0 || !commentData.data?.comments?.length) {
            consecutiveEmpty++;
          } else {
            consecutiveEmpty = 0;
            const validComments = commentData.data.comments
              .filter(c => c.text && c.text.length >= 2 && !c.text.includes('[sticker]'))
              .map(c => ({
                id_comment: c.id, texto_raw: c.text, likes: c.digg_count || 0,
                fecha: c.create_time ? new Date(c.create_time * 1000).toISOString() : new Date().toISOString()
              }));
            validComments.forEach(vc => {
              if (!allComments.find(ac => ac.id_comment === vc.id_comment)) allComments.push(vc);
            });
          }
          cursor += 50;
        } catch { consecutiveEmpty++; }
        await new Promise(res => setTimeout(res, 400));
      }

      const scraperData = {
        video_id: videoData.id,
        author: videoData.author?.nickname || 'Desconocido',
        title, play_count: videoData.play_count || 0, digg_count: videoData.digg_count || 0,
        detected_topic: detectedTopic,
        comments: allComments.slice(0, 800)
      };

      if (!scraperData.comments.length) throw new Error('No se encontraron comentarios válidos en el video.');

      setVideoInfo(scraperData);

      let finalTopic;
      setTopic(prev => {
        finalTopic = autoTopic ? scraperData.detected_topic : (prev || 'Tema General');
        return finalTopic;
      });
      // wait one tick for finalTopic to be set from setTopic callback
      await new Promise(res => setTimeout(res, 0));
      finalTopic = autoTopic ? scraperData.detected_topic : (topic || 'Tema General');

      const texts = scraperData.comments.map(c => c.texto_raw);
      setStep('analyzing');
      setProgress({ current: 0, total: texts.length });

      const batchResults = await classifyBatch(texts, {
        onProgress: (current, total) => setProgress({ current, total }),
        delayMs: 50,
      });

      const duracionMs = Date.now() - startTime;
      const emotionCounts = {};
      let totalInciertos = 0;
      let totalConfianza = 0;
      const commentResults = [];

      batchResults.forEach((r, idx) => {
        const src = scraperData.comments[idx];
        emotionCounts[r.label] = (emotionCounts[r.label] || 0) + 1;
        if (r.isUncertain) totalInciertos++;
        totalConfianza += r.score;
        commentResults.push({ id: src.id_comment, texto: r.texto, emocion: r.label, confianza: r.score, likes: src.likes || 0, fecha: src.fecha });
      });

      const emocionDominante = Object.entries(emotionCounts)
        .filter(([k]) => k !== 'Incierto')
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Incierto';

      const summary = {
        total: texts.length, totalInciertos, emocionDominante,
        confianzaPromedio: totalConfianza / texts.length, duracionMs,
        distribution: Object.entries(emotionCounts).map(([emotion, count]) => ({
          emotion, count, pct: ((count / texts.length) * 100).toFixed(1),
        })).sort((a, b) => b.count - a.count),
        comments: commentResults.sort((a, b) => b.confianza - a.confianza),
      };

      setStep('saving');
      const videoIdDb = await insertVideo({
        url: videoUrl, video_id_tiktok: scraperData.video_id, titulo: scraperData.title,
        tema: finalTopic, temaAutoGenerado: autoTopic,
        totalComentarios: scraperData.comments.length, totalAnalizados: texts.length
      });

      if (videoIdDb) {
        for (const [idx, r] of batchResults.entries()) {
          const src = scraperData.comments[idx];
          await insertPrediction({
            texto: r.texto, emocion: r.label, confianza: r.score,
            esIncierto: r.isUncertain, scores: r.scores, tipo: 'batch_video',
            idVideo: videoIdDb, likes: src.likes, fecha: src.fecha
          });
        }
      }

      await insertSession({
        idVideo: videoIdDb, tipo: 'batch_video', totalProcesados: texts.length,
        totalInciertos, emocionDominante,
        confianzaPromedio: parseFloat((totalConfianza / texts.length).toFixed(4)), duracionMs,
      });

      setResults(summary);
      setStep('complete');
      isRunningRef.current = false;

    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
      isRunningRef.current = false;
    }
  }, [videoUrl, topic, autoTopic]);

  const isActive = step !== 'idle' && step !== 'complete' && step !== 'error';

  return (
    <VideoAnalysisContext.Provider value={{
      videoUrl, setVideoUrl,
      topic, setTopic,
      autoTopic, setAutoTopic,
      step, errorMsg, progress, videoInfo, results,
      handleReset, handleScrapeAndAnalyze,
      isActive,
    }}>
      {children}
    </VideoAnalysisContext.Provider>
  );
}

export function useVideoAnalysis() {
  const ctx = useContext(VideoAnalysisContext);
  if (!ctx) throw new Error('useVideoAnalysis must be used inside VideoAnalysisProvider');
  return ctx;
}
