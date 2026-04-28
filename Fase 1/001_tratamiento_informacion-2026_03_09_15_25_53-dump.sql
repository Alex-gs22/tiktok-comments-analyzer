--
-- PostgreSQL database dump
--

\restrict BFjnuAKx56DndMuJCS2xd8RCAfQXb3BIxNe9UbPkOsZWhxYzaMxxRVWwNBMnqhK

-- Dumped from database version 18.2 (Postgres.app)
-- Dumped by pg_dump version 18.2 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: corpus; Type: TABLE; Schema: public; Owner: alexgs
--

CREATE TABLE public.corpus (
    id integer NOT NULL,
    id_comment character varying(50) NOT NULL,
    video_id character varying(50) NOT NULL,
    texto_raw text NOT NULL,
    texto_limpio text,
    id_emocion integer,
    intensidad smallint,
    id_tema integer NOT NULL,
    likes integer DEFAULT 0,
    fecha timestamp without time zone,
    CONSTRAINT corpus_intensidad_check CHECK (((intensidad >= 1) AND (intensidad <= 4)))
);


ALTER TABLE public.corpus OWNER TO alexgs;

--
-- Name: corpus_id_seq; Type: SEQUENCE; Schema: public; Owner: alexgs
--

CREATE SEQUENCE public.corpus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corpus_id_seq OWNER TO alexgs;

--
-- Name: corpus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: alexgs
--

ALTER SEQUENCE public.corpus_id_seq OWNED BY public.corpus.id;


--
-- Name: emociones; Type: TABLE; Schema: public; Owner: alexgs
--

CREATE TABLE public.emociones (
    id integer NOT NULL,
    nombre character varying(30) NOT NULL,
    descripcion text,
    capa smallint NOT NULL,
    intensidad_min character varying(30) NOT NULL,
    intensidad_max character varying(30) NOT NULL,
    CONSTRAINT emociones_capa_check CHECK (((capa >= 1) AND (capa <= 3)))
);


ALTER TABLE public.emociones OWNER TO alexgs;

--
-- Name: emociones_id_seq; Type: SEQUENCE; Schema: public; Owner: alexgs
--

CREATE SEQUENCE public.emociones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.emociones_id_seq OWNER TO alexgs;

--
-- Name: emociones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: alexgs
--

ALTER SEQUENCE public.emociones_id_seq OWNED BY public.emociones.id;


--
-- Name: temas; Type: TABLE; Schema: public; Owner: alexgs
--

CREATE TABLE public.temas (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    categoria character varying(50),
    bloque character(1) NOT NULL,
    emociones_esperadas jsonb,
    CONSTRAINT temas_bloque_check CHECK ((bloque = ANY (ARRAY['A'::bpchar, 'B'::bpchar])))
);


ALTER TABLE public.temas OWNER TO alexgs;

--
-- Name: temas_id_seq; Type: SEQUENCE; Schema: public; Owner: alexgs
--

CREATE SEQUENCE public.temas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.temas_id_seq OWNER TO alexgs;

--
-- Name: temas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: alexgs
--

ALTER SEQUENCE public.temas_id_seq OWNED BY public.temas.id;


--
-- Name: corpus id; Type: DEFAULT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.corpus ALTER COLUMN id SET DEFAULT nextval('public.corpus_id_seq'::regclass);


--
-- Name: emociones id; Type: DEFAULT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.emociones ALTER COLUMN id SET DEFAULT nextval('public.emociones_id_seq'::regclass);


--
-- Name: temas id; Type: DEFAULT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.temas ALTER COLUMN id SET DEFAULT nextval('public.temas_id_seq'::regclass);


--
-- Data for Name: emociones; Type: TABLE DATA; Schema: public; Owner: alexgs
--

COPY public.emociones (id, nombre, descripcion, capa, intensidad_min, intensidad_max) FROM stdin;
1	Alegría	Estado de satisfacción, placer y bienestar positivo	2	Serenidad	Éxtasis
2	Confianza	Seguridad, aceptación y credibilidad hacia algo o alguien	2	Aceptación	Admiración
3	Miedo	Percepción de amenaza, peligro o incertidumbre	2	Aprensión	Terror
4	Sorpresa	Reacción ante algo inesperado, positiva o negativa	2	Distracción	Asombro
5	Tristeza	Estado de pérdida, melancolía o abatimiento	2	Pensativo	Duelo
6	Disgusto	Rechazo, aversión o repulsión ante algo percibido como malo	2	Aburrimiento	Loathing
7	Ira	Frustración, indignación o enojo ante una injusticia	2	Molestia	Furia
8	Anticipación	Expectativa o interés ante algo que está por venir	2	Interés	Vigilancia
\.


--
-- Data for Name: temas; Type: TABLE DATA; Schema: public; Owner: alexgs
--

COPY public.temas (id, nombre, descripcion, categoria, bloque, emociones_esperadas) FROM stdin;
1	La historia de beto	Cuenta la historia de un criminal en donde las opiniones se dividen entre quienes condenan sus actos y los que sienten empatia por el.	criminal_conspiracion	A	[2, 5, 7]
2	Madres buscadores	Trata sobre un grupo de madres dedicadas a la busqueda de los restos de hijos que han desaparecido a lo largo de los años y que sin apoyo alguno realizan sus esfuerzos por encontrar la verdad.	tragedia	A	[3, 5]
\.


--
-- Name: corpus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: alexgs
--

SELECT pg_catalog.setval('public.corpus_id_seq', 1607, true);


--
-- Name: emociones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: alexgs
--

SELECT pg_catalog.setval('public.emociones_id_seq', 8, true);


--
-- Name: temas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: alexgs
--

SELECT pg_catalog.setval('public.temas_id_seq', 2, true);


--
-- Name: corpus corpus_id_comment_key; Type: CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.corpus
    ADD CONSTRAINT corpus_id_comment_key UNIQUE (id_comment);


--
-- Name: corpus corpus_pkey; Type: CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.corpus
    ADD CONSTRAINT corpus_pkey PRIMARY KEY (id);


--
-- Name: emociones emociones_nombre_key; Type: CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.emociones
    ADD CONSTRAINT emociones_nombre_key UNIQUE (nombre);


--
-- Name: emociones emociones_pkey; Type: CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.emociones
    ADD CONSTRAINT emociones_pkey PRIMARY KEY (id);


--
-- Name: temas temas_pkey; Type: CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.temas
    ADD CONSTRAINT temas_pkey PRIMARY KEY (id);


--
-- Name: idx_corpus_emocion; Type: INDEX; Schema: public; Owner: alexgs
--

CREATE INDEX idx_corpus_emocion ON public.corpus USING btree (id_emocion);


--
-- Name: idx_corpus_fecha; Type: INDEX; Schema: public; Owner: alexgs
--

CREATE INDEX idx_corpus_fecha ON public.corpus USING btree (fecha);


--
-- Name: idx_corpus_tema; Type: INDEX; Schema: public; Owner: alexgs
--

CREATE INDEX idx_corpus_tema ON public.corpus USING btree (id_tema);


--
-- Name: idx_corpus_video; Type: INDEX; Schema: public; Owner: alexgs
--

CREATE INDEX idx_corpus_video ON public.corpus USING btree (video_id);


--
-- Name: corpus corpus_id_emocion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.corpus
    ADD CONSTRAINT corpus_id_emocion_fkey FOREIGN KEY (id_emocion) REFERENCES public.emociones(id) ON DELETE SET NULL;


--
-- Name: corpus corpus_id_tema_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alexgs
--

ALTER TABLE ONLY public.corpus
    ADD CONSTRAINT corpus_id_tema_fkey FOREIGN KEY (id_tema) REFERENCES public.temas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict BFjnuAKx56DndMuJCS2xd8RCAfQXb3BIxNe9UbPkOsZWhxYzaMxxRVWwNBMnqhK

