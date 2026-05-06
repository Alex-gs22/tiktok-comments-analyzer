## Table `corpus`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `id_comment` | `varchar` |  Unique |
| `video_id` | `varchar` |  |
| `texto_raw` | `text` |  |
| `texto_limpio` | `text` |  Nullable |
| `id_emocion` | `int4` |  Nullable |
| `intensidad` | `int2` |  Nullable |
| `id_tema` | `int4` |  |
| `likes` | `int4` |  Nullable |
| `fecha` | `timestamp` |  Nullable |

## Table `corpus_training`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `id_comment` | `varchar` |  Unique |
| `video_id` | `varchar` |  |
| `texto_raw` | `text` |  |
| `texto_limpio` | `text` |  Nullable |
| `id_emocion` | `int4` |  Nullable |
| `intensidad` | `int2` |  Nullable |
| `id_tema` | `int4` |  |
| `likes` | `int4` |  Nullable |
| `fecha` | `timestamp` |  Nullable |

## Table `corpus_v2`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `id_comment` | `varchar` |  Unique |
| `video_id` | `varchar` |  |
| `texto_raw` | `text` |  |
| `texto_limpio` | `text` |  Nullable |
| `id_emocion` | `int4` |  Nullable |
| `intensidad` | `int2` |  Nullable |
| `id_tema` | `int4` |  |
| `likes` | `int4` |  Nullable |
| `fecha` | `timestamp` |  Nullable |

## Table `dataset_emociones_v1`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `corpus_id` | `int4` |  Nullable |
| `id_comment` | `varchar` |  Nullable |
| `video_id` | `varchar` |  Nullable |
| `texto_raw` | `text` |  Nullable |
| `texto_limpio` | `text` |  Nullable |
| `texto_modelo` | `text` |  Nullable |
| `id_emocion` | `int4` |  Nullable |
| `emocion_nombre` | `varchar` |  Nullable |
| `intensidad_min` | `varchar` |  Nullable |
| `intensidad_max` | `varchar` |  Nullable |
| `intensidad` | `int2` |  Nullable |
| `intensidad_nombre` | `varchar` |  Nullable |
| `id_tema` | `int4` |  Nullable |
| `tema_nombre` | `varchar` |  Nullable |
| `tema_descripcion` | `text` |  Nullable |
| `categoria` | `varchar` |  Nullable |
| `emociones_esperadas` | `jsonb` |  Nullable |
| `likes` | `int4` |  Nullable |
| `fecha` | `timestamp` |  Nullable |
| `frozen_at` | `timestamptz` |  Nullable |

## Table `dataset_emociones_v2`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `corpus_id` | `int4` |  Nullable |
| `id_comment` | `varchar` |  Nullable |
| `video_id` | `varchar` |  Nullable |
| `texto_raw` | `text` |  Nullable |
| `texto_limpio` | `text` |  Nullable |
| `texto_modelo` | `text` |  Nullable |
| `id_emocion` | `int4` |  Nullable |
| `emocion_nombre` | `varchar` |  Nullable |
| `intensidad_min` | `varchar` |  Nullable |
| `intensidad_max` | `varchar` |  Nullable |
| `intensidad` | `int2` |  Nullable |
| `intensidad_nombre` | `varchar` |  Nullable |
| `id_tema` | `int4` |  Nullable |
| `tema_nombre` | `varchar` |  Nullable |
| `tema_descripcion` | `text` |  Nullable |
| `categoria` | `varchar` |  Nullable |
| `emociones_esperadas` | `jsonb` |  Nullable |
| `likes` | `int4` |  Nullable |
| `fecha` | `timestamp` |  Nullable |
| `frozen_at` | `timestamptz` |  Nullable |

## Table `emociones`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `nombre` | `varchar` |  Unique |
| `descripcion` | `text` |  Nullable |
| `intensidad_min` | `varchar` |  |
| `intensidad_max` | `varchar` |  |

## Table `emociones_fusionadas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int2` | Primary |
| `nombre` | `text` |  |

## Table `predicciones`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `id_video` | `int8` |  Nullable |
| `texto_original` | `text` |  |
| `texto_limpio` | `text` |  Nullable |
| `emocion_predicha` | `varchar` |  |
| `confianza_maxima` | `numeric` |  |
| `es_incierto` | `bool` |  Nullable |
| `score_alegria` | `numeric` |  |
| `score_confianza` | `numeric` |  |
| `score_miedo` | `numeric` |  |
| `score_expectacion` | `numeric` |  |
| `score_tristeza` | `numeric` |  |
| `score_rechazo` | `numeric` |  |
| `likes` | `int4` |  Nullable |
| `fecha_comentario` | `timestamptz` |  Nullable |
| `id_comment_tiktok` | `varchar` |  Nullable |
| `tipo_analisis` | `varchar` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `pseudo_labels_review`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `corpus_id` | `int4` |  Nullable |
| `id_comment` | `int8` |  Nullable |
| `texto_raw` | `text` |  |
| `texto_limpio` | `text` |  Nullable |
| `pred_emocion_id` | `int2` |  |
| `pred_emocion_nombre` | `text` |  |
| `pred_confianza` | `float4` |  |
| `entropia` | `float4` |  Nullable |
| `margen_top2` | `float4` |  Nullable |
| `prob_alegria` | `float4` |  Nullable |
| `prob_confianza` | `float4` |  Nullable |
| `prob_miedo` | `float4` |  Nullable |
| `prob_expectacion` | `float4` |  Nullable |
| `prob_tristeza` | `float4` |  Nullable |
| `prob_rechazo` | `float4` |  Nullable |
| `tema_nombre` | `text` |  Nullable |
| `categoria` | `text` |  Nullable |
| `revision_emocion_id` | `int2` |  Nullable |
| `revision_emocion_nombre` | `text` |  Nullable |
| `revision_estado` | `text` |  Nullable |
| `revisado_en` | `timestamptz` |  Nullable |
| `locked_by` | `uuid` |  Nullable |
| `locked_at` | `timestamptz` |  Nullable |

## Table `sesiones_analisis`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `id_video` | `int8` |  Nullable |
| `tipo` | `varchar` |  |
| `total_procesados` | `int4` |  Nullable |
| `total_inciertos` | `int4` |  Nullable |
| `emocion_dominante` | `varchar` |  Nullable |
| `confianza_promedio` | `numeric` |  Nullable |
| `duracion_ms` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `temas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `nombre` | `varchar` |  |
| `descripcion` | `text` |  Nullable |
| `categoria` | `varchar` |  Nullable |
| `emociones_esperadas` | `jsonb` |  Nullable |

## Table `temas_produccion`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `nombre` | `varchar` |  |
| `descripcion` | `text` |  Nullable |
| `categoria` | `varchar` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `temas_training`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `nombre` | `varchar` |  |
| `descripcion` | `text` |  Nullable |
| `categoria` | `varchar` |  Nullable |
| `emociones_esperadas` | `jsonb` |  Nullable |

## Table `temas_v2`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary Identity |
| `nombre` | `varchar` |  |
| `descripcion` | `text` |  Nullable |
| `categoria` | `varchar` |  Nullable |
| `emociones_esperadas` | `jsonb` |  Nullable |

## Table `videos_analizados`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `url` | `text` |  |
| `video_id_tiktok` | `varchar` |  Nullable Unique |
| `titulo` | `text` |  Nullable |
| `id_tema` | `int8` |  Nullable |
| `tema_auto_generado` | `bool` |  Nullable |
| `total_comentarios` | `int4` |  Nullable |
| `total_analizados` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

