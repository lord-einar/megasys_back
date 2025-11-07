--
-- PostgreSQL database dump
--

\restrict IlpUUee7nST1j60elGkvNmoloSllElw6TtNzln9ekQeOz4V1zl7QOQPCj0bhoZ7

-- Dumped from database version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum_historial_movimientos_tipo_movimiento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_historial_movimientos_tipo_movimiento AS ENUM (
    'transferencia',
    'prestamo',
    'devolucion',
    'asignacion',
    'mantenimiento'
);


ALTER TYPE public.enum_historial_movimientos_tipo_movimiento OWNER TO postgres;

--
-- Name: enum_inventario_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_inventario_estado AS ENUM (
    'disponible',
    'en_uso',
    'en_prestamo',
    'mantenimiento',
    'dado_de_baja'
);


ALTER TYPE public.enum_inventario_estado OWNER TO postgres;

--
-- Name: enum_personal_privilegio_app; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_personal_privilegio_app AS ENUM (
    'super_admin',
    'helpdesk',
    'support',
    'user'
);


ALTER TYPE public.enum_personal_privilegio_app OWNER TO postgres;

--
-- Name: enum_remitos_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_remitos_estado AS ENUM (
    'preparado',
    'en_transito',
    'entregado',
    'completado',
    'devuelto',
    'cancelado'
);


ALTER TYPE public.enum_remitos_estado OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO postgres;

--
-- Name: ejecutivos_cuentas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ejecutivos_cuentas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proveedor_id uuid NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    telefono character varying(20),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ejecutivos_cuentas OWNER TO postgres;

--
-- Name: empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre_empresa character varying(100) NOT NULL,
    cuit character varying(20),
    rason_social character varying(200),
    email character varying(100),
    telefono character varying(20),
    direccion character varying(200),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.empresas OWNER TO postgres;

--
-- Name: historial_movimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historial_movimientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventario_id uuid NOT NULL,
    remito_id uuid,
    sede_origen_id uuid NOT NULL,
    sede_destino_id uuid NOT NULL,
    tipo_movimiento public.enum_historial_movimientos_tipo_movimiento NOT NULL,
    fecha_movimiento timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usuario_id uuid,
    observaciones text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.historial_movimientos OWNER TO postgres;

--
-- Name: inventario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_articulo_id uuid NOT NULL,
    marca character varying(50) NOT NULL,
    modelo character varying(100) NOT NULL,
    numero_serie character varying(100),
    service_tag character varying(100),
    sede_id uuid NOT NULL,
    estado public.enum_inventario_estado DEFAULT 'disponible'::public.enum_inventario_estado NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_adquisicion date,
    valor_adquisicion numeric(12,2),
    observaciones text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.inventario OWNER TO postgres;

--
-- Name: personal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(50) NOT NULL,
    apellido character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    telefono character varying(20),
    sede_id uuid,
    rol_id uuid,
    privilegio_app public.enum_personal_privilegio_app DEFAULT 'user'::public.enum_personal_privilegio_app,
    activo boolean DEFAULT true NOT NULL,
    fecha_ingreso date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.personal OWNER TO postgres;

--
-- Name: personal_sedes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personal_sedes (
    id uuid NOT NULL,
    personal_id uuid NOT NULL,
    sede_id uuid NOT NULL,
    rol_id uuid NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.personal_sedes OWNER TO postgres;

--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa character varying(100) NOT NULL,
    direccion character varying(200),
    telefono character varying(20),
    email character varying(100),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.proveedores OWNER TO postgres;

--
-- Name: remito_detalles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remito_detalles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    remito_id uuid NOT NULL,
    inventario_id uuid NOT NULL,
    es_prestamo boolean DEFAULT false NOT NULL,
    fecha_devolucion_esperada timestamp with time zone,
    devuelto boolean DEFAULT false NOT NULL,
    fecha_devolucion_real timestamp with time zone,
    observaciones text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.remito_detalles OWNER TO postgres;

--
-- Name: remito_numero_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.remito_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.remito_numero_seq OWNER TO postgres;

--
-- Name: remitos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remitos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_remito character varying(20) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sede_origen_id uuid NOT NULL,
    sede_destino_id uuid NOT NULL,
    solicitante_id uuid NOT NULL,
    tecnico_asignado_id uuid,
    estado public.enum_remitos_estado DEFAULT 'preparado'::public.enum_remitos_estado NOT NULL,
    observaciones text,
    fecha_entrega timestamp with time zone,
    fecha_confirmacion timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.remitos OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    nivel_jerarquia integer DEFAULT 1 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: sede_asignaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sede_asignaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sede_id uuid NOT NULL,
    personal_id uuid NOT NULL,
    fecha_asignacion timestamp with time zone NOT NULL,
    fecha_fin_asignacion timestamp with time zone,
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sede_asignaciones OWNER TO postgres;

--
-- Name: sede_servicios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sede_servicios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sede_id uuid NOT NULL,
    servicio_id uuid NOT NULL,
    fecha_contratacion date,
    fecha_vencimiento date,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sede_servicios OWNER TO postgres;

--
-- Name: sedes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sedes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nombre_sede character varying(100) NOT NULL,
    direccion character varying(200) NOT NULL,
    localidad character varying(100) NOT NULL,
    provincia character varying(100) NOT NULL,
    pais character varying(100) DEFAULT 'Argentina'::character varying,
    telefono character varying(20),
    ip_sede character varying(15),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sedes OWNER TO postgres;

--
-- Name: servicios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo_servicio_id uuid NOT NULL,
    proveedor_id uuid NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.servicios OWNER TO postgres;

--
-- Name: soporte_niveles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.soporte_niveles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    servicio_id uuid NOT NULL,
    nivel integer NOT NULL,
    email character varying(100) NOT NULL,
    telefono character varying(20),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.soporte_niveles OWNER TO postgres;

--
-- Name: tipos_articulo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipos_articulo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tipos_articulo OWNER TO postgres;

--
-- Name: tipos_servicio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipos_servicio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tipos_servicio OWNER TO postgres;

--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SequelizeMeta" (name) FROM stdin;
20250724154500-create-empresas.js
20250724154501-create-sedes.js
20250724154507-create-roles.js
20250724154513-create-tipos-articulo.js
20250724154518-create-personal.js
20250724154525-create-inventario.js
20250724154530-create-proveedores.js
20250724154535-create-remitos.js
20250724154540-create-sede-asignaciones.js
20250724154520-create-personal-sedes.js
20250724154540-create-remito-numero-seq.js
\.


--
-- Data for Name: ejecutivos_cuentas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ejecutivos_cuentas (id, proveedor_id, nombre, email, telefono, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: empresas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empresas (id, nombre_empresa, cuit, rason_social, email, telefono, direccion, activo, created_at, updated_at) FROM stdin;
aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Megatlon	30-12345678-0	Megatlon S.A.	info@megatlon.com.ar	11-1234-5678	Reconquista 335, CABA	t	2025-11-05 18:15:19.418-03	2025-11-05 18:15:19.418-03
e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter	30-87654321-0	Fiter S.A.	info@fiter.com.ar	11-9876-5432	Buenos Aires, CABA	t	2025-11-05 18:15:19.418-03	2025-11-05 18:15:19.418-03
\.


--
-- Data for Name: historial_movimientos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.historial_movimientos (id, inventario_id, remito_id, sede_origen_id, sede_destino_id, tipo_movimiento, fecha_movimiento, usuario_id, observaciones, created_at, updated_at) FROM stdin;
68d764ef-a925-47bb-a191-1875e8c1216f	ea9214a8-f597-46a7-8c94-05c9043686b7	\N	61a68d90-48a8-488e-b17c-0226e16acd6c	61a68d90-48a8-488e-b17c-0226e16acd6c	asignacion	2025-11-05 19:30:29.784-03	\N	Item agregado al inventario	2025-11-05 19:30:29.784-03	2025-11-05 19:30:29.784-03
160d50cb-c40b-4459-9408-0927444755e3	ea9214a8-f597-46a7-8c94-05c9043686b7	a7d21732-441c-4c85-983e-21ac5402afcd	61a68d90-48a8-488e-b17c-0226e16acd6c	9bda64ac-0647-438d-8cd7-272c3233f97e	transferencia	2025-11-05 19:35:39.094-03	\N	Transferencia vía remito REM-2025-001	2025-11-05 19:35:39.094-03	2025-11-05 19:35:39.094-03
7fe6ab8b-8b73-46ed-8e3d-6223756059a7	c852fb9b-6add-44bd-9fd1-223cd5632812	\N	61a68d90-48a8-488e-b17c-0226e16acd6c	61a68d90-48a8-488e-b17c-0226e16acd6c	asignacion	2025-11-05 20:06:10.431-03	\N	Item agregado al inventario	2025-11-05 20:06:10.432-03	2025-11-05 20:06:10.432-03
73d912a9-ccfd-4436-9f08-94c8f11da688	c852fb9b-6add-44bd-9fd1-223cd5632812	2a1648c6-19b8-4ea8-aa04-bbdf0ec17402	61a68d90-48a8-488e-b17c-0226e16acd6c	4b26716b-39b7-42e7-8eaa-de6c763f70ef	transferencia	2025-11-05 20:06:43.603-03	\N	Transferencia vía remito REM-2025-002	2025-11-05 20:06:43.604-03	2025-11-05 20:06:43.604-03
d4ea978c-9148-41dc-9b12-1b83b06e80cb	4b1fb6ac-b4cc-4549-acda-d8dc84c74e88	\N	61a68d90-48a8-488e-b17c-0226e16acd6c	61a68d90-48a8-488e-b17c-0226e16acd6c	asignacion	2025-11-05 20:10:02.781-03	\N	Item agregado al inventario	2025-11-05 20:10:02.781-03	2025-11-05 20:10:02.781-03
1785cd8b-b499-4af3-a592-b730271862bf	4b1fb6ac-b4cc-4549-acda-d8dc84c74e88	ddfa0585-258f-4168-b9fa-acb46b3a50df	61a68d90-48a8-488e-b17c-0226e16acd6c	3b7f5e82-dc19-4733-a652-171ca82a6695	transferencia	2025-11-05 20:10:32.909-03	\N	Transferencia vía remito REM-2025-003	2025-11-05 20:10:32.909-03	2025-11-05 20:10:32.909-03
f0ab74ae-8a66-4365-a775-4dd62d31a273	22bf08ee-cfa8-4191-8914-2287ac0e33bf	\N	61a68d90-48a8-488e-b17c-0226e16acd6c	61a68d90-48a8-488e-b17c-0226e16acd6c	asignacion	2025-11-05 22:19:18.215-03	\N	Item agregado al inventario	2025-11-05 22:19:18.215-03	2025-11-05 22:19:18.215-03
6fc5b15d-1dc9-4c49-bb90-3a27ba3208ad	22bf08ee-cfa8-4191-8914-2287ac0e33bf	24202bcd-30e1-4b30-869b-464001b6d2de	61a68d90-48a8-488e-b17c-0226e16acd6c	f83c60ae-9149-4f36-ba2f-b0f772edfd1a	prestamo	2025-11-05 22:25:11.418-03	\N	Préstamo vía remito REM-2025-004	2025-11-05 22:25:11.419-03	2025-11-05 22:25:11.419-03
9b6371e0-77c4-4be0-8bf7-da0a9f5fb544	7213353e-8988-48d0-bfd7-77f8fe9472ce	\N	61a68d90-48a8-488e-b17c-0226e16acd6c	61a68d90-48a8-488e-b17c-0226e16acd6c	asignacion	2025-11-06 12:50:10.428-03	\N	Item agregado al inventario	2025-11-06 12:50:10.429-03	2025-11-06 12:50:10.429-03
9356fa1a-3630-40af-b3d9-69e273665285	7213353e-8988-48d0-bfd7-77f8fe9472ce	5c5af01e-612d-48c5-8476-c1f95c5b69c0	61a68d90-48a8-488e-b17c-0226e16acd6c	dc85a3a6-00da-4d1b-848b-fe8e8b1e8867	prestamo	2025-11-06 12:52:29.88-03	\N	Préstamo vía remito REM-2025-005	2025-11-06 12:52:29.88-03	2025-11-06 12:52:29.88-03
\.


--
-- Data for Name: inventario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventario (id, tipo_articulo_id, marca, modelo, numero_serie, service_tag, sede_id, estado, activo, fecha_adquisicion, valor_adquisicion, observaciones, created_at, updated_at) FROM stdin;
ea9214a8-f597-46a7-8c94-05c9043686b7	e316b14b-9adc-44a7-9c20-8adbaea8ad03	Dahua	M32	112233	asd123	9bda64ac-0647-438d-8cd7-272c3233f97e	en_uso	t	\N	\N	\N	2025-11-05 19:30:29.782-03	2025-11-05 19:35:39.092-03
c852fb9b-6add-44bd-9fd1-223cd5632812	dfc55cb9-0733-4495-bb7c-6f36783b8b78	Samsung	3110	552200	aaqwef	4b26716b-39b7-42e7-8eaa-de6c763f70ef	en_uso	t	\N	\N	\N	2025-11-05 20:06:10.427-03	2025-11-05 20:06:43.602-03
4b1fb6ac-b4cc-4549-acda-d8dc84c74e88	0231c92c-219c-4116-bc06-4b2117f9db03	LG	5454	159486	456456	3b7f5e82-dc19-4733-a652-171ca82a6695	en_uso	t	\N	\N	\N	2025-11-05 20:10:02.776-03	2025-11-05 20:10:32.907-03
22bf08ee-cfa8-4191-8914-2287ac0e33bf	1dd2c6be-74ca-4a13-b807-95aa47c60fd8	Laenovo	ThinkPad E16	fqefqw	asd123	61a68d90-48a8-488e-b17c-0226e16acd6c	en_prestamo	t	\N	\N	\N	2025-11-05 22:19:18.212-03	2025-11-05 22:25:11.417-03
7213353e-8988-48d0-bfd7-77f8fe9472ce	d9634000-ab29-4763-bd9d-441a36c8dff1	Hikvision	321321	wqefwefw	fqwfqw	61a68d90-48a8-488e-b17c-0226e16acd6c	en_prestamo	t	\N	\N	\N	2025-11-06 12:50:10.426-03	2025-11-06 12:52:29.878-03
\.


--
-- Data for Name: personal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.personal (id, nombre, apellido, email, telefono, sede_id, rol_id, privilegio_app, activo, fecha_ingreso, created_at, updated_at) FROM stdin;
d999f872-226a-4f1d-a25b-eafe0ad5d5d2	German	Di Natale	germanojeda83@gmail.com	1123472076	9bda64ac-0647-438d-8cd7-272c3233f97e	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 19:33:15.464-03	2025-11-05 19:33:15.464-03
7a834c70-e540-4ee3-a79b-9b298c704e83	Emiliano	Lema	elema@megatlon.com.ar	\N	\N	\N	support	t	2025-11-05	2025-11-05 21:50:59.946-03	2025-11-05 21:50:59.946-03
2e8ca96f-9371-468a-910e-a65a35846656	Nahuel	Ramirez	cramirez@megatlon.com.ar	1144558877	61a68d90-48a8-488e-b17c-0226e16acd6c	79b66bb0-62f5-4cb3-9fc0-3a863f55612e	user	t	2025-11-05	2025-11-05 19:34:09.668-03	2025-11-05 19:34:09.668-03
916a9329-6877-4f02-8601-b1c86727141b	Pablo	Velazquez Mann	pvelazquez@megatlon.com.ar	123124154	af667648-4b28-466b-8c2b-219199f95c28	79b66bb0-62f5-4cb3-9fc0-3a863f55612e	user	t	2025-11-06	2025-11-06 12:51:01.405-03	2025-11-06 12:51:01.405-03
ada6f95e-397e-4654-a6e4-4fb1826bd3b0	Marina	Socolovsky	msocolovsky@megatlon.com.ar	15.5705.2411	8c194579-8f8a-4c3f-812c-846a3628b342	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.443-03	2025-11-05 18:15:19.443-03
72883f2a-e1b6-4e6a-bd3c-8209f86b8eec	Mariela	Funes	marielaf@megatlon.com.ar	11.3699.7258	84e52909-0115-4b9b-a10b-58892eaa2146	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.443-03	2025-11-05 18:15:19.443-03
99728b17-ac9f-411a-af09-3cd1f2cc5866	Maria Sol	Portunato	mportunato@megatlon.com.ar	11.3143.1550	84e52909-0115-4b9b-a10b-58892eaa2146	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
0bf6465a-daf1-401e-81e2-2247f86d2cf4	Giselle	Benítez	gbenitez@megatlon.com.ar	11.2819.4884	84e52909-0115-4b9b-a10b-58892eaa2146	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
725d9c93-abf6-42e5-b22c-ca83082489fc	Matias	Baez	mbaez@megatlon.com.ar	\N	84e52909-0115-4b9b-a10b-58892eaa2146	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
12d1a1d5-236c-425e-ad8b-69d90a201d7e	Juan Ignacio	Martinez	jimartinez@megatlon.com.ar	11.3671.0887	e86acc8b-6d2e-41eb-9426-5037f22d2b9e	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
f0782d62-4f74-43d0-addf-11e151fbc826	Mariano	Espinosa	mespinosa@megatlon.com.ar	11.6915.0927	e86acc8b-6d2e-41eb-9426-5037f22d2b9e	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
661ddf9e-b54b-4200-9cfe-a9e52ef236cb	Alejandro	Hornak	ahornak@megatlon.com.ar	341502.3790	af8fa991-b4e2-4202-8b4c-1f1dc3b382ad	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
1eb1d91a-7118-41da-921f-d7b10ae31db0	Marcelo	Dorigon	mdorigon@megatlon.com.ar	341.384.6203	af8fa991-b4e2-4202-8b4c-1f1dc3b382ad	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
3bdd8ae5-1ce6-4e77-9e27-89070f42857d	Sergio	Canavese	sergiocanavese@megatlon.com.ar	11.5690.3300	c1a7c17c-51d8-48c3-aa47-a4b9083e4410	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
a7db7169-ef56-42f8-9ae8-4ae6c5d06c8a	Pablo	Spinassi	pspinassi@megatlon.com.ar	11.3699.1454	c1a7c17c-51d8-48c3-aa47-a4b9083e4410	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
7890e141-bd7f-4457-a97a-47255c681dfc	Valeria	Gonzalez	vgonzalez@megatlon.com.ar	11.4164.2843	c1a7c17c-51d8-48c3-aa47-a4b9083e4410	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
583bc71d-2d75-4926-9a70-921cbd7eeb52	Laura	Ledesma	mledesma@megatlon.com.ar	15.3636.7348	c1a7c17c-51d8-48c3-aa47-a4b9083e4410	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
93d402b3-0ee3-41c4-85fa-8478c7ac9c62	Jaqueline Del	Vento	jdelvento@megatlon.com.ar	11.4024.6299	606874f8-605b-40fe-8304-d00b74a8b131	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
2f821999-3818-4978-bb6f-09e80e22d5b3	Ariana	Gallero	agallero@megatlon.com.ar	11.3921.6317	606874f8-605b-40fe-8304-d00b74a8b131	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
65e47669-b7f2-4bf1-919e-77c63a15f769	Marisa	Iglesias	meiglesias@megatlon.com.ar	\N	606874f8-605b-40fe-8304-d00b74a8b131	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
974bd2ac-b555-4bbb-b7fd-0f055debf5fe	Mariano	Lantaño	mlantano@megatlon.com.ar	11.03689.4782	6449cddd-5f7a-4e90-aa66-d9072f92088e	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
ce1edcfa-5d73-4d9d-9a71-2d841348a339	Carina	Alvarez	calvarez@megatlon.com.ar	11.3636.7803	6449cddd-5f7a-4e90-aa66-d9072f92088e	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
98b51633-f7ca-4817-95f5-c55f3f9fb4cb	Diego	Pugnali	dpugnali@megatlon.com.ar	11.5995.9134	6449cddd-5f7a-4e90-aa66-d9072f92088e	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
0cbeff23-737b-4117-a721-19c628efa1c4	Carla	Garcia	cgarcia@megatlon.com.ar	11 6928-1367	6449cddd-5f7a-4e90-aa66-d9072f92088e	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
d64653b4-0edb-4556-8761-1a29664dde2c	Sebastian	Machado	smachado@megatlon.com.ar	11.5877.6877	bb467f81-fd80-48bc-93ed-d2db59b3ba08	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
565a38bf-4bf0-4f01-89f7-7d54ff3eb592	Fabian	Llanos	fllanos@megatlon.com.ar	11.3699.9905	f7b3560f-a420-4f12-afbc-d244bc5a7d4d	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
f08dc54f-b3cd-4560-b316-6c8061c59a9d	Federico	Apa	fapa@megatlon.com.ar	11.6194.1795	f7b3560f-a420-4f12-afbc-d244bc5a7d4d	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
f22cb754-b571-44b9-bd67-52ed9092b8b7	Gaston	Cools	gcools@megatlon.com.ar	11.2279.8395	f7b3560f-a420-4f12-afbc-d244bc5a7d4d	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
15b6b624-d450-431e-90d3-d2201c8ce27c	Gustavo Bruno	Pedrozo	gpedrozo@megatlon.com.ar	\N	f7b3560f-a420-4f12-afbc-d244bc5a7d4d	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
73afe7ee-6226-4615-8e44-38d44dcfb538	Karina	Barrera	kbarrera@megatlon.com.ar	11.3923.4486	66b598b2-afb7-4763-bcb1-f03776db8460	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
83369d74-37be-4cc6-a566-96868ac44dad	Andrea	Robledo	arobledo@megatlon.com.ar	11.6532.8816	66b598b2-afb7-4763-bcb1-f03776db8460	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
06ec3a39-7354-442d-8006-e5785ff00148	Raúl	Valdes	rvaldes@megatlon.com.ar	15.3701.5801	4b26716b-39b7-42e7-8eaa-de6c763f70ef	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
bd7fa179-244d-423f-82d1-493343bb064d	Agustina	Rodriguez	agrodriguez@megatlon.com.ar	11.2302.8878	4b26716b-39b7-42e7-8eaa-de6c763f70ef	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
b2a16d6e-5374-45f2-b4b5-0aecdc4fce40	Marcelo	Bahamonde	mbahamonde@megatlon.com.ar	35115629-3207	4b26716b-39b7-42e7-8eaa-de6c763f70ef	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
853ce3bc-cf34-4f0c-b07e-535e49551073	Luciano	Carranza	lcarranza@megatlon.com.ar	351.541.2448	4b26716b-39b7-42e7-8eaa-de6c763f70ef	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
fb91029e-1e40-4ee5-ba84-aef1217c0390	Julio	Altamirano	jaltamirano@megatlon.com.ar	35115220.1494	3b7f5e82-dc19-4733-a652-171ca82a6695	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
22a031e8-ee6f-4d01-a36e-0c13ab400b4a	Mariana	Sierra	msierra@megatlon.com.ar	351222-8466	86cea700-fe75-40d8-a0ba-278da87b022a	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
dfa83292-914b-45b7-b94c-79ec5f6336ae	Camila	Muñoz	cmunoz@megatlon.com.ar	11.3642.1420	86cea700-fe75-40d8-a0ba-278da87b022a	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
d12336d2-9a3e-4865-94bd-080ceff3ceb3	Elizabet	Palazzo	epalazzo@megatlon.com.ar	11.3699.8508	c34e5222-0a6f-46ca-a5a3-efd9f9360ca7	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
4bc7354d-67cb-456c-ac07-941ae64d1319	Analía	Madrid	fmadrid@megatlon.com.ar	11.4147.1740	c34e5222-0a6f-46ca-a5a3-efd9f9360ca7	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
b236ebb6-e16c-40e7-9f85-fa08c7a448c8	Leandro	Oddo	Loddo@megatlon.com.ar	11.4927.7165	c34e5222-0a6f-46ca-a5a3-efd9f9360ca7	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
fac4bcad-d85f-47a1-b853-c4b03070d9cb	Marcos	Ramirez	mramirez@megatlon.com.ar	11.3906.6806	f83c60ae-9149-4f36-ba2f-b0f772edfd1a	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
fe610a45-8859-4656-a85e-f263c7a631ae	Martin Ezequiel	Cortez	mcortez@megatlon.com.ar	11.2352.7114	f83c60ae-9149-4f36-ba2f-b0f772edfd1a	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
671f9f28-ae19-4192-8417-376ae3bcbb99	Marcela	Regueiro	mregueiro@megatlon.com.ar	11.3699.7201	7748fbbc-029a-420b-b32f-1779662b0ec9	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
eeeed5c3-3bd2-4e93-a6f9-d28699ed15e0	Denise	Bordon	dbordon@megatlon.com.ar	11 3212-9726	7748fbbc-029a-420b-b32f-1779662b0ec9	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
8dd0b2f6-6732-42ba-9bf6-97deb2210df2	Damian	Fiorvago	dfiorvago@megatlon.com.ar	11.5346.7426	9cee4d89-9444-45a9-a4e5-ec85a6ca4659	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
3b6c950f-e30e-4082-a679-06d3490b4fa5	Jorge	Leguizamon	jleguizamon@megatlon.com.ar	11.4401.1154	9cee4d89-9444-45a9-a4e5-ec85a6ca4659	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
ec234e06-ffc4-45e4-b63a-f32b7946d47d	Alejandro	Llamas	allamas@megatlon.com.ar	11.2329.3388	26e0adf0-563f-4c82-acfb-5eb521be857a	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
706222f7-6cd3-4685-a5cd-ad6fcfe4d6a1	Griselda	Ciamberlini	gciamberlini@megatlon.com.ar	11.3598.7791	26e0adf0-563f-4c82-acfb-5eb521be857a	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
72365767-9026-459c-8c6f-df1d0ee6f17d	Javier	Ugo	javieru@megatlon.com.ar	11.3691.7137	88bfcc8a-cb50-4745-ac16-f5df6650acc6	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
a668e7f0-5bb1-4609-80e0-951337981a56	Mercedes	Marocchi	mmarocchi@megatlon.com.ar	11.6874.2996	88bfcc8a-cb50-4745-ac16-f5df6650acc6	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
e0af3619-8232-48f8-9960-a8a506e78ac8	Alejandro De	Nadai	adenadai@megatlon.com.ar	11.3695.2614	88bfcc8a-cb50-4745-ac16-f5df6650acc6	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
a920b1ee-b3a6-4f94-beb6-213b22a8a763	Martin	Lavega	mlavega@megatlon.com.ar	15.7026.1295	88bfcc8a-cb50-4745-ac16-f5df6650acc6	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
c7491add-db22-44d1-9a93-e3deebcccb47	Fernando	Laso	flaso@megatlon.com.ar	11.3699.7981	670ea839-db6b-401c-95ce-da05bcda0fcb	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
627d8f65-a141-43d8-a95a-edd08532fd85	Victoria	Bacelar	mbacelar@megatlon.com.ar	\N	670ea839-db6b-401c-95ce-da05bcda0fcb	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
f676ecbe-8e2c-4c11-86c2-900d8e8975c8	Victor	Ortiz	vortiz@megatlon.com.ar	11.4915.1218	76a3dfaf-e7ae-412f-b42b-0241f783c49f	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
7fbabf4b-0a63-4ad9-b90e-be3656ae10ff	Veronica	Sanchez	veronicasanchez@megatlon.com.ar	11.2377.6469	76a3dfaf-e7ae-412f-b42b-0241f783c49f	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
53ca1fab-9875-4ec8-8653-521b8c777dd8	Rosana	Mancini	rosanam@megatlon.com.ar	11.4403.4277	9ac420d0-967a-4bb5-b5d4-a0cf5c72fdbb	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
434dcc8e-9736-42ce-9a35-5f2689dacd4d	Luciana	Navarro	lnavarro@megatlon.com.ar	11.5338.8027	9ac420d0-967a-4bb5-b5d4-a0cf5c72fdbb	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
345e4242-4e55-4afd-8ee0-84f2ed11f7c9	Juan Pablo	Estrella	jprodriguezestrella@megatlon.com.ar	11.3689.8942	9ac420d0-967a-4bb5-b5d4-a0cf5c72fdbb	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
10894981-4a04-47c8-9124-e1bcbf2f78db	Cristina	Dionisi	cdionisi@megatlon.com.ar	11.3909.4617	9ac420d0-967a-4bb5-b5d4-a0cf5c72fdbb	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
2923416e-0393-472b-9326-72ae132c9984	Lucía	Saez	lucias@megatlon.com.ar	11.3699.8838	dc85a3a6-00da-4d1b-848b-fe8e8b1e8867	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
3d8827ca-46d1-4b81-8e03-b27583dc28df	Mariano	Dominguez	mdominguez@megatlon.com.ar	11.4025.7431	cdcc13ac-2815-4192-81af-031b73746625	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
f251c69b-b2dd-44a0-8627-ed2f0acc561d	Mario	Vega	mvega@megatlon.com.ar	11.03599.8987	cdcc13ac-2815-4192-81af-031b73746625	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
319cf2f7-8488-40ce-b9c8-cdb8e733a8d2	Nicolás	Monacci	nmonacci@megatlon.com.ar	11.4401.4711	cdcc13ac-2815-4192-81af-031b73746625	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
4807e6ed-350f-42ba-ac50-7de54283724d	Jessica Cristina	Vargas	jcvargas@megatlon.com.ar	11.2303.3986	cdcc13ac-2815-4192-81af-031b73746625	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
e0cb1a51-12a5-4ab3-b14b-d7bd9602573e	Mónica	Tatare	mtatare@megatlon.com.ar	11.3641.8761	8ad65e70-4cf0-4e7f-83e0-d286e2ca578e	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
dded5df4-2c9b-4e1c-88de-7f4dc7d9e3fe	Cristian	Fajardo	cfajardo@megatlon.com.ar	\N	8ad65e70-4cf0-4e7f-83e0-d286e2ca578e	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
c05fa378-3c82-4555-8983-24c866d2a71f	Javier De	Nino	jdenino@megatlon.com.ar	11.5749.6528	f051d038-971d-4ea7-8c34-3c4fd7637381	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
caf00379-81a8-4ef7-bf38-88657ef7ac07	Natalia	Nieva	nnieva@megatlon.com.ar	11.2300.7785	f051d038-971d-4ea7-8c34-3c4fd7637381	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
62570a15-df82-484f-9c19-1d011be2f451	Ezequiel	Schneider	eschneider@megatlon.com.ar	\N	f051d038-971d-4ea7-8c34-3c4fd7637381	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
cd11a7b8-f809-4cd0-88d8-6161bf05310d	Nicolas	Acosta	nacosta@megatlon.com.ar	11.3627.2411	0473510e-d1d2-44e5-8a22-87e92c63d66a	ba3a9851-2f5d-426a-b61c-e369c5d66189	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
c84f95db-1f59-4768-9aec-f1f0ecd25047	Ezequiel	Cappelutti	ecappelutti@megatlon.com.ar	\N	0473510e-d1d2-44e5-8a22-87e92c63d66a	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
42d23450-4dc0-43b6-a1c9-3b792c260876	Alejandro	Mengarelli	amengarelli@megatlon.com.ar	341.15389.7946	fcf5ae2f-d93f-4fa4-9fc8-c516390808f2	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
f228bc3e-a20d-4d18-b7c6-734b3b007911	Andres	Lugli	alugli@megatlon.com.ar	0341.383.3711	fcf5ae2f-d93f-4fa4-9fc8-c516390808f2	9a773a8c-c67e-4279-abec-3d4fd26f0050	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
324ac924-ec21-4a14-832e-f8b16e11f3ca	Nicolas	Agri	nagri@megatlon.com.ar	341.668.6523	fcf5ae2f-d93f-4fa4-9fc8-c516390808f2	826fafe7-23c2-4376-bc83-42051d85ace2	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
e5701f81-79e8-4ad1-a36f-b71557d39e99	Sofia	Zabala	szabala@megatlon.com.ar	341.388.7990	fcf5ae2f-d93f-4fa4-9fc8-c516390808f2	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
ceb3d0b5-c7ec-4838-9a3e-25a0c037a22b	Fabian	Jigena	fjigena@megatlon.com.ar	11.6924.2210	af667648-4b28-466b-8c2b-219199f95c28	5af80f22-59a3-405d-9da5-e003ab99f0e3	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
64bf3ee8-2357-4709-bc8a-47e1625aea3e	Ailin	Olivieri	aolivieri@megatlon.com.ar	11.2278.3814	af667648-4b28-466b-8c2b-219199f95c28	ceff0152-e495-41a0-995d-2577146b074c	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
82ee0d9e-cdc0-4fdd-8c86-b460701acc5d	Matias	Rey	mrey@megatlon.com.ar	15.3636.6880	af667648-4b28-466b-8c2b-219199f95c28	e7fbc3ac-fad5-4bb3-946e-96a35466d267	user	t	2025-11-05	2025-11-05 18:15:19.444-03	2025-11-05 18:15:19.444-03
25b37185-3483-4395-83bc-72a81822a50e	Fatima	Carrillo	fcarrillo@fiter.com.ar	11 3699-6879	9bda64ac-0647-438d-8cd7-272c3233f97e	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
d690625f-a061-4379-9b79-fc485f5f5e33	Jimena	Castro	jcastro@fiter.com.ar	11 3683-6019	a82e056a-0c39-4bc6-93d1-42d31e73184a	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
6ca77ce0-266d-47eb-a544-518235ad4e72	Hernan	Schmilchuk	hschmilchuk@fiter.com.ar	11 6646-1000	c5cbd90f-bffb-4bd8-8b47-382fab7ba6c2	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
c43695c1-f2cb-4ba6-9605-cac2df9ad951	Yanina	Morell	ymorell@fiter.com.ar	11 3683-9938	a3db1c22-cc2c-4e8c-8866-aaeb2da8d1f6	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
5d095031-8bf8-476c-af1f-71091d99ac2d	Ivan	Sivori	gsivori@fiter.com.ar	11 3882 1359	66b0cbd2-8bc8-40a7-b2a1-7a66787960ba	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
b2de9d5c-a0e1-4f81-a091-be0d8121d053	Luis	Albornoz	lalbornoz@fiter.com.ar	11-3588-9335	5f7cbd0d-ce6f-40ed-b609-3847077c6347	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
edccd8cf-bb35-4a67-ba61-02eee28180d1	Lucas	Coria	lcoria@fiter.com.ar	114406-9398	709004d1-08c9-4ff4-acac-6350d76e34f6	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
4f1a326d-1795-4171-b2e0-9fcdab024019	Amelia	Wild	awild@fiter.com.ar	11 5603-7579	bb2a17ad-6a50-4216-9358-c21240443012	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
44242767-3ca6-4ef1-9832-2728c9eab642	Brian	Hindle	bhindle@fiter.com.ar	11 3155-5309	4471ca90-ab94-47c1-8745-d42e646260e6	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
fd673356-5585-4e43-adaa-22f613ca8b2d	Alejandro	Diaz	adiaz@fiter.com.ar	11 3701-8352	135c8b64-e89e-439f-a288-4df57160192c	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
6049a7ae-5ec1-4283-b95d-f3ed285b8cfe	Ana	Rivas	arivas@fiter.com.ar	1102789-3505	10650ba9-4b48-4c0d-91d8-86f56677a16a	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
f7fa6c77-17ed-4740-9d7d-b5ddd9073481	Andres	Vallenilla	avallenilla@fiter.com.ar	\N	9df2bfcd-92a6-42d8-95cf-511f66208a93	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
5ed689db-1128-4bf0-b8bd-e8a4aa949ba8	Cristina	Sanchez	csanchez@fiter.com.ar	11 5661-5550	65a82b90-de69-4698-bbb7-af861678b545	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
603bfe2d-1c91-4dae-bc12-c6cde052c00a	Karlen	Morantes	kmorantes@fiter.com.ar	11 2868-6987	c5d5b139-c0f2-4367-b8ed-6ca65b470a3b	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
b36e2242-b9e0-4521-9dcf-1cf89d58c895	Laura	Abramowitz	labramowitz@fiter.com.ar	11 4195-7008	5949bae0-eda5-4011-a649-63643e6107a9	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
d674c9da-920b-4913-808e-41147d9bc824	Martina	Diaz	diaz@fiter.com.ar	11 5603-7579	96749710-bb23-4ca4-824d-f398acb39db2	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
697ef321-7a27-49ee-b59f-fb24a86d39c0	Ana	Vera	avera@fiter.com.ar	11 2868 6987	7b840a79-1c49-4e0d-903c-f311c0cb266d	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
4190d5dc-a353-44ac-87c1-4df4d1e4d207	Pablo	Bidone	pbidone@fiter.com.ar	+598 95 462 935	322416a2-4472-4121-9cea-ca75b318e0ea	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
923adfc2-f701-46fa-98c4-3e81ca351df6	Roman	Spagnuolo	rspagnuolo@fiter.com.ar	+54 9 11 2827-9358	66427879-162c-45b7-8d11-ad0dc25be466	02919da9-8a5e-40ae-b453-65379f25c663	user	t	2025-11-05	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
8a667a20-ce0d-40d9-ba7a-7a485acdc052	German	Luis Ojeda	gojeda@megatlon.com.ar	\N	\N	\N	super_admin	t	2025-11-05	2025-11-05 19:45:46.425-03	2025-11-05 19:45:46.425-03
\.


--
-- Data for Name: personal_sedes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.personal_sedes (id, personal_id, sede_id, rol_id, fecha_inicio, fecha_fin, activo, created_at, updated_at) FROM stdin;
ae9dcd77-d9cc-4a1c-bf8e-bbe5a2ce278e	25b37185-3483-4395-83bc-72a81822a50e	9bda64ac-0647-438d-8cd7-272c3233f97e	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
2183f950-a265-401d-89ef-a8e096a8bb40	d690625f-a061-4379-9b79-fc485f5f5e33	a82e056a-0c39-4bc6-93d1-42d31e73184a	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
1449c372-11bb-486e-add6-ee868fd149ee	6ca77ce0-266d-47eb-a544-518235ad4e72	c5cbd90f-bffb-4bd8-8b47-382fab7ba6c2	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
39192c5b-7902-44c9-8eee-35b5c4e50de4	c43695c1-f2cb-4ba6-9605-cac2df9ad951	a3db1c22-cc2c-4e8c-8866-aaeb2da8d1f6	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
c1074122-88ec-49f5-8c3e-7e94aacd164c	5d095031-8bf8-476c-af1f-71091d99ac2d	66b0cbd2-8bc8-40a7-b2a1-7a66787960ba	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
8353cf2f-c764-4244-b8b3-e14f578aba5a	b2de9d5c-a0e1-4f81-a091-be0d8121d053	5f7cbd0d-ce6f-40ed-b609-3847077c6347	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
84c7480f-6fc5-4708-9212-964a33d95d90	edccd8cf-bb35-4a67-ba61-02eee28180d1	709004d1-08c9-4ff4-acac-6350d76e34f6	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
2c48ab05-39a1-43ec-9431-3a335224dee6	4f1a326d-1795-4171-b2e0-9fcdab024019	bb2a17ad-6a50-4216-9358-c21240443012	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
e9df3e17-66d5-4323-b4dc-f1f33213f97d	44242767-3ca6-4ef1-9832-2728c9eab642	4471ca90-ab94-47c1-8745-d42e646260e6	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
7a6c46a8-ad87-4f38-bd16-ba8495c4453d	fd673356-5585-4e43-adaa-22f613ca8b2d	135c8b64-e89e-439f-a288-4df57160192c	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
55a7574b-f0dd-469d-b0db-96b00d1d2b13	6049a7ae-5ec1-4283-b95d-f3ed285b8cfe	10650ba9-4b48-4c0d-91d8-86f56677a16a	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
fd54311d-a7ea-4126-87ad-6ca2ce96d0e5	f7fa6c77-17ed-4740-9d7d-b5ddd9073481	9df2bfcd-92a6-42d8-95cf-511f66208a93	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
8d8472c0-362e-436f-bcea-ed44e8fc9990	5ed689db-1128-4bf0-b8bd-e8a4aa949ba8	65a82b90-de69-4698-bbb7-af861678b545	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
ff2ef885-0c6e-4962-8741-e5ad49c87ef1	603bfe2d-1c91-4dae-bc12-c6cde052c00a	c5d5b139-c0f2-4367-b8ed-6ca65b470a3b	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
49a9bf8c-884b-4eac-a031-713571586cd4	b36e2242-b9e0-4521-9dcf-1cf89d58c895	5949bae0-eda5-4011-a649-63643e6107a9	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
d9065ab0-fc75-4136-8856-add80bb91235	d674c9da-920b-4913-808e-41147d9bc824	96749710-bb23-4ca4-824d-f398acb39db2	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
cc8601fb-7e75-49fd-b3ee-3396ed9a6e96	697ef321-7a27-49ee-b59f-fb24a86d39c0	7b840a79-1c49-4e0d-903c-f311c0cb266d	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
7d0318e9-2842-4e55-b1a0-d9a8af552d1b	4190d5dc-a353-44ac-87c1-4df4d1e4d207	322416a2-4472-4121-9cea-ca75b318e0ea	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
8a6487af-7208-495c-a72a-09d1576e5e98	4190d5dc-a353-44ac-87c1-4df4d1e4d207	bb604baa-440f-4c51-9b1e-05f78a47a14d	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
ddc4a3e7-013e-48c7-b05a-ffa080b01895	923adfc2-f701-46fa-98c4-3e81ca351df6	66427879-162c-45b7-8d11-ad0dc25be466	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 18:15:19.453-03	2025-11-05 18:15:19.453-03
8949f4f3-a101-4e0e-a9fa-6978dbfa512d	d999f872-226a-4f1d-a25b-eafe0ad5d5d2	9bda64ac-0647-438d-8cd7-272c3233f97e	02919da9-8a5e-40ae-b453-65379f25c663	2025-11-05	\N	t	2025-11-05 19:33:15.468-03	2025-11-05 19:33:15.468-03
3104e3c7-c531-40ea-b7ba-8405728c1f3e	2e8ca96f-9371-468a-910e-a65a35846656	61a68d90-48a8-488e-b17c-0226e16acd6c	79b66bb0-62f5-4cb3-9fc0-3a863f55612e	2025-11-05	\N	t	2025-11-05 19:34:09.671-03	2025-11-05 19:34:09.671-03
888cc2c3-5d2a-4549-8325-958b226d8715	916a9329-6877-4f02-8601-b1c86727141b	af667648-4b28-466b-8c2b-219199f95c28	79b66bb0-62f5-4cb3-9fc0-3a863f55612e	2025-11-06	\N	t	2025-11-06 12:51:01.411-03	2025-11-06 12:51:01.411-03
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proveedores (id, empresa, direccion, telefono, email, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: remito_detalles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remito_detalles (id, remito_id, inventario_id, es_prestamo, fecha_devolucion_esperada, devuelto, fecha_devolucion_real, observaciones, created_at, updated_at) FROM stdin;
4d838898-594d-4d61-80b0-7f69c9b3ce46	a7d21732-441c-4c85-983e-21ac5402afcd	ea9214a8-f597-46a7-8c94-05c9043686b7	f	\N	f	\N	\N	2025-11-05 19:35:39.085-03	2025-11-05 19:35:39.085-03
fd081d13-52ab-41c2-877b-1f477b83c666	2a1648c6-19b8-4ea8-aa04-bbdf0ec17402	c852fb9b-6add-44bd-9fd1-223cd5632812	f	\N	f	\N	\N	2025-11-05 20:06:43.6-03	2025-11-05 20:06:43.6-03
21ca0120-c2aa-4725-acd3-d103ff22788c	ddfa0585-258f-4168-b9fa-acb46b3a50df	4b1fb6ac-b4cc-4549-acda-d8dc84c74e88	f	\N	f	\N	\N	2025-11-05 20:10:32.904-03	2025-11-05 20:10:32.904-03
a6721050-9122-450b-a662-ae21a5698a8c	24202bcd-30e1-4b30-869b-464001b6d2de	22bf08ee-cfa8-4191-8914-2287ac0e33bf	t	2025-11-07 00:00:00-03	f	\N	\N	2025-11-05 22:25:11.41-03	2025-11-06 12:47:56.319-03
dca040c4-dd61-4e96-9434-90b9f4c8f64f	5c5af01e-612d-48c5-8476-c1f95c5b69c0	7213353e-8988-48d0-bfd7-77f8fe9472ce	t	2025-11-06 21:00:00-03	f	\N	\N	2025-11-06 12:52:29.868-03	2025-11-06 12:52:29.868-03
\.


--
-- Data for Name: remitos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remitos (id, numero_remito, fecha, sede_origen_id, sede_destino_id, solicitante_id, tecnico_asignado_id, estado, observaciones, fecha_entrega, fecha_confirmacion, created_at, updated_at) FROM stdin;
a7d21732-441c-4c85-983e-21ac5402afcd	REM-2025-001	2025-11-04 21:00:00-03	61a68d90-48a8-488e-b17c-0226e16acd6c	9bda64ac-0647-438d-8cd7-272c3233f97e	d999f872-226a-4f1d-a25b-eafe0ad5d5d2	2e8ca96f-9371-468a-910e-a65a35846656	completado	\N	\N	\N	2025-11-05 19:35:39.082-03	2025-11-05 19:50:15.396-03
2a1648c6-19b8-4ea8-aa04-bbdf0ec17402	REM-2025-002	2025-11-04 21:00:00-03	61a68d90-48a8-488e-b17c-0226e16acd6c	4b26716b-39b7-42e7-8eaa-de6c763f70ef	d999f872-226a-4f1d-a25b-eafe0ad5d5d2	2e8ca96f-9371-468a-910e-a65a35846656	completado	\N	\N	\N	2025-11-05 20:06:43.597-03	2025-11-05 20:07:15.429-03
ddfa0585-258f-4168-b9fa-acb46b3a50df	REM-2025-003	2025-11-04 21:00:00-03	61a68d90-48a8-488e-b17c-0226e16acd6c	3b7f5e82-dc19-4733-a652-171ca82a6695	d999f872-226a-4f1d-a25b-eafe0ad5d5d2	2e8ca96f-9371-468a-910e-a65a35846656	completado	\N	\N	\N	2025-11-05 20:10:32.901-03	2025-11-05 20:33:20.027-03
24202bcd-30e1-4b30-869b-464001b6d2de	REM-2025-004	2025-11-05 21:00:00-03	61a68d90-48a8-488e-b17c-0226e16acd6c	f83c60ae-9149-4f36-ba2f-b0f772edfd1a	d999f872-226a-4f1d-a25b-eafe0ad5d5d2	2e8ca96f-9371-468a-910e-a65a35846656	en_transito	\N	\N	\N	2025-11-05 22:25:11.405-03	2025-11-05 22:25:51.779-03
5c5af01e-612d-48c5-8476-c1f95c5b69c0	REM-2025-005	2025-11-05 21:00:00-03	61a68d90-48a8-488e-b17c-0226e16acd6c	dc85a3a6-00da-4d1b-848b-fe8e8b1e8867	916a9329-6877-4f02-8601-b1c86727141b	2e8ca96f-9371-468a-910e-a65a35846656	completado	\N	\N	\N	2025-11-06 12:52:29.865-03	2025-11-06 12:55:44.142-03
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, nombre, descripcion, nivel_jerarquia, activo, created_at, updated_at) FROM stdin;
5af80f22-59a3-405d-9da5-e003ab99f0e3	Gerente Generalista	Gerente generalista de sede	1	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
ba3a9851-2f5d-426a-b61c-e369c5d66189	Gerente Comercial	Gerente comercial de sede	2	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
826fafe7-23c2-4376-bc83-42051d85ace2	Gerente de Servicio	Gerente de servicio de sede	3	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
9a773a8c-c67e-4279-abec-3d4fd26f0050	Coordinador de Venta	Coordinador de venta de sede	4	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
ceff0152-e495-41a0-995d-2577146b074c	Coordinador de Servicio	Coordinador de servicio de sede	5	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
e7fbc3ac-fad5-4bb3-946e-96a35466d267	Coordinador de Pileta	Coordinador de pileta de sede	6	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
3733c63b-e3b9-4cdd-861e-28c300b0d539	Regional	Regional de sedes	7	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
02919da9-8a5e-40ae-b453-65379f25c663	Club Manager	Club manager de sede	8	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
3b570a19-4e6d-43f6-b8c8-f5cd2c6a3b67	Soporte Técnico	Personal de soporte técnico	9	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
79b66bb0-62f5-4cb3-9fc0-3a863f55612e	Sistemas	Personal de sistemas	10	t	2025-11-05 18:15:19.425-03	2025-11-05 18:15:19.425-03
\.


--
-- Data for Name: sede_asignaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sede_asignaciones (id, sede_id, personal_id, fecha_asignacion, fecha_fin_asignacion, activo, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sede_servicios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sede_servicios (id, sede_id, servicio_id, fecha_contratacion, fecha_vencimiento, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sedes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sedes (id, empresa_id, nombre_sede, direccion, localidad, provincia, pais, telefono, ip_sede, activo, created_at, updated_at) FROM stdin;
8c194579-8f8a-4c3f-812c-846a3628b342	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Alcorta	J. Salguero 3172	CABA	CABA	Argentina	4805-1312	192.168.128.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
84e52909-0115-4b9b-a10b-58892eaa2146	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Almagro	Humahuaca 3850	CABA	CABA	Argentina	4862-7925	192.168.103.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
e86acc8b-6d2e-41eb-9426-5037f22d2b9e	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Alto Palermo	Arenales 3370	CABA	CABA	Argentina	4821-6811	192.168.114.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
c1a7c17c-51d8-48c3-aa47-a4b9083e4410	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Ateneo	Riobamba 165	CABA	CABA	Argentina	4372-1106	192.168.111.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
606874f8-605b-40fe-8304-d00b74a8b131	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Barracas	Iriarte 2056	CABA	CABA	Argentina	4301-4327	192.168.130.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
6449cddd-5f7a-4e90-aa66-d9072f92088e	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Barrio Norte	Rodríguez Peña 1062	CABA	CABA	Argentina	11 6841-1909	192.168.106.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
bb467f81-fd80-48bc-93ed-d2db59b3ba08	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Belgrano	Vuelta de Obligado 2250	CABA	CABA	Argentina	4784-6635	192.168.112.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
f7b3560f-a420-4f12-afbc-d244bc5a7d4d	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Caballito	Yerbal 854	CABA	CABA	Argentina	4431-9201	192.168.130.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
66b598b2-afb7-4763-bcb1-f03776db8460	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Center	Reconquista 335	CABA	CABA	Argentina	4322-7690	192.168.109.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
c34e5222-0a6f-46ca-a5a3-efd9f9360ca7	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Devoto	Av. Fco. Beiró 5175	CABA	CABA	Argentina	4566-7231	192.168.105.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
f83c60ae-9149-4f36-ba2f-b0f772edfd1a	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Distrito Arcos	Godoy Cruz 2626	CABA	CABA	Argentina	2078-5400	192.168.133.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
7748fbbc-029a-420b-b32f-1779662b0ec9	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Distrito Tecnológico	Av. Caseros 3039	CABA	CABA	Argentina	2120-3100	192.168.141.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
9cee4d89-9444-45a9-a4e5-ec85a6ca4659	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Floresta	Av. Jonte 4180	CABA	CABA	Argentina	4639-8236	192.168.102.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
88bfcc8a-cb50-4745-ac16-f5df6650acc6	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	La Imprenta	Migueletes 1023	CABA	CABA	Argentina	4777-1573	192.168.104.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
9ac420d0-967a-4bb5-b5d4-a0cf5c72fdbb	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Núñez	Av. Libertador 8000	CABA	CABA	Argentina	4702-1193	192.168.123.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
8ad65e70-4cf0-4e7f-83e0-d286e2ca578e	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Puerto Madero	Alicia Moreau de Justo 1600	CABA	CABA	Argentina	4342-6818	192.168.129.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
0473510e-d1d2-44e5-8a22-87e92c63d66a	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Recoleta	Arenales 1930	CABA	CABA	Argentina	4811-2565	192.168.115.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
af667648-4b28-466b-8c2b-219199f95c28	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Villa Crespo	Juan B. Justo 2650	CABA	CABA	Argentina	4854-0595	192.168.108.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
26e0adf0-563f-4c82-acfb-5eb521be857a	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Gonnet	Camino Parque Centenario 4000	La Plata	Buenos Aires	Argentina	0221-484-6160	192.168.131.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
670ea839-db6b-401c-95ce-da05bcda0fcb	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Martínez I	Gral. Alvear 1136	Martínez	Buenos Aires	Argentina	6196-3308	192.168.120.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
76a3dfaf-e7ae-412f-b42b-0241f783c49f	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Martínez II	Arenales 1815	Martínez	Buenos Aires	Argentina	4733-3006	192.168.140.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
dc85a3a6-00da-4d1b-848b-fe8e8b1e8867	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Olivos	Av. Libertador 2421	Olivos	Buenos Aires	Argentina	2078-5300	192.168.135.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
cdcc13ac-2815-4192-81af-031b73746625	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Pilar	Panamericana Km 49,5	Pilar	Buenos Aires	Argentina	0230-438-4111	192.168.125.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
f051d038-971d-4ea7-8c34-3c4fd7637381	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Racing Club	Av. Mitre 934	Avellaneda	Buenos Aires	Argentina	6841-1906	192.168.113.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
4b26716b-39b7-42e7-8eaa-de6c763f70ef	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Barrio Jardín	Av. Elías Yofre 800	Córdoba	Córdoba	Argentina	0351-570-7474	192.168.137.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
3b7f5e82-dc19-4733-a652-171ca82a6695	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Centro	Av. Gral. Paz 195	Córdoba	Córdoba	Argentina	0351-570-7484	192.168.138.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
86cea700-fe75-40d8-a0ba-278da87b022a	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Cerro	José Otero 1430	Córdoba	Córdoba	Argentina	0351-570-7464	192.168.139.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
af8fa991-b4e2-4202-8b4c-1f1dc3b382ad	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Alto Rosario	Junín 501 (Shopping Alto Rosario)	Rosario	Santa Fe	Argentina	0341-528-3190	192.168.136.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
fcf5ae2f-d93f-4fa4-9fc8-c516390808f2	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Rosario	Tucumán 1239	Rosario	Santa Fe	Argentina	0341-528-2703	192.168.124.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
bc4d108f-9b2b-40ea-86aa-666520d3e328	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Añelo	Complejo Hally	Añelo	Neuquén	Argentina	11 5618 2921	192.168.143.0	t	2025-11-05 18:15:19.43-03	2025-11-05 18:15:19.43-03
9bda64ac-0647-438d-8cd7-272c3233f97e	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Abasto	Av. Corrientes 3234	CABA	Buenos Aires	Argentina	011 2120-1400	10.203.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
a82e056a-0c39-4bc6-93d1-42d31e73184a	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Adrogué	Seguí 675	Adrogué	Buenos Aires	Argentina	011 2120-1400	10.210.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
c5cbd90f-bffb-4bd8-8b47-382fab7ba6c2	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Almagro	Castro Barros 148	CABA	Buenos Aires	Argentina	011 2120-1400	10.205.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
3f2961a5-71e1-40dc-bfda-63538d965e54	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Almagro 2	Av. Medrano 976	CABA	Buenos Aires	Argentina	011 2120-1400	\N	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
a3db1c22-cc2c-4e8c-8866-aaeb2da8d1f6	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Barrio Norte	Mansilla 2929	CABA	Buenos Aires	Argentina	011 2120-1400	10.202.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
66b0cbd2-8bc8-40a7-b2a1-7a66787960ba	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Caballito	Rosario 744	CABA	Buenos Aires	Argentina	011 2120-1400	10.204.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
5f7cbd0d-ce6f-40ed-b609-3847077c6347	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Caballito 2	Av. Acoyte 54	CABA	Buenos Aires	Argentina	011 2120-1400	10.219.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
709004d1-08c9-4ff4-acac-6350d76e34f6	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Caballito 3	Av. Rivadavia 4475	CABA	Buenos Aires	Argentina	011 2120-1400	10.215.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
4471ca90-ab94-47c1-8745-d42e646260e6	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Cid Campeador	Franklin 710	CABA	Buenos Aires	Argentina	011 4982-4666	10.213.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
135c8b64-e89e-439f-a288-4df57160192c	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Congreso	Pasco 48	CABA	Buenos Aires	Argentina	011 2120-1400	10.212.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
10650ba9-4b48-4c0d-91d8-86f56677a16a	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Flores	Lautaro 71	CABA	Buenos Aires	Argentina	011 2120-1400	10.206.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
9df2bfcd-92a6-42d8-95cf-511f66208a93	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Hollywood	Humboldt 1575	CABA	Buenos Aires	Argentina	011 2120-1400	10.208.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
65a82b90-de69-4698-bbb7-af861678b545	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Lomas	Av. Meeks 250	Lomas de Zamora	Buenos Aires	Argentina	011 2120-1400	10.220.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
c5d5b139-c0f2-4367-b8ed-6ca65b470a3b	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Microcentro	Lavalle 828	CABA	Buenos Aires	Argentina	011 2120-1400	10.207.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
5949bae0-eda5-4011-a649-63643e6107a9	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Núñez	Miguel B. Sánchez 1013	CABA	Buenos Aires	Argentina	011 2120-1400	10.209.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
96749710-bb23-4ca4-824d-f398acb39db2	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Palermo	Humboldt 2439	CABA	Buenos Aires	Argentina	011 2120-1400	10.216.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
bb604baa-440f-4c51-9b1e-05f78a47a14d	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Punta Carretas	21 de Setiembre 2724	Montevideo	Montevideo	Uruguay	+598 95 080 875	10.102.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
322416a2-4472-4121-9cea-ca75b318e0ea	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Buceo	Rivera 3434	Montevideo	Montevideo	Uruguay	+598 94 563 314	10.103.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
66427879-162c-45b7-8d11-ad0dc25be466	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Maldonado	Cecilia Burgueño (entre Sarandí y 18 de Julio)	Maldonado	Maldonado	Uruguay	+598 95 447 516	10.104.0.0	t	2025-11-05 18:15:19.431-03	2025-11-05 18:15:19.431-03
7b840a79-1c49-4e0d-903c-f311c0cb266d	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Quilmes	Videla 265	Quilmes	Buenos Aires	Argentina	011 2120-1400	\N	t	2025-11-05 18:15:19.437-03	2025-11-05 18:15:19.437-03
bb2a17ad-6a50-4216-9358-c21240443012	e03efffb-9a10-4a4c-9c67-90dd19a59ad1	Fiter Center	Florida 770	CABA	Buenos Aires	Argentina	011 2120-1400	\N	t	2025-11-05 18:15:19.437-03	2025-11-05 18:15:19.437-03
61a68d90-48a8-488e-b17c-0226e16acd6c	aa7d4349-5b3f-4d8c-85df-ec59a9be0f0a	Depósito	Juan DIaz de SOlis 1851	Vicente Lopez	Buenos AIres	Argentina	4862-7925	192.168.101.1	t	2025-11-05 19:30:01.635-03	2025-11-05 19:30:01.635-03
\.


--
-- Data for Name: servicios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servicios (id, nombre, tipo_servicio_id, proveedor_id, descripcion, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: soporte_niveles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.soporte_niveles (id, servicio_id, nivel, email, telefono, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tipos_articulo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tipos_articulo (id, nombre, descripcion, activo, created_at, updated_at) FROM stdin;
1dd2c6be-74ca-4a13-b807-95aa47c60fd8	Notebooks	Computadoras portátiles	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
932a902c-8d47-4b6e-bb10-4458978ea052	PC	Computadoras de escritorio	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
ab8f6318-39cd-4379-aeae-52e6acd9d72a	Periféricos	Periféricos de computadora (teclados, mouses, webcams, etc.)	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
0231c92c-219c-4116-bc06-4b2117f9db03	Monitor	Monitores y pantallas	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
e316b14b-9adc-44a7-9c20-8adbaea8ad03	Cámara	Cámaras de video y fotografía	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
dfc55cb9-0733-4495-bb7c-6f36783b8b78	Impresora	Impresoras y multifuncionales	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
d9634000-ab29-4763-bd9d-441a36c8dff1	NVR	Network Video Recorder - Sistemas de grabación de video en red	t	2025-11-05 19:28:14.909-03	2025-11-05 19:28:14.909-03
\.


--
-- Data for Name: tipos_servicio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tipos_servicio (id, nombre, descripcion, activo, created_at, updated_at) FROM stdin;
\.


--
-- Name: remito_numero_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.remito_numero_seq', 5, true);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: ejecutivos_cuentas ejecutivos_cuentas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ejecutivos_cuentas
    ADD CONSTRAINT ejecutivos_cuentas_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_cuit_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_cuit_key UNIQUE (cuit);


--
-- Name: empresas empresas_nombre_empresa_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_nombre_empresa_key UNIQUE (nombre_empresa);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: historial_movimientos historial_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_movimientos
    ADD CONSTRAINT historial_movimientos_pkey PRIMARY KEY (id);


--
-- Name: inventario inventario_numero_serie_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_numero_serie_key UNIQUE (numero_serie);


--
-- Name: inventario inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_pkey PRIMARY KEY (id);


--
-- Name: personal personal_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_email_key UNIQUE (email);


--
-- Name: personal personal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_pkey PRIMARY KEY (id);


--
-- Name: personal_sedes personal_sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_sedes
    ADD CONSTRAINT personal_sedes_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: remito_detalles remito_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remito_detalles
    ADD CONSTRAINT remito_detalles_pkey PRIMARY KEY (id);


--
-- Name: remitos remitos_numero_remito_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remitos
    ADD CONSTRAINT remitos_numero_remito_key UNIQUE (numero_remito);


--
-- Name: remitos remitos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remitos
    ADD CONSTRAINT remitos_pkey PRIMARY KEY (id);


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sede_asignaciones sede_asignaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sede_asignaciones
    ADD CONSTRAINT sede_asignaciones_pkey PRIMARY KEY (id);


--
-- Name: sede_servicios sede_servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sede_servicios
    ADD CONSTRAINT sede_servicios_pkey PRIMARY KEY (id);


--
-- Name: sedes sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey PRIMARY KEY (id);


--
-- Name: servicios servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);


--
-- Name: soporte_niveles soporte_niveles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.soporte_niveles
    ADD CONSTRAINT soporte_niveles_pkey PRIMARY KEY (id);


--
-- Name: tipos_articulo tipos_articulo_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipos_articulo
    ADD CONSTRAINT tipos_articulo_nombre_key UNIQUE (nombre);


--
-- Name: tipos_articulo tipos_articulo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipos_articulo
    ADD CONSTRAINT tipos_articulo_pkey PRIMARY KEY (id);


--
-- Name: tipos_servicio tipos_servicio_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipos_servicio
    ADD CONSTRAINT tipos_servicio_nombre_key UNIQUE (nombre);


--
-- Name: tipos_servicio tipos_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipos_servicio
    ADD CONSTRAINT tipos_servicio_pkey PRIMARY KEY (id);


--
-- Name: idx_ejecutivos_proveedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ejecutivos_proveedor ON public.ejecutivos_cuentas USING btree (proveedor_id);


--
-- Name: idx_empresas_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_empresas_activo ON public.empresas USING btree (activo);


--
-- Name: idx_empresas_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_empresas_nombre ON public.empresas USING btree (nombre_empresa);


--
-- Name: idx_historial_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_fecha ON public.historial_movimientos USING btree (fecha_movimiento);


--
-- Name: idx_historial_inventario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_inventario ON public.historial_movimientos USING btree (inventario_id);


--
-- Name: idx_historial_sede_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_sede_destino ON public.historial_movimientos USING btree (sede_destino_id);


--
-- Name: idx_historial_sede_origen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_sede_origen ON public.historial_movimientos USING btree (sede_origen_id);


--
-- Name: idx_historial_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_tipo ON public.historial_movimientos USING btree (tipo_movimiento);


--
-- Name: idx_inventario_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventario_activo ON public.inventario USING btree (activo);


--
-- Name: idx_inventario_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventario_estado ON public.inventario USING btree (estado);


--
-- Name: idx_inventario_marca_modelo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventario_marca_modelo ON public.inventario USING btree (marca, modelo);


--
-- Name: idx_inventario_numero_serie; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_inventario_numero_serie ON public.inventario USING btree (numero_serie) WHERE (numero_serie IS NOT NULL);


--
-- Name: idx_inventario_sede; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventario_sede ON public.inventario USING btree (sede_id);


--
-- Name: idx_inventario_tipo_articulo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventario_tipo_articulo ON public.inventario USING btree (tipo_articulo_id);


--
-- Name: idx_personal_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personal_activo ON public.personal USING btree (activo);


--
-- Name: idx_personal_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_personal_email ON public.personal USING btree (email);


--
-- Name: idx_personal_nombre_completo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personal_nombre_completo ON public.personal USING btree (apellido, nombre);


--
-- Name: idx_personal_rol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personal_rol ON public.personal USING btree (rol_id);


--
-- Name: idx_personal_sede; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personal_sede ON public.personal USING btree (sede_id);


--
-- Name: idx_proveedores_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_activo ON public.proveedores USING btree (activo);


--
-- Name: idx_proveedores_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_empresa ON public.proveedores USING btree (empresa);


--
-- Name: idx_remito_detalles_devuelto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remito_detalles_devuelto ON public.remito_detalles USING btree (devuelto);


--
-- Name: idx_remito_detalles_fecha_devolucion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remito_detalles_fecha_devolucion ON public.remito_detalles USING btree (fecha_devolucion_esperada);


--
-- Name: idx_remito_detalles_prestamo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remito_detalles_prestamo ON public.remito_detalles USING btree (es_prestamo);


--
-- Name: idx_remito_detalles_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_remito_detalles_unique ON public.remito_detalles USING btree (remito_id, inventario_id);


--
-- Name: idx_remitos_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remitos_estado ON public.remitos USING btree (estado);


--
-- Name: idx_remitos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remitos_fecha ON public.remitos USING btree (fecha);


--
-- Name: idx_remitos_numero; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_remitos_numero ON public.remitos USING btree (numero_remito);


--
-- Name: idx_remitos_sede_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remitos_sede_destino ON public.remitos USING btree (sede_destino_id);


--
-- Name: idx_remitos_sede_origen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remitos_sede_origen ON public.remitos USING btree (sede_origen_id);


--
-- Name: idx_remitos_solicitante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remitos_solicitante ON public.remitos USING btree (solicitante_id);


--
-- Name: idx_remitos_tecnico; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remitos_tecnico ON public.remitos USING btree (tecnico_asignado_id);


--
-- Name: idx_roles_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roles_activo ON public.roles USING btree (activo);


--
-- Name: idx_roles_nivel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roles_nivel ON public.roles USING btree (nivel_jerarquia);


--
-- Name: idx_roles_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_roles_nombre ON public.roles USING btree (nombre);


--
-- Name: idx_sede_asignacion_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sede_asignacion_activo ON public.sede_asignaciones USING btree (activo);


--
-- Name: idx_sede_asignacion_personal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sede_asignacion_personal_id ON public.sede_asignaciones USING btree (personal_id);


--
-- Name: idx_sede_asignacion_sede_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sede_asignacion_sede_id ON public.sede_asignaciones USING btree (sede_id);


--
-- Name: idx_sede_personal_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_sede_personal_active_unique ON public.sede_asignaciones USING btree (sede_id, personal_id) WHERE (activo = true);


--
-- Name: idx_sede_servicios_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_sede_servicios_unique ON public.sede_servicios USING btree (sede_id, servicio_id);


--
-- Name: idx_sedes_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sedes_activo ON public.sedes USING btree (activo);


--
-- Name: idx_sedes_empresa_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sedes_empresa_id ON public.sedes USING btree (empresa_id);


--
-- Name: idx_sedes_empresa_sede; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_sedes_empresa_sede ON public.sedes USING btree (empresa_id, nombre_sede);


--
-- Name: idx_servicios_proveedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_servicios_proveedor ON public.servicios USING btree (proveedor_id);


--
-- Name: idx_servicios_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_servicios_tipo ON public.servicios USING btree (tipo_servicio_id);


--
-- Name: idx_soporte_servicio_nivel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_soporte_servicio_nivel ON public.soporte_niveles USING btree (servicio_id, nivel);


--
-- Name: idx_tipos_articulo_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tipos_articulo_activo ON public.tipos_articulo USING btree (activo);


--
-- Name: idx_tipos_articulo_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_tipos_articulo_nombre ON public.tipos_articulo USING btree (nombre);


--
-- Name: idx_tipos_servicio_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_tipos_servicio_nombre ON public.tipos_servicio USING btree (nombre);


--
-- Name: personal_sedes_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX personal_sedes_activo ON public.personal_sedes USING btree (activo);


--
-- Name: personal_sedes_personal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX personal_sedes_personal_id ON public.personal_sedes USING btree (personal_id);


--
-- Name: personal_sedes_rol_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX personal_sedes_rol_id ON public.personal_sedes USING btree (rol_id);


--
-- Name: personal_sedes_sede_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX personal_sedes_sede_id ON public.personal_sedes USING btree (sede_id);


--
-- Name: unique_personal_sede_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_personal_sede_activo ON public.personal_sedes USING btree (personal_id, sede_id) WHERE (activo = true);


--
-- Name: ejecutivos_cuentas ejecutivos_cuentas_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ejecutivos_cuentas
    ADD CONSTRAINT ejecutivos_cuentas_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: historial_movimientos historial_movimientos_inventario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_movimientos
    ADD CONSTRAINT historial_movimientos_inventario_id_fkey FOREIGN KEY (inventario_id) REFERENCES public.inventario(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: historial_movimientos historial_movimientos_remito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_movimientos
    ADD CONSTRAINT historial_movimientos_remito_id_fkey FOREIGN KEY (remito_id) REFERENCES public.remitos(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: historial_movimientos historial_movimientos_sede_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_movimientos
    ADD CONSTRAINT historial_movimientos_sede_destino_id_fkey FOREIGN KEY (sede_destino_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: historial_movimientos historial_movimientos_sede_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_movimientos
    ADD CONSTRAINT historial_movimientos_sede_origen_id_fkey FOREIGN KEY (sede_origen_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: historial_movimientos historial_movimientos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_movimientos
    ADD CONSTRAINT historial_movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.personal(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventario inventario_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventario inventario_tipo_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_tipo_articulo_id_fkey FOREIGN KEY (tipo_articulo_id) REFERENCES public.tipos_articulo(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: personal personal_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: personal personal_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: personal_sedes personal_sedes_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_sedes
    ADD CONSTRAINT personal_sedes_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: personal_sedes personal_sedes_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_sedes
    ADD CONSTRAINT personal_sedes_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: personal_sedes personal_sedes_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_sedes
    ADD CONSTRAINT personal_sedes_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: remito_detalles remito_detalles_inventario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remito_detalles
    ADD CONSTRAINT remito_detalles_inventario_id_fkey FOREIGN KEY (inventario_id) REFERENCES public.inventario(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remito_detalles remito_detalles_remito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remito_detalles
    ADD CONSTRAINT remito_detalles_remito_id_fkey FOREIGN KEY (remito_id) REFERENCES public.remitos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: remitos remitos_sede_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remitos
    ADD CONSTRAINT remitos_sede_destino_id_fkey FOREIGN KEY (sede_destino_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remitos remitos_sede_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remitos
    ADD CONSTRAINT remitos_sede_origen_id_fkey FOREIGN KEY (sede_origen_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remitos remitos_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remitos
    ADD CONSTRAINT remitos_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.personal(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remitos remitos_tecnico_asignado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remitos
    ADD CONSTRAINT remitos_tecnico_asignado_id_fkey FOREIGN KEY (tecnico_asignado_id) REFERENCES public.personal(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sede_asignaciones sede_asignaciones_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sede_asignaciones
    ADD CONSTRAINT sede_asignaciones_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sede_asignaciones sede_asignaciones_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sede_asignaciones
    ADD CONSTRAINT sede_asignaciones_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sede_servicios sede_servicios_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sede_servicios
    ADD CONSTRAINT sede_servicios_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sede_servicios sede_servicios_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sede_servicios
    ADD CONSTRAINT sede_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sedes sedes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: servicios servicios_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: servicios servicios_tipo_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_tipo_servicio_id_fkey FOREIGN KEY (tipo_servicio_id) REFERENCES public.tipos_servicio(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: soporte_niveles soporte_niveles_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.soporte_niveles
    ADD CONSTRAINT soporte_niveles_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TABLE "SequelizeMeta"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."SequelizeMeta" TO mgft_infra_app;


--
-- Name: TABLE ejecutivos_cuentas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ejecutivos_cuentas TO mgft_infra_app;


--
-- Name: TABLE empresas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empresas TO mgft_infra_app;


--
-- Name: TABLE historial_movimientos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.historial_movimientos TO mgft_infra_app;


--
-- Name: TABLE inventario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventario TO mgft_infra_app;


--
-- Name: TABLE personal; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.personal TO mgft_infra_app;


--
-- Name: TABLE personal_sedes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.personal_sedes TO mgft_infra_app;


--
-- Name: TABLE proveedores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.proveedores TO mgft_infra_app;


--
-- Name: TABLE remito_detalles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.remito_detalles TO mgft_infra_app;


--
-- Name: SEQUENCE remito_numero_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.remito_numero_seq TO mgft_infra_app;


--
-- Name: TABLE remitos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.remitos TO mgft_infra_app;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO mgft_infra_app;


--
-- Name: TABLE sede_asignaciones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sede_asignaciones TO mgft_infra_app;


--
-- Name: TABLE sede_servicios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sede_servicios TO mgft_infra_app;


--
-- Name: TABLE sedes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sedes TO mgft_infra_app;


--
-- Name: TABLE servicios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.servicios TO mgft_infra_app;


--
-- Name: TABLE soporte_niveles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.soporte_niveles TO mgft_infra_app;


--
-- Name: TABLE tipos_articulo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tipos_articulo TO mgft_infra_app;


--
-- Name: TABLE tipos_servicio; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tipos_servicio TO mgft_infra_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO mgft_infra_app;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO mgft_infra_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO mgft_infra_app;


--
-- PostgreSQL database dump complete
--

\unrestrict IlpUUee7nST1j60elGkvNmoloSllElw6TtNzln9ekQeOz4V1zl7QOQPCj0bhoZ7

