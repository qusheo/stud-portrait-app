export const INTEREST_CATEGORIES = {
    social: ['charity', 'children_elderly', 'disability_support', 'animal_welfare', 'humanitarian_aid'],
    education: ['teaching_mentoring', 'career_guidance', 'research', 'science_popularization'],
    ecology: ['nature_protection', 'recycling_greening', 'sustainable_development'],
    health_sport: ['health_medicine', 'psychological_support', 'sports', 'tourism'],
    culture: ['music_theatre_cinema', 'literature_art', 'cultural_heritage', 'creative_design'],
    media: ['photo_video', 'journalism_content', 'social_media', 'advertising_pr'],
    technology: ['programming', 'ai_data', 'robotics_engineering', 'cybersecurity'],
    business: ['business_startups', 'social_entrepreneurship', 'economics_finance', 'marketing'],
    society: ['urban_development', 'community_initiatives', 'law_safety', 'international_cooperation'],
    events: ['event_organization', 'festivals_conferences', 'project_management', 'emergency_response'],
};

export const INTEREST_CATEGORY_NAMES = {
    social: 'Социальная помощь и волонтёрство',
    education: 'Образование и наука',
    ecology: 'Экология и природа',
    health_sport: 'Здоровье и спорт',
    culture: 'Культура и творчество',
    media: 'Медиа и коммуникации',
    technology: 'IT и технологии',
    business: 'Бизнес и предпринимательство',
    society: 'Общество и городская среда',
    events: 'Мероприятия и проекты',
};

export const INTEREST_NAMES = {
    charity: 'Благотворительность и помощь нуждающимся',
    children_elderly: 'Помощь детям и пожилым людям',
    disability_support: 'Поддержка людей с инвалидностью',
    animal_welfare: 'Помощь и защита животных',
    humanitarian_aid: 'Гуманитарная помощь',

    teaching_mentoring: 'Обучение и наставничество',
    career_guidance: 'Профориентация и просвещение',
    research: 'Научные исследования',
    science_popularization: 'Популяризация науки',

    nature_protection: 'Защита природы и экология',
    recycling_greening: 'Переработка отходов и озеленение',
    sustainable_development: 'Устойчивое развитие',

    health_medicine: 'Здоровье и медицина',
    psychological_support: 'Психологическая поддержка',
    sports: 'Спорт и физическая культура',
    tourism: 'Туризм и активный отдых',

    music_theatre_cinema: 'Музыка, театр и кино',
    literature_art: 'Литература и искусство',
    cultural_heritage: 'История и культурное наследие',
    creative_design: 'Дизайн и творчество',

    photo_video: 'Фотография и видеосъёмка',
    journalism_content: 'Журналистика и создание контента',
    social_media: 'Социальные сети и блогинг',
    advertising_pr: 'Реклама и PR',

    programming: 'Программирование и разработка',
    ai_data: 'Искусственный интеллект и анализ данных',
    robotics_engineering: 'Робототехника и инженерия',
    cybersecurity: 'Кибербезопасность',

    business_startups: 'Бизнес и стартапы',
    social_entrepreneurship: 'Социальное предпринимательство',
    economics_finance: 'Экономика и финансы',
    marketing: 'Маркетинг',

    urban_development: 'Благоустройство и развитие городов',
    community_initiatives: 'Общественные и молодёжные инициативы',
    law_safety: 'Правовая грамотность и безопасность',
    international_cooperation: 'Международное и межкультурное сотрудничество',

    event_organization: 'Организация мероприятий',
    festivals_conferences: 'Фестивали, форумы и конференции',
    project_management: 'Управление проектами',
    emergency_response: 'Чрезвычайные ситуации и спасательные инициативы',
};

export const INTEREST_CODES = Object.values(INTEREST_CATEGORIES).flat();
