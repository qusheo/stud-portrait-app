CREATE TABLE interest_categories (
    code VARCHAR(64) PRIMARY KEY,
    sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE interests (
    code VARCHAR(64) PRIMARY KEY,
    category_code VARCHAR(64) NOT NULL
        REFERENCES interest_categories(code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE participant_interests (
    participant_id INTEGER NOT NULL,
    interest_code VARCHAR(64) NOT NULL
        REFERENCES interests(code)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    PRIMARY KEY (participant_id, interest_code),

    CONSTRAINT fk_participant_interests
        FOREIGN KEY (participant_id)
        REFERENCES participants(part_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_participant_interests_interest
    ON participant_interests(interest_code);


INSERT INTO interest_categories (code, sort_order) VALUES
('social', 1),
('education', 2),
('ecology', 3),
('health_sport', 4),
('culture', 5),
('media', 6),
('technology', 7),
('business', 8),
('society', 9),
('events', 10)
ON CONFLICT (code) DO NOTHING;


INSERT INTO interests (code, category_code) VALUES
('charity', 'social'),
('children_elderly', 'social'),
('disability_support', 'social'),
('animal_welfare', 'social'),
('humanitarian_aid', 'social'),

('teaching_mentoring', 'education'),
('career_guidance', 'education'),
('research', 'education'),
('science_popularization', 'education'),

('nature_protection', 'ecology'),
('recycling_greening', 'ecology'),
('sustainable_development', 'ecology'),

('health_medicine', 'health_sport'),
('psychological_support', 'health_sport'),
('sports', 'health_sport'),
('tourism', 'health_sport'),

('music_theatre_cinema', 'culture'),
('literature_art', 'culture'),
('cultural_heritage', 'culture'),
('creative_design', 'culture'),

('photo_video', 'media'),
('journalism_content', 'media'),
('social_media', 'media'),
('advertising_pr', 'media'),

('programming', 'technology'),
('ai_data', 'technology'),
('robotics_engineering', 'technology'),
('cybersecurity', 'technology'),

('business_startups', 'business'),
('social_entrepreneurship', 'business'),
('economics_finance', 'business'),
('marketing', 'business'),

('urban_development', 'society'),
('community_initiatives', 'society'),
('law_safety', 'society'),
('international_cooperation', 'society'),

('event_organization', 'events'),
('festivals_conferences', 'events'),
('project_management', 'events'),
('emergency_response', 'events')
ON CONFLICT (code) DO NOTHING;
