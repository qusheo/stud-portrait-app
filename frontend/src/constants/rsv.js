/* RSV (РСВ): компетенции, мотиваторы, ценности и образовательные курсы. */

export const RESULT_PROFILES = {
    competences: {
        key: 'competences',
        title: 'Компетенции',
        categories: {
            all_competences: {
                key: 'all_competences',
                title: 'Все компетенции',
                fields: [
                    { key: 'res_comp_info_analysis', label: 'Анализ информации' },
                    { key: 'res_comp_planning', label: 'Планирование' },
                    { key: 'res_comp_result_orientation', label: 'Ориентация на результат' },
                    { key: 'res_comp_stress_resistance', label: 'Стрессоустойчивость' },
                    { key: 'res_comp_partnership', label: 'Партнерство' },
                    { key: 'res_comp_rules_compliance', label: 'Соблюдение правил' },
                    { key: 'res_comp_self_development', label: 'Саморазвитие' },
                    { key: 'res_comp_leadership', label: 'Лидерство' },
                    { key: 'res_comp_emotional_intel', label: 'Эмоциональный интеллект' },
                    { key: 'res_comp_client_focus', label: 'Клиентоориентированность' },
                    { key: 'res_comp_communication', label: 'Коммуникация' },
                    { key: 'res_comp_passive_vocab', label: 'Пассивный словарь' }
                ]
            }
        }
    },
    motivators: {
        key: 'motivators',
        title: 'Мотиваторы',
        categories: {
            all_motivators: {
                key: 'all_motivators',
                title: 'Все мотиваторы',
                fields: [
                    { key: 'res_mot_autonomy', label: 'Автономия' },
                    { key: 'res_mot_altruism', label: 'Альтруизм' },
                    { key: 'res_mot_challenge', label: 'Вызов' },
                    { key: 'res_mot_salary', label: 'Зарплата' },
                    { key: 'res_mot_career', label: 'Карьера' },
                    { key: 'res_mot_creativity', label: 'Креативность' },
                    { key: 'res_mot_relationships', label: 'Отношения' },
                    { key: 'res_mot_recognition', label: 'Признание' },
                    { key: 'res_mot_affiliation', label: 'Принадлежность' },
                    { key: 'res_mot_self_development', label: 'Саморазвитие' },
                    { key: 'res_mot_purpose', label: 'Цель' },
                    { key: 'res_mot_cooperation', label: 'Сотрудничество' },
                    { key: 'res_mot_stability', label: 'Стабильность' },
                    { key: 'res_mot_tradition', label: 'Традиции' },
                    { key: 'res_mot_management', label: 'Управление' },
                    { key: 'res_mot_work_conditions', label: 'Условия работы' }
                ]
            }
        }
    },
    values: {
        key: 'values',
        title: 'Ценности',
        categories: {
            all_values: {
                key: 'all_values',
                title: 'Все ценности',
                fields: [
                    { key: 'res_val_honesty_justice', label: 'Честность и справедливость' },
                    { key: 'res_val_humanism', label: 'Гуманизм' },
                    { key: 'res_val_patriotism', label: 'Патриотизм' },
                    { key: 'res_val_family', label: 'Семья' },
                    { key: 'res_val_health', label: 'Здоровье' },
                    { key: 'res_val_environment', label: 'Окружающая среда' }
                ]
            }
        }
    }
};

/* Компетенции */

export const COMPETENCIES = {
    INFO_ANALYSIS: 'res_comp_info_analysis',
    PLANNING: 'res_comp_planning',
    RESULT_ORIENT: 'res_comp_result_orientation',
    STRESS_RESIST: 'res_comp_stress_resistance',
    PARTNERSHIP: 'res_comp_partnership',
    RULE_COMPLY: 'res_comp_rules_compliance',
    SELF_DEVELOP: 'res_comp_self_development',
    LEADERSHIP: 'res_comp_leadership',
    EMOTE_INTEL: 'res_comp_emotional_intel',
    CLIENT_FOCUS: 'res_comp_client_focus',
    COMMUNICATION: 'res_comp_communication',
    PASSIVE_VOCAB: 'res_comp_passive_vocab'
};

export const COMPETENCIES_NAMES = {
    res_comp_info_analysis: 'Анализ информации',
    res_comp_planning: 'Планирование',
    res_comp_result_orientation: 'Ориентация на результат',
    res_comp_stress_resistance: 'Стрессоустойчивость',
    res_comp_partnership: 'Партнерство',
    res_comp_rules_compliance: 'Соблюдение правил',
    res_comp_self_development: 'Саморазвитие',
    res_comp_leadership: 'Лидерство',
    res_comp_emotional_intel: 'Эмоциональный интеллект',
    res_comp_client_focus: 'Клиентоориентированность',
    res_comp_communication: 'Коммуникация',
    res_comp_passive_vocab: 'Пассивный словарный запас'
};

export const COMPETENCIES_DESCRIPTIONS = {
    res_comp_info_analysis: 'Способность анализировать и обрабатывать информацию',
    res_comp_planning: 'Умение планировать и организовывать работу',
    res_comp_result_orientation: 'Ориентация на достижение результатов',
    res_comp_stress_resistance: 'Способность работать в стрессовых ситуациях',
    res_comp_partnership: 'Умение выстраивать партнерские отношения',
    res_comp_rules_compliance: 'Следование установленным правилам и процедурам',
    res_comp_self_development: 'Стремление к саморазвитию и обучению',
    res_comp_leadership: 'Лидерские качества и способность вести за собой',
    res_comp_emotional_intel: 'Эмоциональный интеллект и понимание эмоций',
    res_comp_client_focus: 'Ориентация на потребности клиента',
    res_comp_communication: 'Коммуникативные навыки',
    res_comp_passive_vocab: 'Пассивный словарный запас'
};

/* Мотиваторы */

export const MOTIVATORS = {
    AUTONOMY: 'res_mot_autonomy',
    ALTRUISM: 'res_mot_altruism',
    CHALLENGE: 'res_mot_challenge',
    SALARY: 'res_mot_salary',
    CAREER: 'res_mot_career',
    CREATIVITY: 'res_mot_creativity',
    RELATION: 'res_mot_relationships',
    RECOGNITION: 'res_mot_recognition',
    AFFILIATION: 'res_mot_affiliation',
    SELF_DEVELOP: 'res_mot_self_development',
    PURPOSE: 'res_mot_purpose',
    COOPERATION: 'res_mot_cooperation',
    STABILITY: 'res_mot_stability',
    TRADITION: 'res_mot_tradition',
    MARAGEMENT: 'res_mot_management',
    WORK_CONDIT: 'res_mot_work_conditions'
};

export const MOTIVATORS_NAMES = {
    res_mot_autonomy: 'Автономия',
    res_mot_altruism: 'Альтруизм',
    res_mot_challenge: 'Вызов',
    res_mot_salary: 'Зарплата',
    res_mot_career: 'Карьера',
    res_mot_creativity: 'Креативность',
    res_mot_relationships: 'Отношения',
    res_mot_recognition: 'Признание',
    res_mot_affiliation: 'Принадлежность',
    res_mot_self_development: 'Саморазвитие',
    res_mot_purpose: 'Цель',
    res_mot_cooperation: 'Сотрудничество',
    res_mot_stability: 'Стабильность',
    res_mot_tradition: 'Традиции',
    res_mot_management: 'Управление',
    res_mot_work_conditions: 'Условия работы'
};

export const MOTIVATORS_DESCRIPTIONS = {
    res_mot_autonomy: 'Стремление к самостоятельности и независимости в работе',
    res_mot_altruism: 'Желание помогать другим и приносить пользу обществу',
    res_mot_challenge: 'Стремление к сложным задачам и вызовам',
    res_mot_salary: 'Материальное вознаграждение как основной мотиватор',
    res_mot_career: 'Карьерный рост и профессиональное развитие',
    res_mot_creativity: 'Возможность проявлять креативность и творчество',
    res_mot_relationships: 'Важность хороших отношений в коллективе',
    res_mot_recognition: 'Признание достижений и заслуг',
    res_mot_affiliation: 'Чувство принадлежности к группе или организации',
    res_mot_self_development: 'Возможность для саморазвития и обучения',
    res_mot_purpose: 'Осмысленность работы и её социальная значимость',
    res_mot_cooperation: 'Сотрудничество и командная работа',
    res_mot_stability: 'Стабильность и предсказуемость работы',
    res_mot_tradition: 'Следование традициям и устоявшимся нормам',
    res_mot_management: 'Стремление к управленческой деятельности',
    res_mot_work_conditions: 'Комфортные условия труда'
};

/* Ценности */

export const VALUES = {
    HONEST_JUST: 'res_val_honesty_justice',
    HUMANISM: 'res_val_humanism',
    PATRIOTISM: 'res_val_patriotism',
    FAMILY: 'res_val_family',
    HEALTH: 'res_val_health',
    ENVIRONMENT: 'res_val_environment'
};

export const VALUES_NAMES = {
    res_val_honesty_justice: 'Честность и справедливость',
    res_val_humanism: 'Гуманизм',
    res_val_patriotism: 'Патриотизм',
    res_val_family: 'Семья',
    res_val_health: 'Здоровье',
    res_val_environment: 'Окружающая среда'
};

export const VALUES_DESCRIPTIONS = {
    res_val_honesty_justice: 'Честность и справедливость как основные жизненные принципы',
    res_val_humanism: 'Гуманизм и уважение к человеческому достоинству',
    res_val_patriotism: 'Патриотизм и любовь к Родине',
    res_val_family: 'Семейные ценности и традиции',
    res_val_health: 'Здоровый образ жизни и забота о здоровье',
    res_val_environment: 'Забота об окружающей среде и экологии'
};

/* Курсы */

export const COURSES_NAMES = {
    course_an_dec: 'Анализ информации для принятия решений',
    course_client_focus: 'Клиентоориентированность',
    course_communication: 'Коммуникативная грамотность',
    course_leadership: 'Лидерство: основы',
    course_result_orientation: 'Ориентация на результат',
    course_planning_org: 'Планирование и организация',
    course_rules_culture: 'Роль культуры правил',
    course_self_dev: 'Саморазвитие',
    course_collaboration: 'Сотрудничество',
    course_stress_resistance: 'Стрессоустойчивость',
    course_emotions_communication: 'Эмоции и коммуникация',
    course_negotiations: 'Искусство деловых переговоров',
    course_digital_comm: 'Коммуникация в цифровой среде',
    course_effective_learning: 'Навыки эффективного обучения',
    course_entrepreneurship: 'Предпринимательское мышление',
    course_creativity_tech: 'Технологии креативности',
    course_trendwatching: 'Трендвотчинг',
    course_conflict_management: 'Управление конфликтами',
    course_career_management: 'Управляй своей карьерой',
    course_burnout: 'Эмоциональное выгорание',
    course_cross_cultural_comm: 'Межкультурные коммуникации',
    course_mentoring: 'Я — наставник'
};
