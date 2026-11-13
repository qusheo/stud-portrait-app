-- PostgreSQL: read-only examples after restoring elibrary_sample.dump
SET search_path TO elibrary_sample, pg_catalog;
-- Original Ibrahim fields, matched by original teacher ID.
SELECT t.id,t.name,s.payload FROM teacher_directory t
JOIN teacher_source_rows s ON s.teacher_id=t.id LIMIT 10;
-- Strong automatic evidence; this is not a manual identity confirmation.
SELECT * FROM supported_teacher_publications LIMIT 20;
-- Card text, year/date and original subject classifications.
SELECT elibrary_id,payload->>'title' AS title,payload->>'publication_year' AS year,
payload->>'publication_date' AS exact_date,payload->>'abstract' AS abstract,
payload->'keywords' AS keywords,payload->'topics' AS topics FROM card_metadata LIMIT 10;
-- Three separate kinds of vectors and the corresponding dictionaries.
SELECT v.elibrary_id,'title' AS field,v.model_id,v.indices,v.weights,m.config->'vocabulary' AS vocabulary
FROM publication_title_vectors v JOIN title_vector_models m USING(model_id) LIMIT 1;
SELECT v.elibrary_id,v.field,v.model_id,v.indices,v.weights,m.config->'vocabulary' AS vocabulary
FROM publication_detail_vectors v JOIN detail_vector_models m USING(model_id) LIMIT 2;
