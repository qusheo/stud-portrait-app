-- Apply to a database containing teacher from the supplied dump.
-- Additive migration: existing project tables are never dropped.
BEGIN;
CREATE TABLE IF NOT EXISTS elibrary_publications (
    elibrary_id bigint PRIMARY KEY,
    source_url text NOT NULL,
    title text NOT NULL CHECK (length(title) > 0),
    abstract text,
    keywords jsonb NOT NULL DEFAULT '[]',
    publication_type text,
    publication_year integer CHECK (publication_year BETWEEN 1500 AND 2200),
    publication_date date,
    doi text,
    edn text,
    topics jsonb NOT NULL DEFAULT '{}',
    content_hash text NOT NULL,
    raw_data jsonb NOT NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS elibrary_collection_items (
    collection_id bigint NOT NULL,
    elibrary_id bigint NOT NULL REFERENCES elibrary_publications(elibrary_id),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, elibrary_id)
);
CREATE TABLE IF NOT EXISTS elibrary_authors (
    elibrary_id bigint NOT NULL REFERENCES elibrary_publications(elibrary_id) ON DELETE CASCADE,
    author_order integer NOT NULL CHECK (author_order > 0),
    name text NOT NULL,
    elibrary_author_id bigint,
    affiliations jsonb NOT NULL DEFAULT '[]',
    PRIMARY KEY (elibrary_id, author_order)
);
-- Initials alone produce candidates, never a confirmed teacher association.
CREATE TABLE IF NOT EXISTS elibrary_teacher_matches (
    elibrary_id bigint NOT NULL,
    author_order integer NOT NULL,
    teacher_id bigint NOT NULL REFERENCES teacher(id),
    method text NOT NULL CHECK (method IN ('full_name', 'initials', 'manual')),
    status text NOT NULL CHECK (status IN ('candidate', 'confirmed', 'rejected')),
    reviewed_at timestamptz,
    PRIMARY KEY (elibrary_id, author_order, teacher_id),
    FOREIGN KEY (elibrary_id, author_order)
        REFERENCES elibrary_authors(elibrary_id, author_order) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS elibrary_matches_teacher ON elibrary_teacher_matches(teacher_id, status);
CREATE INDEX IF NOT EXISTS elibrary_publications_year ON elibrary_publications(publication_year);
-- Three independent spaces. Model ID and input hash make recomputation explicit.
CREATE TABLE IF NOT EXISTS elibrary_embeddings (
    elibrary_id bigint NOT NULL REFERENCES elibrary_publications(elibrary_id) ON DELETE CASCADE,
    field text NOT NULL CHECK (field IN ('title', 'abstract', 'keywords')),
    model text NOT NULL,
    input_hash text NOT NULL,
    dimensions integer NOT NULL CHECK (dimensions > 0),
    embedding double precision[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (elibrary_id, field, model),
    CHECK (cardinality(embedding) = dimensions)
);
COMMIT;
