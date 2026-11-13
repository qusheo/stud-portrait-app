-- Standalone partial dataset. Apply to an empty database using psql.
-- A separate schema preserves original IDs without modifying application tables.
CREATE SCHEMA elibrary_sample;
SET LOCAL search_path = elibrary_sample, pg_catalog;
CREATE TABLE dataset_metadata (key text PRIMARY KEY,value jsonb NOT NULL);
CREATE TABLE teacher_directory (id bigint PRIMARY KEY,name text NOT NULL,institution text,source_row integer);
CREATE TABLE teacher_source_rows (teacher_id bigint PRIMARY KEY REFERENCES teacher_directory,payload jsonb NOT NULL);
CREATE TABLE publications (elibrary_id bigint PRIMARY KEY,title text NOT NULL,publication_year integer,
    source_url text NOT NULL,authors_truncated integer NOT NULL CHECK (authors_truncated IN (0,1)),
    authors_missing integer NOT NULL CHECK (authors_missing IN (0,1)),bibliography text NOT NULL,metadata_source text NOT NULL);
CREATE TABLE publication_authors (elibrary_id bigint NOT NULL REFERENCES publications,
    author_order integer NOT NULL,name text NOT NULL,PRIMARY KEY(elibrary_id,author_order));
CREATE TABLE teacher_matches (elibrary_id bigint NOT NULL,author_order integer NOT NULL,
    teacher_id bigint NOT NULL REFERENCES teacher_directory,method text NOT NULL,status text NOT NULL,
    PRIMARY KEY(elibrary_id,author_order,teacher_id),
    FOREIGN KEY(elibrary_id,author_order) REFERENCES publication_authors(elibrary_id,author_order));
CREATE TABLE card_metadata (elibrary_id bigint PRIMARY KEY REFERENCES publications,payload jsonb NOT NULL,source_file text NOT NULL);
CREATE TABLE card_authors (elibrary_id bigint NOT NULL REFERENCES card_metadata,
    author_order integer NOT NULL,name text NOT NULL,full_name text,elibrary_author_id bigint,
    affiliations jsonb NOT NULL,PRIMARY KEY(elibrary_id,author_order));
CREATE TABLE match_evidence (elibrary_id bigint NOT NULL,card_author_order integer NOT NULL,
    teacher_id bigint NOT NULL REFERENCES teacher_directory,verdict text NOT NULL,was_listing_candidate integer NOT NULL,
    PRIMARY KEY(elibrary_id,card_author_order,teacher_id),
    FOREIGN KEY(elibrary_id,card_author_order) REFERENCES card_authors(elibrary_id,author_order));
CREATE TABLE title_vector_models (model_id text PRIMARY KEY,kind text NOT NULL,config jsonb NOT NULL);
CREATE TABLE publication_title_vectors (elibrary_id bigint PRIMARY KEY REFERENCES publications,
    model_id text NOT NULL REFERENCES title_vector_models,input_hash text NOT NULL,
    dimensions integer NOT NULL,indices jsonb NOT NULL,weights jsonb NOT NULL,
    CHECK (jsonb_array_length(indices)=jsonb_array_length(weights)));
CREATE INDEX sample_matches_teacher ON teacher_matches(teacher_id);
CREATE TABLE detail_vector_models (model_id text PRIMARY KEY,field text NOT NULL UNIQUE,config jsonb NOT NULL);
CREATE TABLE publication_detail_vectors (elibrary_id bigint NOT NULL REFERENCES card_metadata,
    field text NOT NULL,model_id text NOT NULL REFERENCES detail_vector_models,input_hash text NOT NULL,
    dimensions integer NOT NULL,indices jsonb NOT NULL,weights jsonb NOT NULL,
    PRIMARY KEY(elibrary_id,field),CHECK (jsonb_array_length(indices)=jsonb_array_length(weights)));
CREATE INDEX sample_publications_year ON publications(publication_year);
CREATE VIEW candidate_teacher_publications AS
    SELECT DISTINCT t.id AS teacher_id,t.name AS teacher_name,p.elibrary_id,p.title,p.publication_year,m.status
    FROM teacher_matches m JOIN teacher_directory t ON t.id=m.teacher_id JOIN publications p USING(elibrary_id);
CREATE VIEW supported_teacher_publications AS
    SELECT DISTINCT e.teacher_id,t.name AS teacher_name,e.elibrary_id,p.title,p.publication_year
    FROM match_evidence e JOIN teacher_directory t ON t.id=e.teacher_id JOIN publications p USING(elibrary_id)
    WHERE e.verdict='full_name_affiliation_supported';
